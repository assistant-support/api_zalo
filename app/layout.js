import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import "./globals.css";
import "@/styles/index.css";
import ShellGate from "@/components/shell/wrap";

export const metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  description: "App dashboard layout",
};

export default async function RootLayout({ children }) {
  const session = await auth();

  return (
    <html lang="vi" className="h-full">
      <body className="h-full bg-surface-2 text-[var(--text)]">
        <SessionProvider session={session}>
          <ShellGate session={session}>{children}</ShellGate>
        </SessionProvider>
      </body>
    </html>
  );
}
