import { TranslationSettings } from '@/types';
import { getSettings } from './storage';

/**
 * OpenAI APIクライアントクラス
 */
export class ApiClient {
  private settings: TranslationSettings | null = null;

  /**
   * APIクライアントを初期化する
   */
  async initialize(): Promise<boolean> {
    try {
      this.settings = await getSettings();
      
      if (!this.settings || !this.settings.apiKey) {
        console.warn('APIキーが設定されていません');
        return false;
      }
      
      console.log('APIクライアントを初期化しています...');
      
      // APIキーの最初の10文字と最後の5文字を表示（セキュリティのため）
      const apiKey = this.settings.apiKey;
      const maskedApiKey = apiKey.length > 15 
        ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`
        : apiKey;
      
      console.log('使用するAPIキー（一部マスク済み）:', maskedApiKey);
      
      console.log('APIクライアントの初期化が完了しました');
      return true;
    } catch (error) {
      console.error('APIクライアントの初期化に失敗しました:', error);
      return false;
    }
  }

  /**
   * テキストを翻訳する
   * @param text 翻訳するテキスト
   * @returns 翻訳されたテキスト
   */
  async translateText(text: string): Promise<string> {
    // 入力テキストが空の場合は処理しない
    if (!text || text.trim().length === 0) {
      console.warn('翻訳するテキストが空です');
      return text;
    }
    
    if (!this.settings) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('APIクライアントが初期化されていません');
      }
    }

    try {
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

      const instructions = `あなたは高品質な英日翻訳を行うアシスタントです。特にプログラミング関連のコンテンツの翻訳に特化しています。
以下の英語テキストを日本語に翻訳してください。${toneInstruction}翻訳してください。

重要なルール:
1. プログラミングコードやコマンド、変数名、関数名、クラス名などの技術的な名前は翻訳せず、そのまま残してください。
2. コード内のコメントは翻訳してください。
3. 技術的な概念は適切な日本語の専門用語に翻訳してください。
4. マークダウン形式は保持してください。
5. 原文の意味を正確に伝えることを優先してください。`;

      // APIキーの確認
      if (!this.settings?.apiKey) {
        throw new Error('APIキーが設定されていません');
      }
      
      // APIキーの最初の5文字を表示（セキュリティのため）
      const maskedApiKey = this.settings.apiKey.substring(0, 5) + '...';
      console.log('[OpenAI API] 使用するAPIキー（マスク済み）:', maskedApiKey);
      
      // OpenAI APIリクエストの詳細をログに出力
      const requestBody = {
        model: 'gpt-4o',
        instructions: instructions,
        input: text,
        temperature: 0.3
      };
      
      console.log('[OpenAI API] リクエスト詳細:', {
        endpoint: 'https://api.openai.com/v1/responses',
        model: requestBody.model,
        inputLength: text.length,
        temperature: requestBody.temperature
      });
      
      // プロンプトの詳細をログに出力
      console.log('[OpenAI API] プロンプト詳細:', {
        instructions: instructions
      });
      
      // 送信するテキストを明確に表示
      console.log('[OpenAI API] 送信テキスト: >>>\n' + text + '\n<<<');
      
      // 重複したAPIキーの確認と表示を削除
      
      // OpenAI APIを直接呼び出す
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI APIエラー詳細:', errorData);
        
        // エラーメッセージからURLを削除
        let errorMessage = errorData.error?.message || response.statusText;
        errorMessage = errorMessage.replace(/You can find your API key at https:\/\/platform\.openai\.com\/account\/api-keys/, '');
        
        throw new Error(`API Error: ${errorMessage}`);
      }
      
      const data = await response.json();
      console.log('[OpenAI API] レスポンス受信:', {
        status: response.status,
        responseType: Object.keys(data).join(', ')
      });
      
      // レスポンスの詳細をログに出力
      console.log('[OpenAI API] レスポンス詳細:', data);
      
      // レスポンスの形式に応じて適切なフィールドを取得
      const translatedText = data.output || data.output_text || data.choices?.[0]?.message?.content || text;
      console.log('[OpenAI API] 翻訳結果:', translatedText);
      
      return translatedText;
    } catch (error) {
      console.error('OpenAI APIリクエストに失敗しました:', error);
      throw error;
    }
  }

  /**
   * チャット応答を生成する
   * @param question ユーザーの質問
   * @param context ページコンテキスト
   * @returns 生成された応答
   */
  async generateChatResponse(question: string, context: string): Promise<string> {
    // 質問または文脈が空の場合は処理しない
    if (!question || question.trim().length === 0) {
      console.warn('質問が空です');
      return '質問が空です。質問を入力してください。';
    }
    
    if (!context || context.trim().length === 0) {
      console.warn('ページコンテキストが空です');
      return 'ページコンテンツが取得できませんでした。別のページで試してください。';
    }
    
    if (!this.settings) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('APIクライアントが初期化されていません');
      }
    }

    try {
      const tone = this.settings?.tone || 'casual';
      
      const instructions = `あなたはウェブページの内容に基づいて質問に答えるアシスタントです。
以下のウェブページの内容に基づいて、ユーザーの質問に日本語で回答してください。

回答の際のルール:
1. ウェブページの内容に基づいて回答してください。
2. 情報が不足している場合は、その旨を伝えてください。
3. コードに関する質問の場合は、具体的な例を示してください。
4. 回答は日本語で、${tone === 'formal' ? '丁寧な口調' : '親しみやすい口調'}で行ってください。`;

      const input = `ウェブページの内容:
${context}

ユーザーの質問:
${question}`;

      // APIキーの確認
      if (!this.settings?.apiKey) {
        throw new Error('APIキーが設定されていません');
      }
      
      // APIキーの最初の5文字を表示（セキュリティのため）
      const maskedApiKey = this.settings.apiKey.substring(0, 5) + '...';
      console.log('[OpenAI API] 使用するAPIキー（マスク済み）:', maskedApiKey);
      
      // OpenAI APIリクエストの詳細をログに出力
      const requestBody = {
        model: 'gpt-4o',
        instructions: instructions,
        input: input,
        temperature: 0.7
      };
      
      console.log('[OpenAI API] チャット応答リクエスト詳細:', {
        endpoint: 'https://api.openai.com/v1/responses',
        model: requestBody.model,
        question: question,
        contextLength: context.length,
        temperature: requestBody.temperature
      });
      
      // プロンプトの詳細をログに出力
      console.log('[OpenAI API] チャット応答プロンプト詳細:', {
        instructions: instructions,
        question: question,
        contextLength: context.length
      });
      
      // 重複したAPIキーの確認と表示を削除
      
      // OpenAI APIを直接呼び出す
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('チャット応答 OpenAI APIエラー詳細:', errorData);
        
        // エラーメッセージからURLを削除
        let errorMessage = errorData.error?.message || response.statusText;
        errorMessage = errorMessage.replace(/You can find your API key at https:\/\/platform\.openai\.com\/account\/api-keys/, '');
        
        throw new Error(`API Error: ${errorMessage}`);
      }
      
      const data = await response.json();
      console.log('[OpenAI API] チャット応答レスポンス受信:', {
        status: response.status,
        responseType: Object.keys(data).join(', ')
      });
      
      // レスポンスの詳細をログに出力
      console.log('[OpenAI API] チャット応答レスポンス詳細:', data);
      
      // レスポンスの形式に応じて適切なフィールドを取得
      const responseText = data.output || data.output_text || data.choices?.[0]?.message?.content || '申し訳ありませんが、回答を生成できませんでした。';
      console.log('[OpenAI API] チャット応答結果:', responseText);
      
      return responseText;
    } catch (error) {
      console.error('チャット応答の生成に失敗しました:', error);
      throw error;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const apiClient = new ApiClient();
