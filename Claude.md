# Claude 開発メモ

## プロジェクト概要

GPT、Gemini、Claudeの3つのAIモデルを同一プロンプト・同一JSONスキーマで呼び出し、思考実験における倫理的判断を横並び比較するワークショップ用デモアプリ。

本プロジェクトでは、トロッコ問題のような倫理的ジレンマに対して各モデルがどのような判断を下すかを比較し、AIの思考プロセスと判断基準の違いを可視化する。

## Claude API実装の詳細

### AWS Bedrock経由のアクセス

本プロジェクトでは、Claude APIをAWS Bedrock経由で呼び出している。直接Anthropic APIを使用するのではなく、AWS Bedrockを利用する理由：

- エンタープライズ環境での統合管理
- AWS IAMベースのアクセス制御
- 他のAWSサービスとの連携

#### 実装のポイント

**1. 認証（lib/providers/anthropic.ts）**

```typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";

// カスタム環境変数から認証情報を取得（AWS_プレフィックスは予約されているため）
const accessKeyId = process.env.BEDROCK_ACCESS_KEY_ID;
const secretAccessKey = process.env.BEDROCK_SECRET_ACCESS_KEY;
const sessionToken = process.env.BEDROCK_SESSION_TOKEN;

const credentials = {
  accessKeyId,
  secretAccessKey,
  ...(sessionToken && { sessionToken })
};

const signer = new SignatureV4({
  credentials,
  region,
  service: "bedrock",
  sha256: Sha256
});
```

- AWS SigV4署名を使用した認証
- カスタム環境変数 `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` を使用（`AWS_` プレフィックスは多くのプラットフォームで予約されているため）
- オプションで `BEDROCK_SESSION_TOKEN` をサポート（AssumeRole時）

**2. リクエストパラメータ**

```typescript
{
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 300,
  temperature: 0.1,
  system: systemPrompt,
  messages: [
    {
      role: "user",
      content: [{ type: "text", text: userPrompt }]
    }
  ]
}
```

- `anthropic_version`: Bedrockで必須のバージョン指定
- `max_tokens: 300`: 思考実験の判断結果は簡潔なため、トークン数を抑制
- `temperature: 0.1`: 低温度設定により一貫性のある判断を実現

**3. エンドポイント構造**

```
https://bedrock-runtime.{region}.amazonaws.com/model/{model_id}/invoke
```

モデルIDの例：`anthropic.claude-3-5-sonnet-20240620-v1:0`

### プロンプト設計

#### System Prompt（app/api/eval/route.ts:67-77）

```typescript
function buildSystemPrompt() {
  return [
    "あなたは思考実験に対して二択(A/B)を選び、確信度(51-100整数)を返す。",
    "確信度は正解率ではなく、その選択の妥当性に対する迷いの少なさ。",
    "出力は必ず指定JSONのみ。余計な文章は禁止。",
    "日本語で簡潔に。reasoning_summaryは1文、key_assumptionsは最大3つ。",
    "if条件が無い場合は what_changed_by_if を『初回』とする。",
    "if条件がある場合は、what_changed_by_if にif条件で変わった判断点を短く書く。",
    "if条件がある場合は判断が変わり得るため、条件の影響を強めに反映する。"
  ].join("\n");
}
```

**設計のポイント：**

1. **明確なタスク定義**: A/Bの二択と確信度という具体的なフォーマット
2. **JSONのみ出力**: Claude含め全モデルで一貫したJSON出力を確保
3. **確信度の意味明確化**: "迷いの少なさ"として定義し、モデルの主観的判断を引き出す
4. **簡潔性の強調**: 冗長な出力を抑制（max_tokens=300との相乗効果）
5. **if条件処理**: 条件付き判断時の挙動を明示

#### User Prompt構造

