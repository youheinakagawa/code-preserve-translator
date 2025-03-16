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
        // バックグラウンドスクリプトに翻訳リクエストを送信
        const response = await browser.runtime.sendMessage({
          type: 'TRANSLATE_TEXT',
          text
        });
        
        if (response.success && response.translatedText) {
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
   * ページの主要なテキスト内容を抽出する
   * @returns 抽出されたテキスト
   */
  private extractPageContent(): string {
    // 主要なコンテンツを含む要素のセレクタ
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.article',
      '.post',
      '.entry',
      '#content',
      '#main'
    ];
    
    // セレクタに一致する要素を検索
    let contentElement: Element | null = null;
    
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        contentElement = element;
        break;
      }
    }
    
    // 一致する要素がない場合はbody要素を使用
    if (!contentElement) {
      contentElement = document.body;
    }
    
    // テキスト内容を抽出
    return this.extractTextContent(contentElement);
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
      '.advertisement'
    ];
    
    // 除外する要素を一時的に非表示にする
    const excludedElements: Element[] = [];
    
    for (const selector of excludeSelectors) {
      const elements = element.querySelectorAll(selector);
      elements.forEach(el => {
        excludedElements.push(el);
        (el as HTMLElement).style.display = 'none';
      });
    }
    
    // テキスト内容を取得
    const textContent = element.textContent || '';
    
    // 除外した要素を元に戻す
    excludedElements.forEach(el => {
      (el as HTMLElement).style.display = '';
    });
    
    return textContent.trim();
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
    return {
      success: true,
      content: this.pageContext?.content || '',
      title: document.title,
      url: window.location.href
    };
  }

  /**
   * ページ翻訳リクエストの処理
   * @returns 処理結果
   */
  private async handleTranslatePage() {
    return this.toggleTranslation();
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
