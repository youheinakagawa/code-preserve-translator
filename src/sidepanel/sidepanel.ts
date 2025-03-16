import browser from 'webextension-polyfill';
import { TranslationSettings } from '@/types';

/**
 * サイドパネルのメインクラス
 */
class SidePanel {
  private tabs!: NodeListOf<Element>;
  private tabContents!: NodeListOf<Element>;
  private translationToggle!: HTMLInputElement;
  private refreshButton!: HTMLButtonElement;
  private translationStatus!: HTMLElement;
  private translationContent!: HTMLElement;
  private apiKeyInput!: HTMLInputElement;
  private toneSelect!: HTMLSelectElement;
  private cacheExpirationInput!: HTMLInputElement;
  private saveSettingsButton!: HTMLButtonElement;
  private settingsStatus!: HTMLElement;
  private chatInput!: HTMLTextAreaElement;
  private sendButton!: HTMLButtonElement;
  private chatMessages!: HTMLElement;
  private settings: TranslationSettings | null = null;
  private currentTabId: number | null = null;

  /**
   * サイドパネルを初期化する
   */
  async initialize() {
    console.log('Code Preserve Translator: サイドパネルを初期化しています');
    
    // 要素の取得
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    const translationToggle = document.getElementById('translation-toggle');
    const refreshButton = document.getElementById('refresh-button');
    const translationStatus = document.getElementById('translation-status');
    const translationContent = document.getElementById('translation-content');
    const apiKeyInput = document.getElementById('api-key');
    const toneSelect = document.getElementById('tone');
    const cacheExpirationInput = document.getElementById('cache-expiration');
    const saveSettingsButton = document.getElementById('save-settings');
    const settingsStatus = document.getElementById('settings-status');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    
    if (!translationToggle || !refreshButton || !translationStatus || !translationContent || 
        !apiKeyInput || !toneSelect || !cacheExpirationInput || !saveSettingsButton || 
        !settingsStatus || !chatInput || !sendButton || !chatMessages) {
      console.error('必要なDOM要素が見つかりません');
      return;
    }
    
    this.translationToggle = translationToggle as HTMLInputElement;
    this.refreshButton = refreshButton as HTMLButtonElement;
    this.translationStatus = translationStatus as HTMLElement;
    this.translationContent = translationContent as HTMLElement;
    this.apiKeyInput = apiKeyInput as HTMLInputElement;
    this.toneSelect = toneSelect as HTMLSelectElement;
    this.cacheExpirationInput = cacheExpirationInput as HTMLInputElement;
    this.saveSettingsButton = saveSettingsButton as HTMLButtonElement;
    this.settingsStatus = settingsStatus as HTMLElement;
    this.chatInput = chatInput as HTMLTextAreaElement;
    this.sendButton = sendButton as HTMLButtonElement;
    this.chatMessages = chatMessages as HTMLElement;
    
    // 現在のタブIDを取得
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      console.log('取得したタブ情報:', tabs);
      
      if (tabs[0]?.id) {
        this.currentTabId = tabs[0].id;
        console.log('現在のタブID:', this.currentTabId);
      } else {
        console.error('アクティブなタブのIDが取得できませんでした');
      }
    } catch (error) {
      console.error('タブ情報の取得に失敗しました:', error);
    }
    