```typescript
function buildUserPrompt({
  caseTitle,
  scenarioText,
  optionA,
  optionB,
  principleId,
  ifConditions,
  targetConfidence,
  retryNote
}) {
  return [
    `ケース名: ${caseTitle}`,
    `シナリオ: ${scenarioText}`,
    `選択肢A: ${optionA}`,
    `選択肢B: ${optionB}`,
    "判断原理一覧:",
    principleLines,
    `選択した判断原理: ${selected?.label ?? principleId}`,
    `if条件(配列): ${ifArray}`,
    // if条件の有無による指示分岐
    `目標確信度: ${targetConfidence}`,
    "出力JSONの形式は以下。余計な文は不要:",
    JSON.stringify({
      decision: "A",
      confidence: 80,
      key_assumptions: ["例"],
      reasoning_summary: "1文で要約。",
      what_changed_by_if: "初回"
    }),
    retryNote ?? ""
  ].join("\n");
}
```

**構造化されたプロンプト:**

- シナリオと選択肢を明確に分離
- 判断原理（功利主義、義務論など）を一覧提示
- 期待する出力形式をサンプルJSONで明示
- リトライ時には追加指示を付加

### JSONスキーマ定義

```typescript
const MODEL_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "decision",
    "confidence",
    "key_assumptions",
    "reasoning_summary",
    "what_changed_by_if"
  ],
  properties: {
    decision: { type: "string", enum: ["A", "B"] },
    confidence: { type: "integer", minimum: 51, maximum: 100 },
    key_assumptions: { type: "array", items: { type: "string" }, maxItems: 3 },
    reasoning_summary: { type: "string" },
    what_changed_by_if: { type: "string" }
  }
};
```

**スキーマ設計の意図：**

- `decision`: enum["A", "B"]で二択を強制
- `confidence`: 51-100の範囲で「迷いのない側」を必ず示す
- `key_assumptions`: 最大3つに制限し、簡潔な前提条件を抽出
- `reasoning_summary`: 判断理由の要約
- `what_changed_by_if`: if条件による判断変化の追跡

## 開発中の気づきとベストプラクティス

### 1. JSON出力の安定性確保

**課題**: AIモデルがJSON以外のテキスト（説明文など）を出力してパースエラーが発生

**解決策**:

```typescript
async function runWithRetry({
  run,
  parser,
  retryNote,
  modelName,
  requestLog
}) {
  try {
    const text = await run();
    return { result: parser(text), error: null };
  } catch (error) {
    console.log(`[eval] ${modelName} retry`, { retryNote });
    const text = await run(retryNote);
    return { result: parser(text), error: error as Error };
  }
}
```

- 1回目の失敗時に `"JSON以外の出力は禁止です。指定JSONのみ返してください。"` を追加して再試行
- パース時にJSON部分を抽出する正規表現マッチング: `text.match(/\{[\s\S]*\}/)`
- Zodスキーマによる型検証

**Claude特有の挙動**:

- 低temperature（0.1）設定により、Claudeは比較的安定したJSON出力を提供
- systemプロンプトの指示遵守率が高い
- リトライが必要になるケースは他モデルと比較して少なめ

### 2. 並列API呼び出しによる高速化

```typescript
const [gptResult, geminiResult, claudeResult] = await Promise.all([
  enabledModels.has("gpt") && openaiKey
    ? runWithRetry({ ... })
    : Promise.resolve({ ... }),
  enabledModels.has("gemini") && geminiKey
    ? runWithRetry({ ... })
    : Promise.resolve({ ... }),
  enabledModels.has("claude") && bedrockRegion
    ? runWithRetry({ ... })
    : Promise.resolve({ ... })
]);
```

- 3つのモデルを`Promise.all`で並列実行
- レスポンスタイムを大幅に短縮（シーケンシャル実行の1/3程度）

### 3. MOCKモードによる開発・デモの安定性

```typescript
const mockMode = process.env.MOCK_MODE === "true";

if (mockMode) {
  const responseBody = {
    results: {
      gpt: makeMockResult({ model: "gpt", ... }),
      gemini: makeMockResult({ model: "gemini", ... }),
      claude: makeMockResult({ model: "claude", ... })
    }
  };
  return NextResponse.json(responseBody);
}
```

**活用シーン**:

- ワークショップ本番での通信トラブルに備えたフォールバック
- 開発時のAPI利用料削減
- 迅速なUI/UX検証

### 4. エラーハンドリングの粒度

各モデルのエラーを個別に管理し、一部のモデルが失敗しても他のモデルの結果は表示：

