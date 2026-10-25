import type { Metadata } from "next";
import "../src/styles.css";
export const metadata: Metadata = {
  title: "Wealth Tracker — Shared household",
  description: "A private household tracker for invited ChatGPT accounts.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
