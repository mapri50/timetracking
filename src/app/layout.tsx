import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lovely Time Tracker",
  description: "Track customer work, billed time, and payments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
