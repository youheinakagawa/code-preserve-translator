import { TranslationSettings, PageContext } from '@/types';
import browser from 'webextension-polyfill';

/**
 * デフォルトの翻訳設定
 */
export const DEFAULT_SETTINGS: TranslationSettings = {
  apiKey: '',
  tone: 'casual',
  cacheExpiration: 5 // 5分
};

/**
 * 設定を保存する
 * @param settings 保存する設定
 */
export async function saveSettings(settings: TranslationSettings): Promise<void> {
  console.log('保存する設定:', settings);
  await browser.storage.sync.set({ settings });
  console.log('設定を保存しました');
}

/**
 * 設定を取得する
 * @returns 保存されている設定、または存在しない場合はデフォルト設定
 */
export async function getSettings(): Promise<TranslationSettings> {
  const result = await browser.storage.sync.get('settings');
  console.log('取得した設定:', result.settings || DEFAULT_SETTINGS);
  return result.settings || DEFAULT_SETTINGS;
}

/**
 * APIキーを保存する
 * @param apiKey 保存するAPIキー
 */
export async function saveApiKey(apiKey: string): Promise<void> {
  const settings = await getSettings();
  settings.apiKey = apiKey;
  await saveSettings(settings);
}

/**
 * ページコンテキストを保存する
 * @param context 保存するページコンテキスト
 */
export async function savePageContext(context: PageContext): Promise<void> {
  const key = `page_${context.url}`;
  await browser.storage.local.set({ [key]: context });
  
  // 最近のページリストを更新
  const recentPages = await getRecentPages();
  const updatedPages = [
    context.url,
    ...recentPages.filter(url => url !== context.url)
  ].slice(0, 10); // 最大10ページまで保存
  
  await browser.storage.local.set({ recentPages: updatedPages });
}

/**
 * ページコンテキストを取得する
 * @param url ページのURL
 * @returns ページコンテキスト、または存在しない場合はnull
 */
export async function getPageContext(url: string): Promise<PageContext | null> {
  const key = `page_${url}`;
  const result = await browser.storage.local.get(key);
  return result[key] || null;
}

/**
 * 最近のページリストを取得する
 * @returns 最近アクセスしたページのURLリスト
 */
export async function getRecentPages(): Promise<string[]> {
  const result = await browser.storage.local.get('recentPages');
  return result.recentPages || [];
}

/**
 * 翻訳キャッシュを保存する
 * @param originalText 原文テキスト
 * @param translatedText 翻訳されたテキスト
 */
export async function saveTranslationCache(
  originalText: string,
  translatedText: string
): Promise<void> {
  const cacheKey = `cache_${hashString(originalText)}`;
  const cacheData = {
    originalText,
    translatedText,
    timestamp: Date.now()
  };
  
  await browser.storage.local.set({ [cacheKey]: cacheData });
  
  // キャッシュの管理（古いキャッシュの削除など）は定期的に実行
  await manageCache();
}

/**
 * 翻訳キャッシュを取得する
 * @param originalText 原文テキスト
 * @returns キャッシュされた翻訳結果、または存在しない場合はnull
 */
export async function getTranslationCache(originalText: string): Promise<{
  translatedText: string;
  timestamp: number;
} | null> {
  const cacheKey = `cache_${hashString(originalText)}`;
  const result = await browser.storage.local.get(cacheKey);
  return result[cacheKey] || null;
}

/**
 * キャッシュを管理する（古いキャッシュの削除など）
 */
async function manageCache(): Promise<void> {
  // 全てのキャッシュキーを取得
  const allItems = await browser.storage.local.get();
  const now = Date.now();
  const expirationTime = 7 * 24 * 60 * 60 * 1000; // 1週間
  
  const keysToRemove: string[] = [];
  
  // キャッシュキーを特定して古いものを削除
  for (const [key, value] of Object.entries(allItems)) {
    if (key.startsWith('cache_') && value.timestamp) {
      if (now - value.timestamp > expirationTime) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await browser.storage.local.remove(keysToRemove);
  }
}

/**
 * 文字列のハッシュ値を計算する（キャッシュキー用）
 * @param str ハッシュ化する文字列
 * @returns ハッシュ文字列
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return hash.toString(36);
}

/**
 * ストレージをクリアする
 * @param storageType クリアするストレージタイプ ('local' | 'sync' | 'all')
 */
export async function clearStorage(
  storageType: 'local' | 'sync' | 'all' = 'all'
): Promise<void> {
  if (storageType === 'local' || storageType === 'all') {
    await browser.storage.local.clear();
  }
  
  if (storageType === 'sync' || storageType === 'all') {
    await browser.storage.sync.clear();
  }
}
