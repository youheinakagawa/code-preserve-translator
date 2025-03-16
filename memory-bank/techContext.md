# 技術コンテキスト: Code Preserve Translator

## 使用技術

### フロントエンド
- **JavaScript/TypeScript**: 拡張機能の主要な開発言語
- **HTML/CSS**: ユーザーインターフェースの構築
- **Chrome Extension API**: 拡張機能の基盤
  - Content Scripts: ウェブページとの対話
  - Background Scripts: バックグラウンド処理
  - Storage API: データ保存
  - Message Passing: コンポーネント間通信

### バックエンド統合
- **OpenAI API**: 翻訳とチャット機能の提供
  - GPT-4: 高品質な翻訳と文脈理解
  - API Rate Limiting: 呼び出し制限の管理

### データ管理
- **Chrome Storage API**: 設定とキャッシュの保存
  - Local Storage: ページコンテキストとキャッシュ
  - Sync Storage: ユーザー設定

### 開発ツール
- **Node.js**: 開発環境
- **Webpack**: モジュールバンドル
- **ESLint/Prettier**: コード品質とフォーマット
- **Jest**: ユニットテスト
- **Chrome DevTools**: デバッグと検査

## 開発環境セットアップ

### 必要条件
- Node.js (v14以上)
- npm または yarn
- Chrome ブラウザ (開発用)

### 開発環境構築手順

1. **プロジェクトセットアップ**
   ```bash
   # リポジトリのクローン
   git clone https://github.com/username/code-preserve-translator.git
   cd code-preserve-translator

   # 依存関係のインストール
   npm install
   ```

2. **開発用ビルド**
   ```bash
   # 開発モードでビルド
   npm run dev
   ```

3. **Chrome拡張機能のロード**
   - Chromeで `chrome://extensions` を開く
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist` ディレクトリを選択

4. **OpenAI API設定**
   - OpenAI APIキーを取得
   - 拡張機能の設定画面でAPIキーを設定

## 技術的制約

### Chrome拡張機能の制約
1. **コンテンツセキュリティポリシー (CSP)**
   - インラインスクリプトの制限
   - 外部リソースへのアクセス制限

2. **権限モデル**
   - 必要な権限の明示的な宣言
   - ユーザーの許可が必要

3. **ストレージ制限**
   - Local Storageの容量制限 (5MB程度)
   - 効率的なデータ構造の必要性

### OpenAI API制約
1. **レート制限**
   - API呼び出し回数の制限
   - トークン使用量の制限

2. **レイテンシ**
   - API応答時間の変動
   - ユーザー体験への影響

3. **コスト**
   - API使用料金の最適化
   - 効率的なプロンプト設計の必要性

## 依存関係

### 主要な依存パッケージ
```json
{
  "dependencies": {
    "openai": "^4.0.0",        // OpenAI API クライアント
    "dompurify": "^3.0.0",     // DOM サニタイズ
    "marked": "^5.0.0",        // Markdown パーサー
    "lodash": "^4.17.21",      // ユーティリティ関数
    "webextension-polyfill": "^0.10.0" // ブラウザ互換性
  },
  "devDependencies": {
    "typescript": "^5.0.0",    // TypeScript コンパイラ
    "webpack": "^5.80.0",      // モジュールバンドラー
    "jest": "^29.5.0",         // テストフレームワーク
    "eslint": "^8.40.0",       // コード品質
    "prettier": "^2.8.8"       // コードフォーマッター
  }
}
```

### 外部サービス依存
1. **OpenAI API**
   - 翻訳機能の中核
   - チャット機能の提供
   - サービス可用性に依存

## パフォーマンス最適化

### キャッシュ戦略
- メモリ内キャッシュ: 頻繁にアクセスされる翻訳
- ローカルストレージキャッシュ: 永続的な翻訳保存
- キャッシュ有効期限: 5分 (設定可能)

### バッチ処理
- テキストブロックのバッチ翻訳
- DOM更新の最適化

### 非同期処理
- バックグラウンドでの翻訳処理
- UI応答性の維持

## セキュリティ考慮事項

### データ保護
- APIキーのセキュアな保存
- ユーザーデータの最小限の収集

### コンテンツセキュリティ
- DOMPurifyによる安全なHTML挿入
- XSS攻撃の防止

### プライバシー
- ローカル処理の優先
- 必要最小限のデータ送信
