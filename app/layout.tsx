import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "勤怠登録端末",
  description: "事務所設置の勤怠登録端末アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