    // 設定を読み込む
    await this.loadSettings();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // ページコンテンツの取得
    await this.loadPageContent();
  }

  /**
   * イベントリスナーを設定する
   */
  private setupEventListeners() {
    // タブ切り替え
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });
    
    // 翻訳トグル
    this.translationToggle.addEventListener('change', () => {
      this.toggleTranslation();
    });
    
    // リフレッシュボタン
    this.refreshButton.addEventListener('click', () => {
      this.refreshPage();
    });
    
    // 設定保存ボタン
    this.saveSettingsButton.addEventListener('click', () => {
      this.saveSettingsToStorage();
    });
    
    // チャット送信ボタン
    this.sendButton.addEventListener('click', () => {
      this.sendChatMessage();
    });
    
    // チャット入力のEnterキー処理
    this.chatInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendChatMessage();
      }
    });
    
    // タブの変更を監視
    browser.tabs.onActivated.addListener(async (activeInfo) => {
      console.log('タブが変更されました。新しいタブID:', activeInfo.tabId);
      this.currentTabId = activeInfo.tabId;
      await this.loadPageContent();
    });
    
    // ページの更新を監視
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
      console.log('タブが更新されました。タブID:', tabId, '更新情報:', changeInfo);
      if (this.currentTabId === tabId && changeInfo.status === 'complete') {
        await this.loadPageContent();
      }
    });
    
    // サイドパネルが表示されたときにページコンテンツを読み込む
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await this.loadPageContent();
      }
    });
  }

  /**
   * タブを切り替える
   * @param tabName 切り替えるタブ名
   */
  private switchTab(tabName: string) {
    // タブの切り替え
    this.tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // タブコンテンツの切り替え
    this.tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * 設定を読み込む
   */
  private async loadSettings() {
    try {
      const response = await browser.runtime.sendMessage({
        type: 'GET_SETTINGS'
      });
      
      if (response.success && response.settings) {
        this.settings = response.settings;
        
        // 設定をUIに反映
        this.apiKeyInput.value = this.settings?.apiKey || '';
        this.toneSelect.value = this.settings?.tone || 'casual';
        this.cacheExpirationInput.value = this.settings?.cacheExpiration?.toString() || '5';
      }
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
      this.showSettingsStatus('設定の読み込みに失敗しました', false);
    }
  }

  /**
   * ページコンテンツを読み込む
   */
  private async loadPageContent() {
    if (!this.currentTabId) {
      this.translationContent.textContent = 'アクティブなタブが見つかりません';
      return;
    }
    
    console.log('ページコンテンツを取得します。タブID:', this.currentTabId);
    
    try {
      console.log('メッセージを送信します:', { type: 'GET_PAGE_CONTENT' }, 'タブID:', this.currentTabId);
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'GET_PAGE_CONTENT'
      });
      console.log('メッセージの応答を受信しました:', response);
      
      if (response.success) {
        // 翻訳コンテンツをクリア
        this.translationContent.innerHTML = '';
        
        // ページタイトルとURLを表示
        const titleElement = document.createElement('h2');
        titleElement.textContent = response.title;
        
        const urlElement = document.createElement('p');
        urlElement.textContent = response.url;
        urlElement.style.fontSize = '12px';
        urlElement.style.color = '#666';
        
        this.translationContent.appendChild(titleElement);
        this.translationContent.appendChild(urlElement);
        this.translationContent.appendChild(document.createElement('hr'));
        
        // 翻訳ボタンを表示
        const translateButton = document.createElement('button');
        translateButton.textContent = '翻訳する';
        translateButton.className = 'translate-button';
        translateButton.addEventListener('click', () => this.translatePageContent());
        this.translationContent.appendChild(translateButton);
        this.translationContent.appendChild(document.createElement('hr'));
        
        // 構造化されたコンテンツがある場合は、それを表示
        if (response.structuredContent && response.structuredContent.length > 0) {
          console.log('構造化されたコンテンツを表示します:', response.structuredContent);
          this.displayStructuredContent(response.structuredContent);
        } 
        // HTML形式のコンテンツがある場合は、それを表示
        else if (response.htmlContent) {
          console.log('HTML形式のコンテンツを表示します');
          this.displayHtmlContent(response.htmlContent);
        } 
        // それ以外の場合は、テキストコンテンツを表示
        else {
          console.log('テキストコンテンツを表示します');
          const contentElement = document.createElement('div');
          contentElement.textContent = response.content;
          this.translationContent.appendChild(contentElement);
        }
      } else {
        this.translationContent.textContent = 'ページコンテンツの取得に失敗しました';
      }
    } catch (error) {
      console.error('ページコンテンツの取得に失敗しました:', error);
      this.translationContent.textContent = 'ページコンテンツの取得に失敗しました';
    }
  }
  
  /**
   * ページコンテンツを翻訳する
   */
  private async translatePageContent() {
    if (!this.currentTabId) {
      this.showTranslationStatus('アクティブなタブが見つかりません', false);
      return;
    }
    
    console.log('ページコンテンツを翻訳します。タブID:', this.currentTabId);
    
    try {
      // 翻訳中の表示
      const translateButton = this.translationContent.querySelector('.translate-button');
      if (translateButton) {
        translateButton.textContent = '翻訳中...';
        translateButton.setAttribute('disabled', 'true');
      }
      
      // 翻訳リクエストを送信
      console.log('メッセージを送信します:', { type: 'TRANSLATE_PAGE' }, 'タブID:', this.currentTabId);
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'TRANSLATE_PAGE'
      });
      console.log('メッセージの応答を受信しました:', response);
      
      if (response.success) {
        this.showTranslationStatus('翻訳が完了しました', true);
        
        // 翻訳後にページコンテンツを再読み込み
        await this.loadTranslatedContent();
      } else {
        this.showTranslationStatus('翻訳に失敗しました: ' + (response.error || '不明なエラー'), false);
        
        // ボタンを元に戻す
        if (translateButton) {
          translateButton.textContent = '翻訳する';
          translateButton.removeAttribute('disabled');
        }
      }
    } catch (error) {
      console.error('翻訳に失敗しました:', error);
      this.showTranslationStatus('翻訳に失敗しました', false);
      
      // ボタンを元に戻す
      const translateButton = this.translationContent.querySelector('.translate-button');
      if (translateButton) {
        translateButton.textContent = '翻訳する';
        translateButton.removeAttribute('disabled');
      }
    }
  }
  
  /**
   * 翻訳されたコンテンツを読み込む
   */
  private async loadTranslatedContent() {
    if (!this.currentTabId) {
      return;
    }
    
    console.log('翻訳されたコンテンツを取得します。タブID:', this.currentTabId);
    
    try {
      // 翻訳されたコンテンツを取得
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'GET_PAGE_CONTENT'
      });
      
      if (response.success) {
        // 翻訳ボタンを更新
        const translateButton = this.translationContent.querySelector('.translate-button');
        if (translateButton) {
          translateButton.textContent = '翻訳済み';
          translateButton.setAttribute('disabled', 'true');
        }
        
        // 翻訳されたコンテンツを表示するコンテナ
        const translatedContainer = document.createElement('div');
        translatedContainer.className = 'translated-content';
        
        // 翻訳されたコンテンツを表示
        if (response.translatedStructuredContent && response.translatedStructuredContent.length > 0) {
          console.log('翻訳された構造化コンテンツを表示します');
          this.displayStructuredContent(response.translatedStructuredContent, translatedContainer);
        }
        else if (response.translatedHtmlContent) {
          console.log('翻訳されたHTML形式のコンテンツを表示します');
          this.displayHtmlContent(response.translatedHtmlContent, translatedContainer);
        }
        else if (response.translatedContent) {
          console.log('翻訳されたテキストコンテンツを表示します');
          const contentElement = document.createElement('div');
          contentElement.textContent = response.translatedContent;
          translatedContainer.appendChild(contentElement);
        }
        else {
          console.log('翻訳されたコンテンツがありません');
          return;
        }
        
        // 既存のコンテンツを置き換え
        const existingContent = this.translationContent.querySelector('.structured-content, .html-content');
        if (existingContent) {
          this.translationContent.replaceChild(translatedContainer, existingContent);
        } else {
          // 既存のコンテンツがない場合は、翻訳ボタンの後に追加
          const hr = this.translationContent.querySelector('hr:last-of-type');
          if (hr) {
            this.translationContent.insertBefore(translatedContainer, hr.nextSibling);
          } else {
            this.translationContent.appendChild(translatedContainer);
          }
        }
      }
    } catch (error) {
      console.error('翻訳されたコンテンツの取得に失敗しました:', error);
    }
  }
  
  /**
   * 構造化されたコンテンツを表示する
   * @param structuredContent 構造化されたコンテンツ
   * @param targetContainer 表示先のコンテナ（省略時は翻訳コンテンツに追加）
   */
  private displayStructuredContent(structuredContent: Array<{
    type: string;
    content: string;
    tag?: string;
    attributes?: Record<string, string>;
  }>, targetContainer?: HTMLElement) {
    const container = targetContainer || document.createElement('div');
    if (!targetContainer) {
      container.className = 'structured-content';
    }
    
    structuredContent.forEach(item => {
      let element: HTMLElement;
      
      switch (item.type) {
        case 'heading':
          // h1-h6タグを作成
          element = document.createElement(item.tag || 'h3');
          element.textContent = item.content;
          break;
          
        case 'paragraph':
          element = document.createElement('p');
          element.textContent = item.content;
          break;
          
        case 'list':
          // ulまたはolタグを作成
          element = document.createElement(item.tag === 'ol' ? 'ol' : 'ul');
          
          // リストアイテムを作成
          const items = item.content.split('\n');
          items.forEach(itemText => {
            if (itemText.trim()) {
              const li = document.createElement('li');
              li.textContent = itemText;
              element.appendChild(li);
            }
          });
          break;
          
        case 'code':
          // preタグとcodeタグを作成
          const pre = document.createElement('pre');
          element = document.createElement('code');
          element.textContent = item.content;
          pre.appendChild(element);
          element = pre;
          break;
          
        case 'image':
          element = document.createElement('div');
          element.className = 'image-placeholder';
          
          // 画像の代替テキストを表示
          const altText = document.createElement('span');
          altText.textContent = `[画像: ${item.content || '説明なし'}]`;
          element.appendChild(altText);
          break;
          
        default:
          element = document.createElement('div');
          element.textContent = item.content;
      }
      
      // 属性を設定
      if (item.attributes) {
        Object.entries(item.attributes).forEach(([key, value]) => {
          // src, href, onclickなどの危険な属性は設定しない
          if (!['src', 'href', 'onclick', 'onerror', 'onload'].includes(key)) {
            element.setAttribute(key, value);
          }
        });
      }
      
      container.appendChild(element);
    });
    
    this.translationContent.appendChild(container);
  }
  
  /**
   * HTML形式のコンテンツを表示する
   * @param htmlContent HTML形式のコンテンツ
   * @param targetContainer 表示先のコンテナ（省略時は翻訳コンテンツに追加）
   */
  private displayHtmlContent(htmlContent: string, targetContainer?: HTMLElement) {
    // 安全なHTMLを表示するためのコンテナ
    const container = targetContainer || document.createElement('div');
    if (!targetContainer) {
      container.className = 'html-content';
    }
    
    try {
      // DOMParserを使用してHTMLを解析
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // 危険なタグと属性を削除
      this.sanitizeHtml(doc.body);
      
      // コンテンツを追加
      container.innerHTML = doc.body.innerHTML;
    } catch (error) {
      console.error('HTML形式のコンテンツの表示に失敗しました:', error);
      container.textContent = 'HTML形式のコンテンツの表示に失敗しました';
    }
    
    this.translationContent.appendChild(container);
  }
  
  /**
   * HTMLを安全にする
   * @param element 安全にする要素
   */
  private sanitizeHtml(element: Element) {
    // 危険なタグを削除
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link'];
    
    // 再帰的に処理
    const processNode = (node: Element) => {
      // 子ノードを配列に変換（ライブコレクションの変更を避けるため）
      const childNodes = Array.from(node.children);
      
      childNodes.forEach(child => {
        // 危険なタグを削除
        if (dangerousTags.includes(child.tagName.toLowerCase())) {
          node.removeChild(child);
          return;
        }
        
        // 危険な属性を削除
        Array.from(child.attributes).forEach(attr => {
          // イベントハンドラ属性やJavaScriptを含む属性を削除
          if (attr.name.startsWith('on') || 
              attr.value.includes('javascript:') ||
              (attr.name === 'href' && attr.value.includes('javascript:'))) {
            child.removeAttribute(attr.name);
          }
        });
        
        // 子要素を再帰的に処理
        if (child.children.length > 0) {
          processNode(child);
        }
      });
    };
    
    processNode(element);
  }

  /**
   * 設定をストレージに保存する
   */
  private async saveSettingsToStorage() {
    try {
      const settings: TranslationSettings = {
        apiKey: this.apiKeyInput.value,
        tone: this.toneSelect.value as 'casual' | 'formal' | 'technical',
        cacheExpiration: parseInt(this.cacheExpirationInput.value) || 5
      };
      
      console.log('サイドパネルから保存する設定:', settings);
      console.log('APIキー（一部マスク済み）:', settings.apiKey.substring(0, 10) + '...');
      
      const response = await browser.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings
      });
      
      if (response.success) {
        this.settings = settings;
        this.showSettingsStatus('設定を保存しました', true);
        console.log('設定の保存に成功しました');
      } else {
        this.showSettingsStatus('設定の保存に失敗しました', false);
        console.error('設定の保存に失敗しました:', response.error);
      }
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      this.showSettingsStatus('設定の保存に失敗しました', false);
    }
  }

  /**
   * 設定ステータスを表示する
   * @param message 表示するメッセージ
   * @param isSuccess 成功かどうか
   */
  private showSettingsStatus(message: string, isSuccess: boolean) {
    this.settingsStatus.textContent = message;
    this.settingsStatus.className = 'status ' + (isSuccess ? 'success' : 'error');
    this.settingsStatus.style.display = 'block';
    
    // 3秒後に非表示にする
    setTimeout(() => {
      this.settingsStatus.style.display = 'none';
    }, 3000);
  }

  /**
   * 翻訳ステータスを表示する
   * @param message 表示するメッセージ
   * @param isSuccess 成功かどうか
   */
  private showTranslationStatus(message: string, isSuccess: boolean) {
    this.translationStatus.textContent = message;
    this.translationStatus.className = 'status ' + (isSuccess ? 'success' : 'error');
    this.translationStatus.style.display = 'block';
    
    // 3秒後に非表示にする
    setTimeout(() => {
      this.translationStatus.style.display = 'none';
    }, 3000);
  }

  /**
   * 翻訳を切り替える
   */
  private async toggleTranslation() {
    if (!this.currentTabId) {
      this.showTranslationStatus('アクティブなタブが見つかりません', false);
      return;
    }
    
    console.log('翻訳を切り替えます。タブID:', this.currentTabId);
    
    try {
      console.log('メッセージを送信します:', { type: 'TRANSLATE_PAGE' }, 'タブID:', this.currentTabId);
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'TRANSLATE_PAGE'
      });
      console.log('メッセージの応答を受信しました:', response);
      
      if (response.success) {
        const status = response.isTranslating ? '翻訳を開始しました' : '翻訳をリセットしました';
        this.showTranslationStatus(status, true);
        
        // 翻訳後にページコンテンツを再読み込み
        await this.loadPageContent();
      } else {
        this.showTranslationStatus('翻訳の切り替えに失敗しました', false);
      }
    } catch (error) {
      console.error('翻訳の切り替えに失敗しました:', error);
      this.showTranslationStatus('翻訳の切り替えに失敗しました', false);
    }
  }

  /**
   * ページをリフレッシュする
   */
  private async refreshPage() {
    if (!this.currentTabId) {
      this.showTranslationStatus('アクティブなタブが見つかりません', false);
      return;
    }
    
    console.log('ページをリフレッシュします。タブID:', this.currentTabId);
    
    try {
      console.log('メッセージを送信します:', { type: 'RESET_TRANSLATION' }, 'タブID:', this.currentTabId);
      await browser.tabs.sendMessage(this.currentTabId, {
        type: 'RESET_TRANSLATION'
      });
      
      // ページコンテンツを再読み込み
      await this.loadPageContent();
    } catch (error) {
      console.error('ページのリフレッシュに失敗しました:', error);
      this.showTranslationStatus('ページのリフレッシュに失敗しました', false);
    }
  }

  /**
   * チャットメッセージを送信する
   */
  private async sendChatMessage() {
    const query = this.chatInput.value.trim();
    
    if (!query) {
      return;
    }
    
    if (!this.currentTabId) {
      this.addChatMessage('アクティブなタブが見つかりません', 'assistant');
      return;
    }
    
    console.log('チャットメッセージを送信します。タブID:', this.currentTabId);
    
    // ユーザーメッセージを表示
    this.addChatMessage(query, 'user');
    
    // 入力欄をクリア
    this.chatInput.value = '';
    
    try {
      // バックグラウンドスクリプトにチャットクエリを送信
      console.log('メッセージを送信します:', { type: 'CHAT_QUERY', query }, 'タブID:', this.currentTabId);
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'CHAT_QUERY',
        query
      });
      console.log('メッセージの応答を受信しました:', response);
      
      if (response.success && response.response) {
        this.addChatMessage(response.response, 'assistant');
      } else {
        this.addChatMessage('応答の生成に失敗しました: ' + (response.error || '不明なエラー'), 'assistant');
      }
    } catch (error) {
      console.error('チャットメッセージの送信に失敗しました:', error);
      this.addChatMessage('メッセージの送信に失敗しました', 'assistant');
    }
  }

  /**
   * チャットメッセージを追加する
   * @param content メッセージの内容
   * @param role メッセージの送信者（'user' または 'assistant'）
   */
  private addChatMessage(content: string, role: 'user' | 'assistant') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${role}`;
    messageElement.textContent = content;
    
    this.chatMessages.appendChild(messageElement);
    
    // スクロールを最下部に移動
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
}

// サイドパネルのインスタンスを作成して初期化
document.addEventListener('DOMContentLoaded', () => {
  const sidePanel = new SidePanel();
  sidePanel.initialize();
});
