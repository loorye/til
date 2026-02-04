/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Amplifyデプロイ用の設定
  output: 'standalone',
  // 画像最適化の設定（Amplifyでは無効化が推奨）
  images: {
    unoptimized: true
  },
  // 環境変数の明示的な定義（サーバーサイドでも利用可能にする）
  env: {
    // 認証設定
    DISABLE_AUTH: process.env.DISABLE_AUTH,
    AUTH_USERNAME: process.env.AUTH_USERNAME,
    AUTH_PASSWORD: process.env.AUTH_PASSWORD,
    // モック設定
    MOCK_MODE: process.env.MOCK_MODE,
    // API Keys
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    // AWS Bedrock設定
    BEDROCK_ACCESS_KEY_ID: process.env.BEDROCK_ACCESS_KEY_ID,
    BEDROCK_SECRET_ACCESS_KEY: process.env.BEDROCK_SECRET_ACCESS_KEY,
    BEDROCK_SESSION_TOKEN: process.env.BEDROCK_SESSION_TOKEN,
    BEDROCK_REGION: process.env.BEDROCK_REGION,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    // モデル設定
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  }
};

module.exports = nextConfig;
