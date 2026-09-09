import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wedding Planner",
    template: "%s · Wedding Planner",
  },
  description:
    "A calm, shared place to plan your wedding — checklist, budget, guest list and countdown, in sync for everyone helping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
