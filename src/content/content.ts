import browser from 'webextension-polyfill';
import { PageContext } from '@/types';
import { codeBlockDetector } from '@/utils/codeBlockDetector';

/**
 * コンテンツスクリプトのメインクラス
 */
class ContentScript {
  private isTranslating = false;
  private observer: MutationObserver | null = null;
  private pageContext: PageContext | null = null;
  private translatedElements: Set<Element> = new Set();
  
  /**
   * 指定したミリ秒だけ待機する
   * @param ms 待機するミリ秒
   * @returns Promiseオブジェクト
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * コンテンツスクリプトを初期化する
   */
  async initialize() {
    console.log('Code Preserve Translator: コンテンツスクリプトを初期化しています');
    
    // ページコンテキストの初期化
    this.initializePageContext();
    
    // メッセージリスナーの設定
    this.setupMessageListeners();
    
    // ページの変更を監視
    this.setupMutationObserver();
    
    // 拡張機能のアイコンがクリックされたときの処理
    browser.runtime.onMessage.addListener(message => {
      if (message.type === 'TOGGLE_TRANSLATION') {
        this.toggleTranslation();
      }
    });
    
    // ページが完全に読み込まれた後に処理を開始
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.processPage());
    } else {
      this.processPage();
    }
  }

  /**
   * ページコンテキストを初期化する
   */
  private async initializePageContext() {
    const url = window.location.href;
    
    // バックグラウンドスクリプトからページコンテキストを取得
    const response = await browser.runtime.sendMessage({
      type: 'GET_PAGE_CONTEXT',
      url
    });
    
    if (response.success && response.context) {
      this.pageContext = response.context;
      console.log('既存のページコンテキストを読み込みました');
    } else {
      // 新しいページコンテキストを作成
      this.pageContext = {
        url,
        title: document.title,
        content: '',
        codeBlocks: [],
        translations: {},
        chatHistory: [],
        lastUpdated: Date.now()
      };
      console.log('新しいページコンテキストを作成しました');
    }
  }

  /**
   * メッセージリスナーを設定する
   */
  private setupMessageListeners() {
    browser.runtime.onMessage.addListener(async (message) => {
      switch (message.type) {
        case 'GET_PAGE_CONTENT':
          return this.handleGetPageContent();
          
        case 'TRANSLATE_PAGE':
          return this.handleTranslatePage();
          
        case 'RESET_TRANSLATION':
          return this.handleResetTranslation();
          
        case 'CHAT_QUERY':
          return this.handleChatQuery(message.query);
      }
    });
  }

  /**
   * ページの変更を監視するMutationObserverを設定する
   */
  private setupMutationObserver() {
    this.observer = new MutationObserver(mutations => {
      // 新しく追加された要素を処理
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.processElement(node as Element);
            }
          });
        }
      }
    });
    
    // ドキュメント全体の変更を監視
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * ページ全体を処理する
   */
  private async processPage() {
    console.log('ページを処理しています...');
    
    // コードブロックを検出
    const codeBlocks = codeBlockDetector.detectCodeBlocks();
    
    if (this.pageContext) {
      this.pageContext.codeBlocks = codeBlocks;
      
      // ページの主要なテキスト内容を抽出
      this.pageContext.content = this.extractPageContent();
      
      // ページコンテキストを保存
      await this.savePageContext();
    }
    
    // コードブロックにマーカーを追加
    codeBlockDetector.markCodeBlocks(codeBlocks);
    
    console.log(`${codeBlocks.length}個のコードブロックを検出しました`);
  }

  /**
   * 要素を処理する
   * @param element 処理する要素
   */
  private processElement(element: Element) {
    // すでに処理済みの要素はスキップ
    if (this.translatedElements.has(element)) {
      return;
    }
    
    // 翻訳中の場合は要素を翻訳
    if (this.isTranslating) {
      this.translateElement(element);
    }
  }

  /**
   * 要素内のテキストノードを取得する
   * @param element テキストノードを取得する要素
   * @returns テキストノードの配列
   */
  private getTextNodes(element: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Node | null;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }
    
    return textNodes;
  }

  /**
   * 要素を翻訳する
   * @param element 翻訳する要素
   */
  private async translateElement(element: Element) {
    // テキストノードのみを処理
    if (!this.shouldTranslateElement(element)) {
      return;
    }
    
    // 要素内のテキストノードを処理
    const textNodes = this.getTextNodes(element);
    
    for (const node of textNodes) {
      const text = node.nodeValue;
      
      if (!text || text.trim().length === 0) {
        continue;
      }
      
      // コードブロック内のテキストはスキップ
      if (this.isInsideCodeBlock(node)) {
        continue;
      }
      
      try {
        console.log('翻訳前のテキスト:', text);
        
        // バックグラウンドスクリプトに翻訳リクエストを送信
        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          text
        });
        
        if (response.success && response.translatedText) {
          console.log('翻訳後のテキスト:', response.translatedText);
          
          // テキストノードを翻訳テキストで置き換え
          node.nodeValue = response.translatedText;
          
          // 翻訳済み要素として記録
          this.translatedElements.add(element);
          
          // ページコンテキストに翻訳を保存
          if (this.pageContext) {
            this.pageContext.translations[text] = {
              originalText: text,
              translatedText: response.translatedText,
              timestamp: Date.now()
            };
          }
        }
      } catch (error) {
        console.error('テキストの翻訳に失敗しました:', error);
      }
    }
  }

  /**
   * 要素が翻訳対象かどうかを判定する
   * @param element 判定する要素
   * @returns 翻訳対象の場合はtrue
   */
  private shouldTranslateElement(element: Element): boolean {
    // 翻訳しない要素のタグ名
    const excludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'VIDEO', 'AUDIO', 'IFRAME'];
    
    if (excludedTags.includes(element.tagName)) {
      return false;
    }
    
    // コードブロックとしてマークされている要素はスキップ
    if (element.getAttribute('data-code-block') === 'true') {
      return false;
    }
    
    // コードブロック内の要素はスキップ
    if (this.isInsideCodeBlock(element)) {
      return false;
    }
    
    return true;
  }

  /**
   * 要素がコードブロック内にあるかどうかを判定する
   * @param node 判定するノード
   * @returns コードブロック内の場合はtrue
   */
  private isInsideCodeBlock(node: Node): boolean {
    let current: Node | null = node;
    
    while (current && current !== document.body) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as Element;
        
        // コードブロックとしてマークされている要素内の場合
        if (element.getAttribute('data-code-block') === 'true') {
          return true;
        }
        
        // 一般的なコードブロック要素の場合
        if (
          element.tagName === 'CODE' ||
          element.tagName === 'PRE' ||
          element.classList.contains('code') ||
          element.classList.contains('highlight') ||
          element.classList.contains('hljs') ||
          element.classList.contains('CodeMirror')
        ) {
          return true;
        }
      }
      
      current = current.parentNode;
    }
    
    return false;
  }


  /**
   * ページの主要なテキスト内容を抽出する
   * @returns 抽出されたテキスト
   */
  private extractPageContent(): string {
    console.log('ページコンテンツを抽出しています...');
    
    // 主要なコンテンツを含む要素のセレクタ
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.article',
      '.post',
      '.entry',
      '#content',
      '#main',
      // OpenAI Platformのドキュメントページ用のセレクタを追加
      '.docs-content',
      '.markdown-content',
      '.api-docs',
      '.documentation',
      // 一般的なドキュメントページのセレクタ
      '.doc-content',
      '.page-content',
      '.main-content',
      // フォールバックとして、より一般的なセレクタ
      'div[role="main"]',
      'section',
      '.container'
    ];
    
    // セレクタに一致する要素を検索
    let contentElement: Element | null = null;
    let usedSelector: string = '';
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 0) {
        contentElement = element;
        usedSelector = selector;
        break;
      }
    }
    
    // 一致する要素がない場合はbody要素を使用
    if (!contentElement) {
      contentElement = document.body;
      usedSelector = 'body';
    }
    
    console.log(`コンテンツ要素が見つかりました: ${usedSelector}`);
    
    // テキスト内容を抽出
    const content = this.extractTextContent(contentElement);
    console.log(`抽出されたコンテンツの長さ: ${content.length}文字`);
    
    return content;
  }

  /**
   * 要素からテキスト内容を抽出する
   * @param element テキストを抽出する要素
   * @returns 抽出されたテキスト
   */
  private extractTextContent(element: Element): string {
    // 除外する要素のセレクタ
    const excludeSelectors = [
      'header',
      'footer',
      'nav',
      'aside',
      '.sidebar',
      '.navigation',
      '.menu',
      '.comments',
      '.ads',
      '.advertisement',
      'script',
      'style',
      'noscript',
      'iframe'
    ];
    
    // 要素のクローンを作成して、除外要素を削除
    const clone = element.cloneNode(true) as Element;
    
    // 除外する要素を削除
    for (const selector of excludeSelectors) {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => {
        el.parentNode?.removeChild(el);
      });
    }
    
    // scriptタグの内容を削除
    const scripts = clone.querySelectorAll('script');
    scripts.forEach(script => {
      script.parentNode?.removeChild(script);
    });
    
    // インラインスクリプトを含む属性を削除
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
      // onclickなどのイベントハンドラ属性を削除
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    // テキスト内容を取得
    const textContent = clone.textContent || '';
    
    // HTML形式でのコンテンツも取得
    try {
      const serializer = new XMLSerializer();
      const htmlContent = serializer.serializeToString(clone);
      console.log('HTML形式でのコンテンツ長さ:', htmlContent.length);
      
      // ページコンテキストにHTML形式のコンテンツも保存
      if (this.pageContext) {
        this.pageContext.htmlContent = htmlContent;
        
        // 構造化されたコンテンツも保存
        this.extractStructuredContent(clone);
      }
    } catch (error) {
      console.error('HTML形式でのコンテンツ取得に失敗しました:', error);
    }
    
    return textContent.trim();
  }
  
  /**
   * 構造化されたコンテンツを抽出する
   * @param element 構造化されたコンテンツを抽出する要素
   */
  private extractStructuredContent(element: Element): void {
    if (!this.pageContext) {
      return;
    }
    
    // 構造化されたコンテンツを格納する配列
    const structuredContent: Array<{
      type: string;
      content: string;
      tag?: string;
      attributes?: Record<string, string>;
    }> = [];
    
    // 見出し要素を抽出
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      structuredContent.push({
        type: 'heading',
        content: heading.textContent || '',
        tag: heading.tagName.toLowerCase(),
        attributes: this.getElementAttributes(heading)
      });
    });
    
    // 段落要素を抽出
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(paragraph => {
      structuredContent.push({
        type: 'paragraph',
        content: paragraph.textContent || '',
        tag: 'p',
        attributes: this.getElementAttributes(paragraph)
      });
    });
    
    // リスト要素を抽出
    const lists = element.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent || '');
      structuredContent.push({
        type: 'list',
        content: items.join('\n'),
        tag: list.tagName.toLowerCase(),
        attributes: this.getElementAttributes(list)
      });
    });
    
    // コードブロックを抽出
    const codeBlocks = element.querySelectorAll('pre, code');
    codeBlocks.forEach(codeBlock => {
      structuredContent.push({
        type: 'code',
        content: codeBlock.textContent || '',
        tag: codeBlock.tagName.toLowerCase(),
        attributes: this.getElementAttributes(codeBlock)
      });
    });
    
    // 画像要素を抽出
    const images = element.querySelectorAll('img');
    images.forEach(image => {
      structuredContent.push({
        type: 'image',
        content: image.getAttribute('alt') || '',
        tag: 'img',
        attributes: this.getElementAttributes(image)
      });
    });
    
    // ページコンテキストに構造化されたコンテンツを保存
    this.pageContext.structuredContent = structuredContent;
  }
  
  /**
   * 要素の属性を取得する
   * @param element 属性を取得する要素
   * @returns 属性のオブジェクト
   */
  private getElementAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    
    Array.from(element.attributes).forEach(attr => {
      // スクリプト関連の属性は除外
      if (!attr.name.startsWith('on') && !attr.value.includes('javascript:')) {
        attributes[attr.name] = attr.value;
      }
    });
    
    return attributes;
  }

  /**
   * 翻訳の切り替え
   */
  private async toggleTranslation() {
    this.isTranslating = !this.isTranslating;
    
    if (this.isTranslating) {
      console.log('翻訳を開始します...');
      
      // ページ内の全ての要素を処理
      const elements = document.querySelectorAll('body *');
      for (const element of Array.from(elements)) {
        await this.translateElement(element);
      }
      
      console.log('翻訳が完了しました');
    } else {
      console.log('翻訳をリセットします...');
      this.resetTranslation();
    }
    
    return { success: true, isTranslating: this.isTranslating };
  }

  /**
   * 翻訳をリセットする
   */
  private resetTranslation() {
    // ページをリロード
    window.location.reload();
  }

  /**
   * ページコンテキストを保存する
   */
  private async savePageContext() {
    if (!this.pageContext) {
      return;
    }
    
    // 最終更新タイムスタンプを更新
    this.pageContext.lastUpdated = Date.now();
    
    // バックグラウンドスクリプトにページコンテキストを送信
    await browser.runtime.sendMessage({
      type: 'SAVE_PAGE_CONTEXT',
      context: this.pageContext
    });
  }

  /**
   * ページコンテンツ取得リクエストの処理
   * @returns ページコンテンツ
   */
  private handleGetPageContent() {
    // ページコンテンツが空の場合は、再取得を試みる
    if (!this.pageContext?.content || this.pageContext.content.trim().length === 0) {
      console.log('ページコンテンツが空のため、再取得を試みます');
      this.pageContext = this.pageContext || {
        url: window.location.href,
        title: document.title,
        content: '',
        codeBlocks: [],
        translations: {},
        chatHistory: [],
        lastUpdated: Date.now()
      };
      
      // ページの主要なテキスト内容を抽出
      this.pageContext.content = this.extractPageContent();
      console.log(`再取得したコンテンツの長さ: ${this.pageContext.content.length}文字`);
      
      // ページコンテンツが依然として空の場合は、ページ全体のテキストを取得
      if (!this.pageContext.content || this.pageContext.content.trim().length === 0) {
        console.log('再取得したコンテンツも空のため、ページ全体のテキストを取得します');
        this.pageContext.content = document.body.innerText || document.body.textContent || '';
        console.log(`ページ全体のテキストの長さ: ${this.pageContext.content.length}文字`);
      }
    }
    
    // レスポンスを作成
    const response: {
      success: boolean;
      content: string;
      title: string;
      url: string;
      htmlContent?: string;
      structuredContent?: Array<{
        type: string;
        content: string;
        tag?: string;
        attributes?: Record<string, string>;
      }>;
      translatedContent?: string;
      translatedHtmlContent?: string;
      translatedStructuredContent?: Array<{
        type: string;
        content: string;
        tag?: string;
        attributes?: Record<string, string>;
      }>;
    } = {
      success: true,
      content: this.pageContext?.content || '',
      title: document.title,
      url: window.location.href
    };
    
    // HTML形式のコンテンツがある場合は追加
    if (this.pageContext?.htmlContent) {
      response.htmlContent = this.pageContext.htmlContent;
    }
    
    // 構造化されたコンテンツがある場合は追加
    if (this.pageContext?.structuredContent) {
      response.structuredContent = this.pageContext.structuredContent;
    }
    
    // 翻訳されたコンテンツがある場合は追加
    if (this.pageContext?.translatedContent) {
      response.translatedContent = this.pageContext.translatedContent;
    }
    
    // 翻訳されたHTML形式のコンテンツがある場合は追加
    if (this.pageContext?.translatedHtmlContent) {
      response.translatedHtmlContent = this.pageContext.translatedHtmlContent;
    }
    
    // 翻訳された構造化されたコンテンツがある場合は追加
    if (this.pageContext?.translatedStructuredContent) {
      response.translatedStructuredContent = this.pageContext.translatedStructuredContent;
    }
    
    return response;
  }

  /**
   * ページ翻訳リクエストの処理
   * @returns 処理結果
   */
  private async handleTranslatePage() {
    console.log('ページ翻訳リクエストを処理します');
    
    // ページコンテンツが空の場合は、再取得を試みる
    if (!this.pageContext?.content || this.pageContext.content.trim().length === 0) {
      console.log('翻訳前にページコンテンツを再取得します');
      this.pageContext = this.pageContext || {
        url: window.location.href,
        title: document.title,
        content: '',
        codeBlocks: [],
        translations: {},
        chatHistory: [],
        lastUpdated: Date.now()
      };
      
      // ページの主要なテキスト内容を抽出
      this.pageContext.content = this.extractPageContent();
    }
    
    try {
      console.log('翻訳を開始します...');
      
      // 構造化されたコンテンツがある場合は、それを翻訳
      if (this.pageContext?.structuredContent && this.pageContext.structuredContent.length > 0) {
        console.log('構造化されたコンテンツを翻訳します');
        await this.translateStructuredContent();
      } 
      // HTML形式のコンテンツがある場合は、テキストノードを抽出して翻訳
      else if (this.pageContext?.htmlContent) {
        console.log('HTML形式のコンテンツを翻訳します');
        await this.translateHtmlContent();
      }
      // それ以外の場合は、テキストコンテンツを翻訳
      else if (this.pageContext?.content) {
        console.log('テキストコンテンツを翻訳します');
        const translatedText = await this.translateText(this.pageContext.content);
        if (translatedText && this.pageContext) {
          this.pageContext.translatedContent = translatedText;
        }
      }
      
      console.log('翻訳が完了しました');
      
      // ページコンテキストを保存
      await this.savePageContext();
      
      return { 
        success: true, 
        isTranslating: true,
        message: '翻訳が完了しました'
      };
    } catch (error) {
      console.error('翻訳に失敗しました:', error);
      return { 
        success: false, 
        error: '翻訳に失敗しました: ' + (error instanceof Error ? error.message : String(error))
      };
    }
  }
  
  /**
   * 構造化されたコンテンツを翻訳する
   */
  private async translateStructuredContent(): Promise<void> {
    if (!this.pageContext?.structuredContent) {
      return;
    }
    
    const translatedItems: Array<{
      type: string;
      content: string;
      tag?: string;
      attributes?: Record<string, string>;
    }> = [];
    
    for (const item of this.pageContext.structuredContent) {
      // コードブロックは翻訳しない
      if (item.type === 'code') {
        translatedItems.push(item);
        continue;
      }
      
      // 画像の代替テキストは翻訳する
      if (item.type === 'image' && item.content) {
        const translatedAlt = await this.translateText(item.content);
        translatedItems.push({
          ...item,
          content: translatedAlt || item.content
        });
        
        // レート制限を回避するために少し待機
        await this.sleep(1000);
        continue;
      }
      
      // その他のコンテンツを翻訳
      if (item.content) {
        const translatedText = await this.translateText(item.content);
        if (translatedText) {
          translatedItems.push({
            ...item,
            content: translatedText
          });
        } else {
          translatedItems.push(item);
        }
        
        // レート制限を回避するために少し待機
        await this.sleep(1000);
      } else {
        translatedItems.push(item);
      }
    }
    
    // 翻訳された構造化コンテンツを保存
    this.pageContext.translatedStructuredContent = translatedItems;
  }
  
  /**
   * HTML形式のコンテンツを翻訳する
   */
  private async translateHtmlContent(): Promise<void> {
    if (!this.pageContext?.htmlContent) {
      return;
    }
    
    try {
      // DOMParserを使用してHTMLを解析
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.pageContext.htmlContent, 'text/html');
      
      // テキストノードを抽出して翻訳
      await this.translateTextNodes(doc.body);
      
      // 翻訳されたHTMLを保存
      const serializer = new XMLSerializer();
      this.pageContext.translatedHtmlContent = serializer.serializeToString(doc.body);
    } catch (error) {
      console.error('HTML形式のコンテンツの翻訳に失敗しました:', error);
    }
  }
  
  /**
   * 要素内のテキストノードを再帰的に翻訳する
   * @param element 翻訳する要素
   */
  private async translateTextNodes(element: Element): Promise<void> {
    // 翻訳しない要素のタグ名
    const excludedTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'];
    
    // 子ノードを配列に変換（ライブコレクションの変更を避けるため）
    const childNodes = Array.from(element.childNodes);
    
    for (const node of childNodes) {
      // テキストノードの場合
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const text = node.textContent.trim();
        if (text.length > 0) {
          const translatedText = await this.translateText(text);
          if (translatedText) {
            node.textContent = translatedText;
          }
          
          // レート制限を回避するために少し待機
          await this.sleep(1000);
        }
      }
      // 要素ノードの場合は再帰的に処理
      else if (node.nodeType === Node.ELEMENT_NODE) {
        const childElement = node as Element;
        
        // 翻訳しない要素はスキップ
        if (!excludedTags.includes(childElement.tagName)) {
          await this.translateTextNodes(childElement);
        }
      }
    }
  }
  
  /**
   * テキストを翻訳する
   * @param text 翻訳するテキスト
   * @returns 翻訳されたテキスト
   */
  private async translateText(text: string): Promise<string | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }
    
    try {
      console.log('テキストを翻訳します:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      
      // キャッシュから翻訳を取得
      if (this.pageContext?.translations[text]) {
        console.log('キャッシュから翻訳を取得しました');
        return this.pageContext.translations[text].translatedText;
      }
      
      // バックグラウンドスクリプトに翻訳リクエストを送信
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE_TEXT',
        text
      });
      
      if (response.success && response.translatedText) {
        console.log('翻訳に成功しました');
        
        // ページコンテキストに翻訳を保存
        if (this.pageContext) {
          this.pageContext.translations[text] = {
            originalText: text,
            translatedText: response.translatedText,
            timestamp: Date.now()
          };
        }
        
        return response.translatedText;
      } else {
        console.error('翻訳に失敗しました:', response.error || '不明なエラー');
        return null;
      }
    } catch (error) {
      console.error('翻訳に失敗しました:', error);
      return null;
    }
  }

  /**
   * 翻訳リセットリクエストの処理
   * @returns 処理結果
   */
  private handleResetTranslation() {
    this.resetTranslation();
    return { success: true };
  }

  /**
   * チャットクエリリクエストの処理
   * @param query ユーザーのクエリ
   * @returns 処理結果
   */
  private async handleChatQuery(query: string) {
    if (!this.pageContext) {
      return {
        success: false,
        error: 'ページコンテキストが初期化されていません'
      };
    }
    
    // バックグラウンドスクリプトにチャットクエリを送信
    const response = await browser.runtime.sendMessage({
      type: 'CHAT_QUERY',
      query,
      url: this.pageContext.url
    });
    
    return response;
  }
}

// コンテンツスクリプトのインスタンスを作成して初期化
const contentScript = new ContentScript();
contentScript.initialize();
