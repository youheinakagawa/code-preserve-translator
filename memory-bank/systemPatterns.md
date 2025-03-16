# システムパターン: Code Preserve Translator

## システムアーキテクチャ

Code Preserve Translatorは、Chrome拡張機能として実装され、以下の主要コンポーネントで構成されます：

```mermaid
flowchart TD
    UI[ユーザーインターフェース] --> ContentScript[コンテンツスクリプト]
    UI --> BackgroundScript[バックグラウンドスクリプト]
    ContentScript --> BackgroundScript
    BackgroundScript --> API[OpenAI API]
    BackgroundScript --> Storage[ローカルストレージ]
    ContentScript --> DOM[ウェブページDOM]
```

### 主要コンポーネント

1. **ユーザーインターフェース (UI)**
   - 拡張機能のポップアップインターフェース
   - 設定画面
   - チャットインターフェース

2. **コンテンツスクリプト**
   - ウェブページのDOMと直接対話
   - テキストとコードブロックの識別
   - 翻訳されたコンテンツの表示

3. **バックグラウンドスクリプト**
   - OpenAI APIとの通信
   - キャッシュ管理
   - コンテキスト記憶の管理

4. **ストレージ**
   - 設定の保存
   - 翻訳キャッシュ
   - ページコンテキストの保存

## 設計パターン

### 1. モジュール化アーキテクチャ

拡張機能は明確に分離されたモジュールで構成され、各モジュールは特定の責任を持ちます：

```mermaid
flowchart LR
    subgraph UI[ユーザーインターフェース]
        PopupUI[ポップアップUI]
        SettingsUI[設定UI]
        ChatUI[チャットUI]
    end
    
    subgraph Core[コア機能]
        Translator[翻訳エンジン]
        ContextManager[コンテキスト管理]
        CacheManager[キャッシュ管理]
    end
    
    subgraph Integration[統合]
        APIClient[API クライアント]
        DOMHandler[DOM ハンドラー]
        StorageManager[ストレージ管理]
    end
    
    UI --> Core
    Core --> Integration
```

### 2. オブザーバーパターン

DOM変更を監視し、新しいコンテンツが追加されたときに翻訳を適用します：

```mermaid
sequenceDiagram
    participant DOM as ウェブページDOM
    participant Observer as MutationObserver
    participant Handler as コンテンツハンドラー
    participant Translator as 翻訳エンジン
    
    DOM->>Observer: DOM変更
    Observer->>Handler: 変更通知
    Handler->>Handler: コンテンツ分析
    Handler->>Translator: 翻訳リクエスト
    Translator->>Handler: 翻訳結果
    Handler->>DOM: 翻訳コンテンツ適用
```

### 3. キャッシュ戦略

パフォーマンス最適化のための多層キャッシュ：

```mermaid
flowchart TD
    Request[翻訳リクエスト] --> MemCheck[メモリキャッシュ確認]
    MemCheck -->|ヒット| MemReturn[メモリから返却]
    MemCheck -->|ミス| LocalCheck[ローカルストレージ確認]
    LocalCheck -->|ヒット| LocalReturn[ストレージから返却]
    LocalCheck -->|ミス| APICall[API呼び出し]
    APICall --> StoreCache[キャッシュに保存]
    StoreCache --> Return[結果返却]
```

### 4. コマンドパターン

ユーザーアクションを抽象化し、一貫した方法で処理：

```mermaid
classDiagram
    class Command {
        +execute()
    }
    class TranslateCommand {
        +execute()
    }
    class ChatCommand {
        +execute()
    }
    class RefreshCommand {
        +execute()
    }
    
    Command <|-- TranslateCommand
    Command <|-- ChatCommand
    Command <|-- RefreshCommand
```

## コンポーネント間の関係

### データフロー

```mermaid
flowchart LR
    subgraph Input[入力]
        WebPage[ウェブページ]
        UserSettings[ユーザー設定]
        UserQuery[ユーザークエリ]
    end
    
    subgraph Processing[処理]
        ContentExtractor[コンテンツ抽出]
        Translator[翻訳エンジン]
        ChatEngine[チャットエンジン]
    end
    
    subgraph Storage[ストレージ]
        Cache[キャッシュ]
        Context[コンテキスト]
        Settings[設定]
    end
    
    subgraph Output[出力]
        TranslatedPage[翻訳ページ]
        ChatResponse[チャット応答]
    end
    
    WebPage --> ContentExtractor
    UserSettings --> Translator
    UserQuery --> ChatEngine
    
    ContentExtractor --> Translator
    ContentExtractor --> Context
    
    Translator --> Cache
    Translator --> TranslatedPage
    
    Context --> ChatEngine
    ChatEngine --> ChatResponse
```

### 状態管理

拡張機能の状態は以下のように管理されます：

1. **アクティブページ状態**
   - 現在のページのコンテンツ
   - 翻訳状態
   - 抽出されたコードブロック

2. **グローバル状態**
   - ユーザー設定
   - API設定
   - 翻訳履歴

3. **セッション状態**
   - 現在のチャットコンテキスト
   - ページ間のコンテキスト連続性

## 技術的制約と対応策

1. **Chrome拡張機能の制限**
   - コンテンツスクリプトとバックグラウンドスクリプト間の通信は、メッセージパッシングを使用
   - ローカルストレージの容量制限に対応するため、効率的なデータ構造を使用

2. **API制限**
   - OpenAI APIの呼び出し制限に対応するためのキャッシュ戦略
   - エラー処理とリトライメカニズム

3. **パフォーマンス考慮事項**
   - 大きなページでのDOM操作の最適化
   - バックグラウンド処理の効率化
