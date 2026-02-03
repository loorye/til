# 思考実験 比較デモ Webアプリ

GPT / Gemini / Claude を同一プロンプト・同一JSONスキーマで呼び出し、思考実験の二択結果を横並び比較するワークショップ用デモです。

## セットアップ

```bash
npm install
```

### 環境変数

```bash
cp .env.example .env
```

- `MOCK_MODE=true` の場合は外部APIを呼び出さず、擬似レスポンスを返します。
- `MOCK_MODE=false` の場合は各APIキーを設定してください。
- `DISABLE_AUTH=true` でBasic認証を無効化（ローカル開発時推奨）
- 本番環境では `AUTH_USERNAME` と `AUTH_PASSWORD` を必ず変更してください。

## 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスします。

## APIキー設定方法

`.env` に以下を設定してください（ClaudeはAWS Bedrock経由、AWS SDKの認証情報プロバイダチェーンを利用）。

```bash
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_SESSION_TOKEN=your_aws_session_token
OPENAI_MODEL=gpt-4o-mini
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
GEMINI_MODEL=gemini-1.0-pro
```

## 当日の運用手順

1. `MOCK_MODE=true` で動作確認（通信が不要なため安定）。
2. 本番時は `MOCK_MODE=false` に切り替え、APIキーが有効か確認。
3. 「再実行（同一入力）」ボタンで再現性チェック。
4. 履歴テーブルから入力を復元し、比較を繰り返す。

## トラブル時の対処

- **JSON崩れ/パース失敗**
  - API側で自動的に1回リトライします。それでも失敗した場合は該当モデルだけエラー表示します。
- **タイムアウト/通信エラー**
  - `MOCK_MODE=true` に切り替えるとデモ継続が可能です。
- **キー未設定**
  - そのモデルのみエラー表示になります。

## 主な構成

- `app/page.tsx`: UI（フォーム / 結果 / 履歴）
- `app/api/eval/route.ts`: 3モデル呼び出しAPI
- `lib/cases.ts`: ケース定義
- `lib/principles.ts`: 判断原理定義
- `lib/schema.ts`: Zodスキーマ
- `lib/providers/*`: APIプロバイダ

## AWS Amplifyへのデプロイ

### 1. Amplifyコンソールでアプリを作成

1. [AWS Amplify Console](https://console.aws.amazon.com/amplify/)にアクセス
2. 「新しいアプリ」→「ホスティング」を選択
3. GitHubまたはその他のGitプロバイダーと連携
4. リポジトリとブランチを選択

### 2. ビルド設定

`amplify.yml`が自動検出されます。検出されない場合は以下を使用：

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 3. 環境変数の設定

Amplifyコンソールの「環境変数」セクションで以下を設定：

**認証設定（推奨）:**
- `AUTH_USERNAME`: Basic認証のユーザー名（例: `admin`）
- `AUTH_PASSWORD`: Basic認証のパスワード（強力なパスワードを設定）
- `DISABLE_AUTH`: 認証を無効化する場合は `true`（非推奨）

**必須（MOCK_MODE=false の場合）:**
- `OPENAI_API_KEY`: OpenAI APIキー
- `GOOGLE_API_KEY`: Google APIキー（Gemini用）
- `AWS_ACCESS_KEY_ID`: AWS認証情報
- `AWS_SECRET_ACCESS_KEY`: AWS認証情報

**オプション:**
- `MOCK_MODE`: `true`（デモモード）/ `false`（本番モード）
- `NEXT_PUBLIC_MOCK_MODE`: `true` / `false`（クライアント側）
- `AWS_SESSION_TOKEN`: AWS一時認証トークン（必要な場合）
- `OPENAI_MODEL`: `gpt-4o-mini`（デフォルト）
- `BEDROCK_REGION`: `us-east-1`（デフォルト）
- `BEDROCK_MODEL_ID`: `anthropic.claude-3-5-sonnet-20240620-v1:0`
- `GEMINI_MODEL`: `gemini-1.0-pro`

### 4. デプロイ

1. 「保存してデプロイ」をクリック
2. ビルドとデプロイが自動的に実行されます
3. デプロイ完了後、提供されたURLにアクセス

### 5. 動作確認

1. まず`MOCK_MODE=true`で動作確認（通信不要）
2. 問題なければ`MOCK_MODE=false`に変更して本番APIをテスト
3. 環境変数を変更した場合は再デプロイが必要

### トラブルシューティング

**ビルドエラーが発生する場合:**
- `package-lock.json`がコミットされているか確認
- Node.jsバージョンが互換性があるか確認（Node 18以上推奨）

**環境変数が反映されない:**
- Amplifyコンソールで環境変数を設定後、再デプロイを実行
- `NEXT_PUBLIC_`プレフィックスがあるものはクライアント側で使用可能

**AWS認証エラー:**
- IAMユーザーに`bedrock:InvokeModel`権限があるか確認
- リージョンが正しいか確認（`BEDROCK_REGION`）

**Basic認証が動作しない:**
- `DISABLE_AUTH`が`true`になっていないか確認
- `AUTH_USERNAME`と`AUTH_PASSWORD`が正しく設定されているか確認
- ブラウザのキャッシュをクリアしてから再度アクセス

## セキュリティに関する注意事項

### 認証情報の管理

- `.env`ファイルは絶対にGitにコミットしないでください（`.gitignore`に含まれています）
- 本番環境では強力なパスワードを使用してください
  - 最低12文字以上
  - 大文字、小文字、数字、記号を組み合わせる
  - 辞書にある単語を避ける
- 認証情報を共有する際は、安全な方法（パスワードマネージャー、暗号化されたメッセージなど）を使用してください

### APIキーの保護

- OpenAI、Google、AWSのAPIキーは環境変数で管理
- 定期的にキーをローテーション
- 不要になったキーは即座に無効化
- APIキーの利用状況をモニタリング

### 推奨事項

- 本番環境では`MOCK_MODE=false`を使用する前に、必ず認証を有効化
- ワークショップ終了後は、使用したAPIキーを削除または無効化
- Amplifyのアクセスログを定期的に確認
