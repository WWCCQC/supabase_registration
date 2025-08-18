export const metadata = { 
  title: "Registration",
  charset: "utf-8",
  viewport: "width=device-width, initial-scale=1"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', 'ui-sans-serif', 'system-ui', sans-serif" }}>{children}</body>
    </html>
  );
}
