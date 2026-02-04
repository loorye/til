/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AWS Amplifyデプロイ用の設定
  output: 'standalone',
  // 画像最適化の設定（Amplifyでは無効化が推奨）
  images: {
    unoptimized: true
  },
  // ミドルウェアで使用する環境変数のみ明示的に定義
  // 注意: envセクションの変数はクライアントサイドにも公開されるため、
  // APIキーなどの機密情報はここに含めない。サーバーサイド（API routes）では
  // process.envを直接使用することで、自動的に安全に扱われる。
  env: {
    DISABLE_AUTH: process.env.DISABLE_AUTH,
    AUTH_USERNAME: process.env.AUTH_USERNAME,
    AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  }
};

module.exports = nextConfig;
