/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Amplifyデプロイ用の設定
  output: 'standalone',
  // 画像最適化の設定（Amplifyでは無効化が推奨）
  images: {
    unoptimized: true
  },
  // ミドルウェアで環境変数を使用するための設定
  env: {
    DISABLE_AUTH: process.env.DISABLE_AUTH,
    AUTH_USERNAME: process.env.AUTH_USERNAME,
    AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  }
};

module.exports = nextConfig;