```typescript
const errors: Record<string, string> = {};

if (gptResult.error) {
  errors.gpt = gptResult.error.message;
}
// ... 各モデルごとに記録

// エラーがあっても、結果は返す
return NextResponse.json({
  results: { gpt, gemini, claude },
  errors: Object.keys(errors).length ? errors : undefined
});
```

**利点**:

- ユーザー体験の向上（全てが失敗するわけではない）
- デバッグの容易性（どのモデルで問題が起きているか明確）

### 5. 確信度の設計

**確信度の定義**: "正解率"ではなく"迷いの少なさ"

この定義により、モデルは：
- 判断の主観的な確実性を数値化
- 51-100の範囲で「やや確信〜強い確信」を表現
- 50%の「完全に迷っている状態」は存在しない（必ずどちらかに傾く）

**実際の傾向**:

- Claude: 70-85の範囲に収まることが多い（慎重な判断）
- GPT: 80-95と高めの確信度（自信のある判断）
- Gemini: 75-90とバランス型

## Claudeの特徴と他モデルとの比較

### 判断の慎重性

Claudeは他モデルと比較して：

- **慎重な確信度**: 不確実性を認識し、やや控えめな確信度を示す傾向
- **前提条件の明示**: key_assumptionsで前提条件をより詳細に列挙
- **文脈理解**: if条件の影響を適切に反映（what_changed_by_ifが具体的）

### プロンプト遵守性

- systemプロンプトの指示を高精度で遵守
- JSON出力の安定性が高い
- 指定されたフォーマットからの逸脱が少ない

### 倫理的判断の傾向

トロッコ問題などの倫理的ジレンマにおいて：

- **義務論的傾向**: 結果よりも行為の原則を重視する傾向がやや強い
- **バランス重視**: 極端な判断を避け、複数の視点を考慮
- **文脈依存性**: if条件による判断変化が顕著

## コスト最適化

### max_tokensの調整

```typescript
max_tokens: 300
```

思考実験の判断結果は簡潔なため、300トークンで十分。これにより：

- レスポンス速度の向上
- API利用料の削減（出力トークン課金の削減）

### temperatureの最適化

```typescript
temperature: 0.1
```

低温度設定により：

- 一貫性のある判断（同じ入力→同じ出力の再現性が高い）
- 無駄なバリエーション生成を抑制
- リトライ回数の削減

## トラブルシューティング

### 1. Bedrock認証エラー

**症状**: `Bedrock Claude error: 403 Forbidden`

**原因**:
- Bedrock認証情報の不足または期限切れ
- IAMユーザーに`bedrock:InvokeModel`権限がない

**解決策**:
```bash
# 環境変数の確認（注: BEDROCK_プレフィックスを使用）
echo $BEDROCK_ACCESS_KEY_ID
echo $BEDROCK_SECRET_ACCESS_KEY
echo $BEDROCK_SESSION_TOKEN

# IAMポリシーの確認
# bedrock:InvokeModel 権限が必要
```

**重要**: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` は多くのプラットフォーム（AWS Amplify、Vercelなど）で予約されているため、代わりに `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` を使用してください。

### 2. JSONパースエラー

**症状**: `SyntaxError: Unexpected token`

**原因**:
- モデルがJSON以外のテキストを出力
- プロンプトの指示が不明瞭

**解決策**:
- リトライメカニズムが自動で対応
- systemプロンプトで「JSONのみ出力」を強調
- 正規表現でJSON部分を抽出: `text.match(/\{[\s\S]*\}/)`

### 3. タイムアウトエラー

**症状**: リクエストが長時間応答しない

**解決策**:
- `MOCK_MODE=true`に切り替えてデモ継続
- max_tokensを削減してレスポンス速度を向上
- 並列実行により全体の待ち時間を短縮

## 今後の改善案

### 1. ストリーミング対応

現在は完全なレスポンス待ちだが、ストリーミングAPIを使用することで：
- リアルタイムな判断過程の可視化
- UX向上（体感速度の改善）

### 2. キャッシング戦略

同一シナリオ・同一条件の場合：
- レスポンスをキャッシュして再利用
- API呼び出し削減によるコスト最適化

### 3. プロンプトのA/Bテスト

異なるプロンプト設計での比較：
- 確信度の定義方法の違い
- システム/ユーザープロンプトの分離度合い
- 出力形式指示の詳細度

### 4. 追加のメトリクス

現在の出力に加えて：
- レスポンス時間の計測と表示
- トークン使用量の記録
- モデルごとのコスト試算

### 5. 評価の可視化強化

- 確信度の時系列変化（if条件追加による推移）
- 判断の一貫性スコア（同一入力での再現性）
- モデル間の判断差異の統計分析

## AWS Parameter Storeの設定

### 概要

本プロジェクトでは、APIキーやAWS認証情報を**AWS Systems Manager Parameter Store**から動的に取得する仕組みを実装している。これにより：

- **セキュリティ向上**: 環境変数にハードコードせず、AWS IAMで厳密に管理
- **運用の柔軟性**: 認証情報の変更時にアプリの再デプロイ不要
- **コスト最適化**: キャッシング機構により高速アクセス（TTL: 5分）
- **マルチ環境対応**: 環境変数フォールバックでローカル開発も可能

### 実装の仕組み

**lib/utils/parameter-store.ts**

```typescript
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

