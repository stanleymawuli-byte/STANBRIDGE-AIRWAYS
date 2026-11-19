import type { Metadata } from "next";
import "./globals.css";
import "./auth.css";

export const metadata: Metadata = {
  title: "StanBridge Airways | Beyond Borders",
  description: "Discover a more considered way to travel with StanBridge Airways.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "StanBridge Airways",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
