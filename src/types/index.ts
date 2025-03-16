/**
 * 翻訳設定のインターフェース
 */
export interface TranslationSettings {
  /** OpenAI APIキー */
  apiKey: string;
  /** 翻訳の口調 */
  tone: 'casual' | 'formal' | 'technical';
  /** キャッシュの有効期限（分） */
  cacheExpiration: number;
}

/**
 * 翻訳結果のインターフェース
 */
export interface TranslationResult {
  /** 原文テキスト */
  originalText: string;
  /** 翻訳されたテキスト */
  translatedText: string;
  /** 翻訳のタイムスタンプ */
  timestamp: number;
}

/**
 * コードブロック情報のインターフェース
 */
export interface CodeBlockInfo {
  /** コードブロックのID */
  id: string;
  /** コードブロックの内容 */
  content: string;
  /** コードブロックの言語（検出された場合） */
  language?: string;
  /** DOMでの位置情報 */
  position: {
    /** 親要素のセレクタ */
    parentSelector: string;
    /** インデックス */
    index: number;
  };
}

/**
 * チャットメッセージのインターフェース
 */
export interface ChatMessage {
  /** メッセージの送信者（'user' または 'assistant'） */
  role: 'user' | 'assistant';
  /** メッセージの内容 */
  content: string;
  /** メッセージのタイムスタンプ */
  timestamp: number;
}

/**
 * 構造化されたコンテンツ要素のインターフェース
 */
export interface StructuredContentElement {
  /** 要素のタイプ（heading, paragraph, list, code, image など） */
  type: string;
  /** 要素のテキスト内容 */
  content: string;
  /** HTML要素のタグ名（オプション） */
  tag?: string;
  /** HTML要素の属性（オプション） */
  attributes?: Record<string, string>;
}

/**
 * ページコンテキストのインターフェース
 */
export interface PageContext {
  /** ページのURL */
  url: string;
  /** ページのタイトル */
  title: string;
  /** ページの主要なテキスト内容 */
  content: string;
  /** ページのHTML形式のコンテンツ（オプション） */
  htmlContent?: string;
  /** 構造化されたコンテンツ（オプション） */
  structuredContent?: StructuredContentElement[];
  /** 翻訳されたテキストコンテンツ（オプション） */
  translatedContent?: string;
  /** 翻訳されたHTML形式のコンテンツ（オプション） */
  translatedHtmlContent?: string;
  /** 翻訳された構造化されたコンテンツ（オプション） */
  translatedStructuredContent?: StructuredContentElement[];
  /** 検出されたコードブロック */
  codeBlocks: CodeBlockInfo[];
  /** 翻訳済みのテキスト */
  translations: Record<string, TranslationResult>;
  /** チャット履歴 */
  chatHistory: ChatMessage[];
  /** 最終更新タイムスタンプ */
  lastUpdated: number;
}