// メモリキャッシュ（TTL: 5分）
const cache = new Map<string, ParameterCache>();

export async function getParameter(
  parameterName: string,
  fallbackEnvKey?: string
): Promise<string | undefined> {
  // 1. 環境変数フォールバック（ローカル開発用）
  if (fallbackEnvKey && process.env[fallbackEnvKey]) {
    return process.env[fallbackEnvKey];
  }

  // 2. キャッシュチェック（5分TTL）
  const cached = cache.get(parameterName);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // 3. Parameter Storeから取得
  const client = new SSMClient({ region });
  const response = await client.send(new GetParametersCommand({
    Names: [parameterName],
    WithDecryption: true
  }));

  // キャッシュに保存
  cache.set(parameterName, { value, timestamp: Date.now() });
  return value;
}
```

**主要な特徴:**

1. **メモリキャッシング**: 5分間キャッシュして、Parameter Storeへのアクセス回数を削減
2. **環境変数フォールバック**: ローカル開発時は環境変数を優先的に使用
3. **SecureString対応**: `WithDecryption: true`で暗号化されたパラメータも取得可能
4. **一括取得**: `getParameters`関数で複数パラメータを効率的に取得

### Parameter Storeへの登録手順

#### 0. セットアップスクリプトの使用（推奨）

最も簡単な方法は、用意されたセットアップスクリプトを使用することです：

```bash
./scripts/setup-parameter-store.sh
```

このスクリプトは対話形式で全てのパラメータを登録します：
- 機密情報（APIキー、認証情報）→ SecureString
- 設定値（モデル名、リージョン、モックモード）→ String

#### 1. AWS CLIでパラメータを登録（手動）

**機密情報（SecureString）:**

```bash
# OpenAI API Key
aws ssm put-parameter \
  --name "/ai-workshop/openai-api-key" \
  --value "sk-xxxxxxxxxxxxxxxxxxxxxxxx" \
  --type "SecureString" \
  --description "OpenAI API Key for AI Workshop" \
  --region us-east-1

# Google API Key
aws ssm put-parameter \
  --name "/ai-workshop/google-api-key" \
  --value "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX" \
  --type "SecureString" \
  --description "Google API Key for AI Workshop" \
  --region us-east-1

# Bedrock Access Key ID
aws ssm put-parameter \
  --name "/ai-workshop/bedrock-access-key-id" \
  --value "AKIAXXXXXXXXXXXXXXXX" \
  --type "SecureString" \
  --description "AWS Bedrock Access Key ID" \
  --region us-east-1

# Bedrock Secret Access Key
aws ssm put-parameter \
  --name "/ai-workshop/bedrock-secret-access-key" \
  --value "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  --type "SecureString" \
  --description "AWS Bedrock Secret Access Key" \
  --region us-east-1

# Bedrock Session Token（オプション、AssumeRole時のみ）
aws ssm put-parameter \
  --name "/ai-workshop/bedrock-session-token" \
  --value "FwoGZXIvYXdzEBMaDXXXXXXXXXXXXXXXXX..." \
  --type "SecureString" \
  --description "AWS Bedrock Session Token (optional)" \
  --region us-east-1

