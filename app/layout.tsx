import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teamplaner",
  description: "Kalender für Anwesenheit und Teamplanung",
  applicationName: "Teamplaner",
  icons: {
    icon: "/teamplaner-mark-v4.svg",
    shortcut: "/teamplaner-mark-v4.svg",
    apple: "/teamplaner-apple-touch-icon-v4.png",
  },
  appleWebApp: {
    capable: true,
    title: "Teamplaner",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#133b3e",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
