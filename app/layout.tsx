import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { ToastProvider } from "@/components/common/Toast";
import { themeInitScript } from "@/lib/theme";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Registration",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={notoSansThai.className}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