# Basic認証情報
aws ssm put-parameter \
  --name "/ai-workshop/auth-username" \
  --value "admin" \
  --type "SecureString" \
  --description "Basic Authentication Username" \
  --region us-east-1

aws ssm put-parameter \
  --name "/ai-workshop/auth-password" \
  --value "your-strong-password" \
  --type "SecureString" \
  --description "Basic Authentication Password" \
  --region us-east-1
```

**設定値（String）:**

```bash
# モデル設定
aws ssm put-parameter \
  --name "/ai-workshop/openai-model" \
  --value "gpt-4o-mini" \
  --type "String" \
  --description "OpenAI Model Name" \
  --region us-east-1

aws ssm put-parameter \
  --name "/ai-workshop/gemini-model" \
  --value "gemini-1.0-pro" \
  --type "String" \
  --description "Gemini Model Name" \
  --region us-east-1

aws ssm put-parameter \
  --name "/ai-workshop/bedrock-model-id" \
  --value "anthropic.claude-3-5-sonnet-20240620-v1:0" \
  --type "String" \
  --description "Bedrock Model ID" \
  --region us-east-1

aws ssm put-parameter \
  --name "/ai-workshop/bedrock-region" \
  --value "us-east-1" \
  --type "String" \
  --description "Bedrock Region" \
  --region us-east-1

# 動作モード設定
aws ssm put-parameter \
  --name "/ai-workshop/mock-mode" \
  --value "false" \
  --type "String" \
  --description "Mock Mode (true/false)" \
  --region us-east-1

aws ssm put-parameter \
  --name "/ai-workshop/disable-auth" \
  --value "false" \
  --type "String" \
  --description "Disable Authentication (true/false)" \
  --region us-east-1
```

#### 2. AWSコンソールでパラメータを登録

1. **AWS Systems Manager**コンソールを開く
2. 左メニューから「パラメータストア」を選択
3. 「パラメータの作成」をクリック
4. 以下の設定でパラメータを作成：

| 項目 | 値 |
|------|-----|
| 名前 | `/ai-workshop/openai-api-key` |
| タイプ | `SecureString` |
| KMS キーソース | `マイカレントアカウント` |
| KMS キー ID | `alias/aws/ssm` (デフォルト) |
| 値 | `sk-xxxxxxxxxxxxxxxxxxxxxxxx` |

5. 他のパラメータも同様に作成

#### 3. パラメータの確認

```bash
# パラメータ一覧を表示
aws ssm describe-parameters --region us-east-1

# 特定のパラメータの値を取得（復号化）
aws ssm get-parameter \
  --name "/ai-workshop/openai-api-key" \
  --with-decryption \
  --region us-east-1
