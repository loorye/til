import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "思考実験 比較デモ",
  description: "GPT/Gemini/Claude 比較デモ"
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
