# プロジェクト概要: Code Preserve Translator

## 目的
Google Chrome拡張機能として、ウェブページの翻訳機能を提供する。特にプログラミング関連のコンテンツを翻訳する際に、コードの理解を促進しながら正確な翻訳を行うことを目的とする。

## 主要機能
1. **英語から日本語への翻訳**
   - OpenAI APIを使用して翻訳を実行
   - プログラミングコンテキストを理解した翻訳

2. **インテリジェントなコード処理**
   - サンプルコード自体は翻訳しない
   - コード内のプロンプト、入出力例、コメントは翻訳する
   - 英語の機能名や変数名は保持する

3. **チャット機能**
   - 翻訳されたページの内容についてユーザーが質問できる
   - ページの内容を記憶し、質問応答に活用

4. **カスタマイズ可能な翻訳スタイル**
   - 翻訳文章の口調をユーザーが選択可能
   - デフォルトは軽い口調

5. **コンテキスト記憶**
   - ページ遷移後も閲覧内容を記憶
   - ユーザーが明示的にリフレッシュするまで記憶を保持

6. **パフォーマンス最適化**
   - 同一内容のAPI呼び出しは約5分間キャッシュ

7. **設定インターフェース**
   - API入力画面
   - 応答の口調選択画面
   - その他必要な設定オプション

## 技術要件
- Google Chrome拡張機能として実装
- OpenAI APIとの連携
- ローカルストレージを活用したコンテキスト記憶
- キャッシュ機能の実装

## 成功基準
- プログラミング関連コンテンツの翻訳精度の向上
- コードの理解を妨げない翻訳の提供
- ユーザーの質問に対する的確な回答
- 設定のカスタマイズ性
- パフォーマンスの最適化
