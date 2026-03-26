import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import AuthBar from "./components/AuthBar";
import NavLinks from "./components/NavLinks";

const fontSans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "贞元学校失物招领平台",
  description: "帮助失物快速回到失主身边的校园失物招领平台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={fontSans.className}>
        <div className="app-shell">
          <header className="site-header">
            <div className="header-top">
              <div className="brand">贞元学校失物招领平台</div>
              <AuthBar />
            </div>
            <NavLinks />
          </header>
          <main className="main-content">
            <div className="container">{children}</div>
          </main>
          <footer className="site-footer">
            <div>© 2026 贞元学校 · 让失物回到它应在的地方</div>
          </footer>
        </div>
      </body>
    </html>
  );
}
