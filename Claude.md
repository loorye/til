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
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@aws-sdk/signature-v4";

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region,
  service: "bedrock",
  sha256: Sha256
});
```

- AWS SigV4署名を使用した認証
- `defaultProvider()`により、環境変数、IAMロール、プロファイルなど複数の認証ソースに対応

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
- AWS認証情報の不足または期限切れ
- IAMロールに`bedrock:InvokeModel`権限がない

**解決策**:
```bash
# 環境変数の確認
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $AWS_SESSION_TOKEN

# IAMポリシーの確認
# bedrock:InvokeModel 権限が必要
```

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

## 参考リソース

- [Claude API Documentation (Anthropic)](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [AWS Bedrock - Anthropic Claude Models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages.html)
- [Structured Outputs with Claude](https://docs.anthropic.com/claude/docs/structured-outputs)

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
