import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StudyFlow AI",
  description: "AI-оркестратор для студентов"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
