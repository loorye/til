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

### 方法1: 環境変数（ローカル開発）

`.env` に以下を設定してください：

```bash
# APIキー
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
BEDROCK_ACCESS_KEY_ID=your_aws_access_key_id
BEDROCK_SECRET_ACCESS_KEY=your_aws_secret_access_key
BEDROCK_SESSION_TOKEN=your_aws_session_token  # オプション

# モデル設定
OPENAI_MODEL=gpt-4o-mini
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0
GEMINI_MODEL=gemini-1.0-pro

# 認証設定（ローカルでは無効化推奨）
DISABLE_AUTH=true
```

### 方法2: AWS Parameter Store（本番環境推奨）

本番環境では、**全ての設定値**を**AWS Systems Manager Parameter Store**で管理することを推奨します。

#### セットアップスクリプトを使用（推奨）

```bash
# セットアップスクリプトを実行（対話形式で全てのパラメータを登録）
./scripts/setup-parameter-store.sh
```

このスクリプトで以下を登録できます：
- **機密情報（SecureString）**: APIキー、Basic認証情報
- **設定値（String）**: モデル名、リージョン、モックモード、認証無効化フラグ

#### 登録されるパラメータ

**機密情報（SecureString）:**
- `/ai-workshop/openai-api-key` - OpenAI APIキー
- `/ai-workshop/google-api-key` - Google APIキー
- `/ai-workshop/bedrock-access-key-id` - Bedrock認証情報
- `/ai-workshop/bedrock-secret-access-key` - Bedrock認証情報
- `/ai-workshop/bedrock-session-token` - Bedrockセッショントークン（オプション）
- `/ai-workshop/auth-username` - Basic認証ユーザー名
- `/ai-workshop/auth-password` - Basic認証パスワード

**設定値（String）:**
- `/ai-workshop/openai-model` - OpenAIモデル名
- `/ai-workshop/gemini-model` - Geminiモデル名
- `/ai-workshop/bedrock-model-id` - BedrockモデルID
- `/ai-workshop/bedrock-region` - Bedrockリージョン
- `/ai-workshop/mock-mode` - モックモード（true/false）
- `/ai-workshop/disable-auth` - 認証無効化（true/false）

**Parameter Storeの利点:**
- セキュリティ向上（IAMで厳密に管理）
- 設定変更時に再デプロイ不要（5分以内に自動反映）
- キャッシング機構により高速アクセス（TTL: 5分）
- 環境変数フォールバックでローカル開発も可能

詳細は[CLAUDE.md](./CLAUDE.md)の「AWS Parameter Storeの設定」セクションを参照してください。

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

#### Parameter Store使用時（推奨）

**最小限の環境変数のみ設定:**

**必須:**
- `AWS_REGION`: Parameter Storeのリージョン（例: `us-east-1`）

**オプション（クライアント側での表示用）:**
- `NEXT_PUBLIC_MOCK_MODE`: `true` / `false`（クライアント側）

**重要:**
- **Parameter Store使用時は、ほとんどの設定を環境変数に設定する必要はありません**
- APIキー、モデル名、認証情報など、全てParameter Storeから自動的に取得されます
- Parameter Storeで設定を変更した場合、5分以内に自動反映されます（再デプロイ不要）
- 環境変数が設定されている場合、Parameter Storeよりも優先されます（フォールバック機能）

#### 環境変数のみ使用時（非推奨）

Parameter Storeを使用しない場合、以下の全てを環境変数に設定：

**APIキー（機密情報）:**
- `OPENAI_API_KEY`: OpenAI APIキー
- `GOOGLE_API_KEY`: Google APIキー（Gemini用）
- `BEDROCK_ACCESS_KEY_ID`: AWS Bedrock認証情報
- `BEDROCK_SECRET_ACCESS_KEY`: AWS Bedrock認証情報
- `BEDROCK_SESSION_TOKEN`: AWS一時認証トークン（オプション）

**認証設定:**
- `AUTH_USERNAME`: Basic認証のユーザー名
- `AUTH_PASSWORD`: Basic認証のパスワード
- `DISABLE_AUTH`: 認証無効化（`true` / `false`）

**モデル設定:**
- `OPENAI_MODEL`: `gpt-4o-mini`
- `GEMINI_MODEL`: `gemini-1.0-pro`
- `BEDROCK_MODEL_ID`: `anthropic.claude-3-5-sonnet-20240620-v1:0`
- `BEDROCK_REGION`: `us-east-1`

**動作モード:**
- `MOCK_MODE`: `true` / `false`
- `NEXT_PUBLIC_MOCK_MODE`: `true` / `false`

**注意:** 環境変数での管理は、設定変更のたびに再デプロイが必要になるため推奨しません。

#### IAM権限の設定

Parameter Store使用時は、Amplifyの実行ロールに以下の権限を付与：

1. Amplifyコンソール → アプリ → 「一般設定」→ 「サービスロール」を確認
2. IAMコンソールで該当ロールに以下のポリシーをアタッチ：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:us-east-1:YOUR_ACCOUNT_ID:parameter/ai-workshop/*"
    },
    {
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

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

**推奨: AWS Parameter Store使用**
- 本番環境では**AWS Parameter Store**で管理（SecureString）
- IAMポリシーで最小権限の原則を適用
- KMS暗号化による追加のセキュリティ層
- CloudTrailで監査ログを記録
- 認証情報の変更時に再デプロイ不要

**ローカル開発: 環境変数使用**
- `.env`ファイルは絶対にGitにコミットしない（`.gitignore`で除外）
- 定期的にキーをローテーション
- 不要になったキーは即座に無効化
- APIキーの利用状況をモニタリング

### 推奨事項

- 本番環境では`MOCK_MODE=false`を使用する前に、必ず認証を有効化
- ワークショップ終了後は、使用したAPIキーを削除または無効化
- Amplifyのアクセスログを定期的に確認
