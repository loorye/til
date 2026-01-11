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

## 開発サーバー起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスします。

## APIキー設定方法

`.env` に以下を設定してください。

```bash
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-sonnet-20240620
GEMINI_MODEL=gemini-1.5-flash
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

