import browser from 'webextension-polyfill';
import { getSettings, saveSettings, savePageContext, getPageContext } from '@/utils/storage';
import { apiClient } from '@/utils/apiClient';
import { PageContext } from '@/types';

/**
 * バックグラウンドスクリプトの初期化
 */
async function initialize() {
  console.log('Code Preserve Translator: バックグラウンドスクリプトを初期化しています');
  
  // 拡張機能のインストール/更新時の処理
  browser.runtime.onInstalled.addListener(details => {
    if (details.reason === 'install') {
      // 初回インストール時の処理
      console.log('Code Preserve Translator: 初回インストール');
      // インストール時のポップアップを表示しない
    } else if (details.reason === 'update') {
      // 更新時の処理
      console.log(`Code Preserve Translator: バージョン ${browser.runtime.getManifest().version} に更新されました`);
    }
  });
  
  // アイコンがクリックされたときの処理
  browser.action.onClicked.addListener(async (tab) => {
    // サイドパネルを開く
    try {
      // TypeScriptの型定義にsidePanelがないため、anyにキャストして回避
      const browserAny = browser as any;
      if (browserAny.sidePanel && browserAny.sidePanel.open) {
        await browserAny.sidePanel.open({ tabId: tab.id });
      }
    } catch (error) {
      console.error('サイドパネルを開けませんでした:', error);
    }
  });
  
  // メッセージリスナーの設定
  setupMessageListeners();
}

/**
 * メッセージリスナーの設定
 */
function setupMessageListeners() {
  browser.runtime.onMessage.addListener(async (message) => {
    console.log('メッセージを受信しました:', message.type);
    
    switch (message.type) {
      case 'TRANSLATE_TEXT':
        return handleTranslateText(message.text);
        
      case 'SAVE_PAGE_CONTEXT':
        return handleSavePageContext(message.context);
        
      case 'GET_PAGE_CONTEXT':
        return handleGetPageContext(message.url);
        
      case 'CHAT_QUERY':
        return handleChatQuery(message.query, message.url);
        
      case 'GET_SETTINGS':
        return handleGetSettings();
        
      case 'SAVE_SETTINGS':
        return handleSaveSettings(message.settings);
        
      default:
        console.warn('不明なメッセージタイプ:', message.type);
        return { success: false, error: '不明なメッセージタイプ' };
    }
  });
}

/**
 * テキスト翻訳リクエストの処理
 * @param text 翻訳するテキスト
 * @returns 翻訳結果
 */
async function handleTranslateText(text: string) {
  try {
    const translatedText = await apiClient.translateText(text);
    return { success: true, translatedText };
  } catch (error) {
    console.error('翻訳に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '翻訳に失敗しました' 
    };
  }
}


/**
 * ページコンテキスト保存リクエストの処理
 * @param context 保存するページコンテキスト
 * @returns 処理結果
 */
async function handleSavePageContext(context: PageContext) {
  try {
    await savePageContext(context);
    return { success: true };
  } catch (error) {
    console.error('ページコンテキストの保存に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'ページコンテキストの保存に失敗しました' 
    };
  }
}

/**
 * ページコンテキスト取得リクエストの処理
 * @param url ページのURL
 * @returns ページコンテキスト
 */
async function handleGetPageContext(url: string) {
  try {
    const context = await getPageContext(url);
    return { success: true, context };
  } catch (error) {
    console.error('ページコンテキストの取得に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'ページコンテキストの取得に失敗しました' 
    };
  }
}

/**
 * チャットクエリリクエストの処理
 * @param query ユーザーのクエリ
 * @param url ページのURL
 * @returns チャット応答
 */
async function handleChatQuery(query: string, url: string) {
  try {
    const context = await getPageContext(url);
    
    if (!context) {
      return { 
        success: false, 
        error: 'ページコンテキストが見つかりません' 
      };
    }
    
    const response = await apiClient.generateChatResponse(
      query, 
      context.content
    );
    
    // チャット履歴を更新
    context.chatHistory.push({
      role: 'user',
      content: query,
      timestamp: Date.now()
    });
    
    context.chatHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });
    
    // 更新されたコンテキストを保存
    await savePageContext(context);
    
    return { success: true, response };
  } catch (error) {
    console.error('チャットクエリの処理に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'チャットクエリの処理に失敗しました' 
    };
  }
}

/**
 * 設定取得リクエストの処理
 * @returns 設定
 */
async function handleGetSettings() {
  try {
    const settings = await getSettings();
    console.log('バックグラウンドスクリプトで取得した設定:', settings);
    return { success: true, settings };
  } catch (error) {
    console.error('設定の取得に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '設定の取得に失敗しました' 
    };
  }
}

/**
 * 設定保存リクエストの処理
 * @param settings 保存する設定
 * @returns 処理結果
 */
async function handleSaveSettings(settings: any) {
  try {
    console.log('バックグラウンドスクリプトで保存する設定:', settings);
    
    // APIキーの最初の10文字と最後の5文字を表示（セキュリティのため）
    const apiKey = settings.apiKey || '';
    const maskedApiKey = apiKey.length > 15 
      ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`
      : apiKey;
    
    console.log('保存するAPIキー（一部マスク済み）:', maskedApiKey);
    
    await saveSettings(settings);
    console.log('設定の保存に成功しました');
    return { success: true };
  } catch (error) {
    console.error('設定の保存に失敗しました:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '設定の保存に失敗しました' 
    };
  }
}

// バックグラウンドスクリプトの初期化
initialize();
