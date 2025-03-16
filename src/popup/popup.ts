import browser from 'webextension-polyfill';
import { TranslationSettings } from '@/types';

/**
 * ポップアップのメインクラス
 */
class Popup {
  private tabs!: NodeListOf<Element>;
  private tabContents!: NodeListOf<Element>;
  private translationToggle!: HTMLInputElement;
  private refreshButton!: HTMLButtonElement;
  private translationStatus!: HTMLElement;
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
   * ポップアップを初期化する
   */
  async initialize() {
    console.log('Code Preserve Translator: ポップアップを初期化しています');
    
    // 要素の取得
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    const translationToggle = document.getElementById('translation-toggle');
    const refreshButton = document.getElementById('refresh-button');
    const translationStatus = document.getElementById('translation-status');
    const apiKeyInput = document.getElementById('api-key');
    const toneSelect = document.getElementById('tone');
    const cacheExpirationInput = document.getElementById('cache-expiration');
    const saveSettingsButton = document.getElementById('save-settings');
    const settingsStatus = document.getElementById('settings-status');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    
    if (!translationToggle || !refreshButton || !translationStatus || !apiKeyInput || 
        !toneSelect || !cacheExpirationInput || !saveSettingsButton || !settingsStatus || 
        !chatInput || !sendButton || !chatMessages) {
      console.error('必要なDOM要素が見つかりません');
      return;
    }
    
    this.translationToggle = translationToggle as HTMLInputElement;
    this.refreshButton = refreshButton as HTMLButtonElement;
    this.translationStatus = translationStatus as HTMLElement;
    this.apiKeyInput = apiKeyInput as HTMLInputElement;
    this.toneSelect = toneSelect as HTMLSelectElement;
    this.cacheExpirationInput = cacheExpirationInput as HTMLInputElement;
    this.saveSettingsButton = saveSettingsButton as HTMLButtonElement;
    this.settingsStatus = settingsStatus as HTMLElement;
    this.chatInput = chatInput as HTMLTextAreaElement;
    this.sendButton = sendButton as HTMLButtonElement;
    this.chatMessages = chatMessages as HTMLElement;
    
    // 現在のタブIDを取得
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      this.currentTabId = tabs[0].id;
    }
    
    // 設定を読み込む
    await this.loadSettings();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // ウェルカムページの処理
    this.handleWelcomePage();
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
   * 設定をストレージに保存する
   */
  private async saveSettingsToStorage() {
    try {
      const settings: TranslationSettings = {
        apiKey: this.apiKeyInput.value,
        tone: this.toneSelect.value as 'casual' | 'formal' | 'technical',
        cacheExpiration: parseInt(this.cacheExpirationInput.value) || 5
      };
      
      const response = await browser.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings
      });
      
      if (response.success) {
        this.settings = settings;
        this.showSettingsStatus('設定を保存しました', true);
      } else {
        this.showSettingsStatus('設定の保存に失敗しました', false);
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
    
    try {
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'TRANSLATE_PAGE'
      });
      
      if (response.success) {
        const status = response.isTranslating ? '翻訳を開始しました' : '翻訳をリセットしました';
        this.showTranslationStatus(status, true);
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
    
    try {
      await browser.tabs.sendMessage(this.currentTabId, {
        type: 'RESET_TRANSLATION'
      });
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
    
    // ユーザーメッセージを表示
    this.addChatMessage(query, 'user');
    
    // 入力欄をクリア
    this.chatInput.value = '';
    
    try {
      // バックグラウンドスクリプトにチャットクエリを送信
      const response = await browser.tabs.sendMessage(this.currentTabId, {
        type: 'CHAT_QUERY',
        query
      });
      
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

  /**
   * ウェルカムページを処理する
   */
  private handleWelcomePage() {
    // URLのハッシュが#welcomeの場合はウェルカムページを表示
    if (window.location.hash === '#welcome') {
      // 設定タブに切り替え
      this.switchTab('settings');
      
      // ウェルカムメッセージを表示
      const settingsTab = document.getElementById('settings-tab');
      if (settingsTab) {
        const welcomeElement = document.createElement('div');
        welcomeElement.className = 'welcome';
        welcomeElement.innerHTML = `
          <h2>Code Preserve Translatorへようこそ！</h2>
          <p>この拡張機能を使用するには、OpenAI APIキーを設定してください。</p>
          <p>APIキーを入力し、他の設定をカスタマイズした後、「設定を保存」ボタンをクリックしてください。</p>
        `;
        
        settingsTab.insertBefore(welcomeElement, settingsTab.firstChild);
      }
    }
  }
}

// ポップアップのインスタンスを作成して初期化
document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();
  popup.initialize();
});
