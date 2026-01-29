import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "思考実験 × 生成AI",
  description: "第四システム事業部会議"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
