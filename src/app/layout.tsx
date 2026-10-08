import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "토익 퀴즈",
  description: "파트·유닛별 토익 1,376문항, 암기 퀴즈와 해설, 오답 노트와 오프라인 학습",
  manifest: "/manifest.json",
  icons: { icon: "/static/icon.svg", apple: "/static/icon.svg" },
  appleWebApp: { capable: true, title: "토익 퀴즈" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#3b5bdb",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
