import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Velocity · Campaign portal", template: "%s · Velocity" },
  description:
    "Private campaign workspaces for Kilele Rides, Karoo Coaches, and Marrakech Express.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
