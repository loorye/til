/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Amplifyデプロイ用の設定
  output: 'standalone',
  // 画像最適化の設定（Amplifyでは無効化が推奨）
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
