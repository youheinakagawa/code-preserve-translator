import { TranslationSettings } from '@/types';
import { getSettings, getTranslationCache, saveTranslationCache } from './storage';
import { isCacheValid, splitTextIntoChunks, isCodeBlock } from './helpers';
import OpenAI from 'openai';

/**
 * 翻訳エンジンクラス
 */
export class TranslationEngine {
  private openai: OpenAI | null = null;
  private settings: TranslationSettings | null = null;

  /**
   * 翻訳エンジンを初期化する
   */
  async initialize(): Promise<boolean> {
    try {
      this.settings = await getSettings();
      
      if (!this.settings || !this.settings.apiKey) {
        console.warn('APIキーが設定されていません');
        return false;
      }
      
      this.openai = new OpenAI({
        apiKey: this.settings.apiKey,
        dangerouslyAllowBrowser: true // ブラウザ環境での使用を許可
      });
      
      return true;
    } catch (error) {
      console.error('翻訳エンジンの初期化に失敗しました:', error);
      return false;
    }
  }

  /**
   * テキストを翻訳する
   * @param text 翻訳するテキスト
   * @returns 翻訳されたテキスト
   */
  async translateText(text: string): Promise<string> {
    if (!this.openai || !this.settings) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('翻訳エンジンが初期化されていません');
      }
    }

    // コードブロックの場合は翻訳しない
    if (isCodeBlock(text)) {
      return text;
    }

    // キャッシュをチェック
    const cachedTranslation = await getTranslationCache(text);
    const cacheExpiration = this.settings ? this.settings.cacheExpiration : 5; // デフォルト値は5日
    if (cachedTranslation && cachedTranslation.translatedText && cachedTranslation.timestamp && isCacheValid(
      { 
        originalText: text, 
        translatedText: cachedTranslation.translatedText, 
        timestamp: cachedTranslation.timestamp 
      }, 
      cacheExpiration
    )) {
      return cachedTranslation.translatedText;
    }

    try {
      // テキストが長い場合は分割して翻訳
      if (text.length > 4000) {
        const chunks = splitTextIntoChunks(text);
        const translatedChunks = await Promise.all(
          chunks.map(chunk => this.callTranslationAPI(chunk))
        );
        const translatedText = translatedChunks.join(' ');
        
        // キャッシュに保存
        await saveTranslationCache(text, translatedText);
        
        return translatedText;
      } else {
        const translatedText = await this.callTranslationAPI(text);
        
        // キャッシュに保存
        await saveTranslationCache(text, translatedText);
        
        return translatedText;
      }
    } catch (error) {
      console.error('翻訳に失敗しました:', error);
      throw error;
    }
  }

  /**
   * 翻訳APIを呼び出す
   * @param text 翻訳するテキスト
   * @returns 翻訳されたテキスト
   */
  private async callTranslationAPI(text: string): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI APIが初期化されていません');
    }

    const tone = this.settings?.tone || 'casual';
    let toneInstruction = '';
    
    switch (tone) {
      case 'casual':
        toneInstruction = '軽い口調で、親しみやすく';
        break;
      case 'formal':
        toneInstruction = '丁寧な口調で、フォーマルに';
        break;
      case 'technical':
        toneInstruction = '技術的な口調で、専門用語を適切に使用して';
        break;
    }

    const prompt = `
以下の英語テキストを日本語に翻訳してください。${toneInstruction}翻訳してください。

重要なルール:
1. プログラミングコードやコマンド、変数名、関数名、クラス名などの技術的な名前は翻訳せず、そのまま残してください。
2. コード内のコメントは翻訳してください。
3. 技術的な概念は適切な日本語の専門用語に翻訳してください。
4. マークダウン形式は保持してください。
5. 原文の意味を正確に伝えることを優先してください。

テキスト:
${text}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは高品質な英日翻訳を行うアシスタントです。特にプログラミング関連のコンテンツの翻訳に特化しています。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    return response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content ? response.choices[0].message.content : text;
  }

  /**
   * チャット応答を生成する
   * @param question ユーザーの質問
   * @param context ページコンテキスト
   * @returns 生成された応答
   */
  async generateChatResponse(question: string, context: string): Promise<string> {
    if (!this.openai || !this.settings) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('翻訳エンジンが初期化されていません');
      }
    }

    try {
      // 設定が初期化されていない場合のデフォルト値
      const tone = this.settings ? this.settings.tone : 'casual';
      
      const prompt = `
以下のウェブページの内容に基づいて、ユーザーの質問に日本語で回答してください。

ウェブページの内容:
${context}

ユーザーの質問:
${question}

回答の際のルール:
1. ウェブページの内容に基づいて回答してください。
2. 情報が不足している場合は、その旨を伝えてください。
3. コードに関する質問の場合は、具体的な例を示してください。
4. 回答は日本語で、${tone === 'formal' ? '丁寧な口調' : '親しみやすい口調'}で行ってください。
`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'あなたはウェブページの内容に基づいて質問に答えるアシスタントです。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      return response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content ? response.choices[0].message.content : '申し訳ありませんが、回答を生成できませんでした。';
    } catch (error) {
      console.error('チャット応答の生成に失敗しました:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const translationEngine = new TranslationEngine();