```

### IAM権限の設定

#### Amplify実行ロールに必要な権限

Amplify（またはEC2、Lambda等）の実行ロールに以下のIAMポリシーをアタッチ：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": [
        "arn:aws:ssm:us-east-1:YOUR_ACCOUNT_ID:parameter/ai-workshop/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:YOUR_ACCOUNT_ID:key/*"
      ],
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "ssm.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

**重要なポイント:**

1. **最小権限の原則**: `/ai-workshop/*`のみアクセス可能
2. **KMS復号化権限**: SecureStringの復号化にKMS権限が必要
3. **リージョン指定**: Parameter Storeはリージョナルサービス

#### Amplifyでの設定手順

1. **Amplifyコンソール**を開く
2. 該当アプリを選択
3. 「アプリ設定」→「一般設定」
4. 「サービスロール」を確認
5. IAMコンソールで該当ロールに上記ポリシーをアタッチ

### ローカル開発環境の設定

Parameter Storeを使用せず、環境変数フォールバックでローカル開発が可能：

**.env.local**
```bash
# ローカル開発用（環境変数フォールバック）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX
BEDROCK_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
BEDROCK_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BEDROCK_SESSION_TOKEN=（オプション）

# モックモードでAPI不要の場合
MOCK_MODE=true
NEXT_PUBLIC_MOCK_MODE=true
```

**動作の優先順位:**

1. 環境変数（存在する場合）
2. Parameter Store（キャッシュがあればキャッシュ）
3. Parameter Storeから取得

### パフォーマンス最適化

#### キャッシング戦略

```typescript
// 5分間キャッシュ
const CACHE_TTL_MS = 5 * 60 * 1000;

// API呼び出し回数の削減
// - 初回: Parameter Store → キャッシュに保存
// - 2回目以降（5分以内）: キャッシュから即座に返却
// - 5分経過後: Parameter Store → キャッシュ更新
```

**効果:**
- レスポンス時間: 50-100ms → 1ms未満（キャッシュヒット時）
- Parameter Store API呼び出し: 1回/5分（大幅削減）
- コスト: Parameter StoreのAPI呼び出し料金を削減

#### 一括取得による最適化

```typescript
// 非効率: 個別に3回取得
const openaiKey = await getParameter("/ai-workshop/openai-api-key");
const geminiKey = await getParameter("/ai-workshop/google-api-key");
const bedrockKey = await getParameter("/ai-workshop/bedrock-access-key-id");

// 効率的: 1回で3つ取得（10個まで可能）
const params = await getParameters([
  "/ai-workshop/openai-api-key",
  "/ai-workshop/google-api-key",
  "/ai-workshop/bedrock-access-key-id"
]);
```

### トラブルシューティング

#### 1. Parameter Storeアクセスエラー

**症状**: `AccessDeniedException: User is not authorized to perform: ssm:GetParameter`

**原因**: IAM権限不足

**解決策**:
```bash
# 実行ロールの確認
aws sts get-caller-identity

# IAMポリシーの確認
aws iam get-role-policy \
  --role-name amplify-role-name \
  --policy-name parameter-store-access
```

#### 2. KMS復号化エラー

**症状**: `KMS.AccessDeniedException: The ciphertext refers to a customer master key that does not exist`

**原因**: KMS復号化権限がない

**解決策**:
- IAMロールに`kms:Decrypt`権限を追加
- KMSキーのポリシーでIAMロールに復号化を許可

#### 3. キャッシュの問題

**症状**: Parameter Storeで値を更新したが反映されない

**原因**: メモリキャッシュが5分間保持される

**解決策**:
- 5分待つ（自動的にキャッシュクリア）
- アプリを再デプロイしてプロセス再起動
- 緊急時は`clearCache()`関数を呼び出し（テスト用）

#### 4. リージョンの不一致

**症状**: `ParameterNotFound: Parameter /ai-workshop/... not found`

**原因**: Parameter StoreとAmplifyのリージョンが異なる

**解決策**:
```bash
# Parameter Storeのリージョンを確認
aws ssm describe-parameters --region us-east-1

# 環境変数でリージョンを明示
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
```

### セキュリティのベストプラクティス

1. **SecureStringの使用**: 必ず`SecureString`タイプでパラメータを作成
2. **最小権限の原則**: `/ai-workshop/*`のみアクセス可能にする
3. **パラメータの命名規則**: プロジェクトごとにプレフィックスを統一
4. **監査ログの有効化**: CloudTrailでParameter Storeアクセスをログ記録
5. **定期的なローテーション**: APIキーは定期的に更新
6. **環境分離**: 本番/ステージング/開発で異なるパラメータパスを使用

### パラメータのライフサイクル管理

#### 更新手順

```bash
# パラメータの更新（上書き）
aws ssm put-parameter \
  --name "/ai-workshop/openai-api-key" \
  --value "sk-new-key-xxxxxxxxxxxxxxxx" \
  --type "SecureString" \
  --overwrite \
  --region us-east-1
```

#### 削除手順

```bash
# パラメータの削除
aws ssm delete-parameter \
  --name "/ai-workshop/openai-api-key" \
  --region us-east-1
```

#### バージョン管理

```bash
# パラメータの履歴を確認
aws ssm get-parameter-history \
  --name "/ai-workshop/openai-api-key" \
  --region us-east-1
```

## AWS Amplifyへのデプロイ

### デプロイ設定

本プロジェクトはAWS Amplifyでのホスティングに対応している。

#### 設定ファイル

**amplify.yml**
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

**next.config.js**
```javascript
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true
  }
};
```

#### 設定のポイント

1. **output: 'standalone'**: Next.jsのスタンドアロンビルドを有効化
   - ビルド成果物のサイズを削減
   - デプロイの高速化

2. **images.unoptimized: true**: 画像最適化を無効化
   - Amplifyでは独自の画像最適化を使用
   - Next.js Image Optimizationとの競合を回避

3. **npm ci**: `npm install`ではなく`npm ci`を使用
   - package-lock.jsonからの厳密なインストール
   - ビルドの再現性を確保

#### 環境変数の管理

**推奨アプローチ: Parameter Store + 環境変数の併用**

本プロジェクトでは、APIキーや設定値の**全て**を**AWS Parameter Store**で管理します：

**Parameter Storeで管理（機密情報 - SecureString）:**
- OpenAI API Key: `/ai-workshop/openai-api-key`
- Google API Key: `/ai-workshop/google-api-key`
- Bedrock Access Key ID: `/ai-workshop/bedrock-access-key-id`
- Bedrock Secret Access Key: `/ai-workshop/bedrock-secret-access-key`
- Bedrock Session Token: `/ai-workshop/bedrock-session-token`（オプション）
- Basic認証ユーザー名: `/ai-workshop/auth-username`
- Basic認証パスワード: `/ai-workshop/auth-password`

**Parameter Storeで管理（設定値 - String）:**
- OpenAIモデル名: `/ai-workshop/openai-model`
- Geminiモデル名: `/ai-workshop/gemini-model`
- Bedrockモデル ID: `/ai-workshop/bedrock-model-id`
- Bedrockリージョン: `/ai-workshop/bedrock-region`
- モックモード: `/ai-workshop/mock-mode`
- 認証無効化フラグ: `/ai-workshop/disable-auth`

**Amplify環境変数（最小限）:**

Amplifyコンソールで以下の環境変数のみ設定：

**必須:**
- `AWS_REGION`: Parameter Storeのリージョン（例: `us-east-1`）

**オプション（初回デプロイ時の動作確認用）:**
- `NEXT_PUBLIC_MOCK_MODE=true`: クライアント側でモックモード表示

**ローカル開発用の環境変数フォールバック:**

Parameter Storeを使用しない場合（ローカル開発時のみ推奨）、`.env.local`ファイルに以下を設定：
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `BEDROCK_ACCESS_KEY_ID`
- `BEDROCK_SECRET_ACCESS_KEY`
- `AUTH_USERNAME`
- `AUTH_PASSWORD`
- `OPENAI_MODEL`
- `GEMINI_MODEL`
- `BEDROCK_MODEL_ID`
- `BEDROCK_REGION`
- `MOCK_MODE`
- `DISABLE_AUTH`

**注意事項:**
- **環境変数が優先**: 環境変数とParameter Storeの両方がある場合、環境変数が優先される（フォールバック機能）
- **Parameter Storeの利点**: 変更時に再デプロイ不要（5分以内にキャッシュから自動反映）
- **環境変数の欠点**: 変更後は再デプロイが必要
- **推奨構成**: 本番環境では全てParameter Storeで管理し、環境変数は最小限に
- `NEXT_PUBLIC_`プレフィックスはクライアント側に公開される
- Basic認証はHTTPS環境でのみ安全（Amplifyは自動的にHTTPS）

#### デプロイの流れ

1. GitHubリポジトリと連携
2. ブランチを選択（通常はmain/master）
3. `amplify.yml`が自動検出される
4. 環境変数を設定
5. ビルド＆デプロイを実行
6. 提供されたURLで動作確認

#### パフォーマンス最適化

**キャッシュ戦略:**
- `node_modules`と`.next/cache`をキャッシュ
- ビルド時間を大幅に短縮（初回: ~3分 → 2回目以降: ~1分）

**並列処理:**
- 3つのAIモデルを`Promise.all`で並列実行
- レスポンスタイムを最小化

### トラブルシューティング（Amplify固有）

#### ビルドエラー

**症状**: `Module not found` エラー

**原因**:
- package-lock.jsonが最新でない
- ローカルとAmplifyでNode.jsバージョンが異なる

**解決策**:
```bash
# ローカルで再生成
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

#### 環境変数が反映されない

**症状**: APIキーエラー、undefined変数

**原因**:
- 環境変数設定後に再デプロイしていない
- 変数名のtypo

**解決策**:
1. Amplifyコンソールで環境変数を確認
2. 「再デプロイ」を実行
3. ビルドログで環境変数の読み込みを確認

#### AWS Bedrock認証エラー（Amplify環境）

**症状**: `403 Forbidden` エラー

**原因**:
- IAMユーザーの権限不足
- リージョン設定ミス

**解決策**:
1. IAMポリシーに`bedrock:InvokeModel`を追加
2. `BEDROCK_REGION`環境変数を確認（例: `us-east-1`）
3. Bedrockが有効なリージョンか確認

### Basic認証の実装

#### 概要

本プロジェクトでは、Next.jsミドルウェアを使用したBasic認証を実装している。これにより、デプロイ後のアプリケーションへの不正アクセスを防止できる。

#### 実装の仕組み

**middleware.ts**
```typescript
export function middleware(request: NextRequest) {
  // DISABLE_AUTH=trueの場合は認証スキップ
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.next();
  }

  const basicAuth = request.headers.get("authorization");

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    const validUser = process.env.AUTH_USERNAME || "admin";
    const validPassword = process.env.AUTH_PASSWORD || "password";

    if (user === validUser && pwd === validPassword) {
      return NextResponse.next();
    }
  }

  // 認証失敗時は/api/authにリダイレクト
  return NextResponse.rewrite(new URL("/api/auth", request.url));
}
```

**app/api/auth/route.ts**
```typescript
export async function GET() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}
```

#### 認証の流れ

1. ユーザーがアプリにアクセス
2. ミドルウェアが認証ヘッダーをチェック
3. 認証情報がない、または無効な場合：
   - 401レスポンスを返す
   - ブラウザがBasic認証ダイアログを表示
4. 正しい認証情報が入力されると、アクセスを許可

#### セキュリティ上の考慮事項

**推奨設定:**
- 強力なパスワードを使用（12文字以上、大小英数字記号の組み合わせ）
- パスワードは環境変数で管理（コードにハードコードしない）
- HTTPS環境でのみ使用（AmplifyはデフォルトでHTTPS）

**制限事項:**
- Basic認証は簡易的なセキュリティ対策
- より高度なセキュリティが必要な場合は、NextAuth.jsやAWS Cognitoの使用を検討
- ワークショップデモのような用途には十分

#### ローカル開発時の設定

**.env（ローカル）:**
```bash
DISABLE_AUTH=true  # 認証を無効化して開発効率化
```

**本番環境（Amplify）:**
```bash
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_strong_password
# DISABLE_AUTHは設定しない（認証を有効化）
```

### デプロイ後の運用

#### MOCKモードの切り替え

**デモ時:**
```
MOCK_MODE=true
NEXT_PUBLIC_MOCK_MODE=true
```
- 外部API不要
- 安定した動作
- コスト削減

**本番時:**
```
MOCK_MODE=false
NEXT_PUBLIC_MOCK_MODE=false
```
- 実際のAI判断を取得
- リアルタイムな比較が可能

#### モニタリング

Amplifyコンソールで確認できる項目:
- ビルド履歴とログ
- デプロイ状況
- アクセスログ（CloudWatch連携）
- エラーレート

## 参考リソース

- [Claude API Documentation (Anthropic)](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [AWS Bedrock - Anthropic Claude Models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html)
- [Structured Outputs with Claude](https://docs.anthropic.com/claude/docs/structured-outputs)
- [AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [Next.js Deployment on Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-nextjs-app.html)

## まとめ

このワークショップデモアプリ開発を通じて、Claudeの以下の特性を実感：

1. **高い指示遵守性**: プロンプトの意図を正確に理解し実行
2. **安定したJSON出力**: 構造化データ生成の信頼性が高い
3. **慎重な判断**: 不確実性を適切に表現し、バランスの取れた判断
4. **AWS統合**: Bedrock経由のエンタープライズ利用が容易

一方で、本番運用時の考慮事項：

- AWS認証の複雑性（SigV4署名、IAM権限管理）
- Bedrock経由のオーバーヘッド（直接API呼び出しと比較）
- リージョンとモデルIDの適切な選択

総じて、Claudeは倫理的判断のような複雑な推論タスクにおいて、高品質で一貫性のある出力を提供する優れたモデルであることが確認できた。
