import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import "./globals.css";
import AppShell from "@/components/shell/appshell";
import '@/styles/index.css'

export const metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  description: "App dashboard layout",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  if (session == null) {
    return (
      <SessionProvider session={session}>
        <html lang="vi" className="h-full">
          <body className="h-full bg-surface-2 text-[var(--text)]">
            {children}
          </body>
        </html>
      </SessionProvider>
    )
  }

  return (
    <SessionProvider session={session}>
      <html lang="vi" className="h-full">
        <body className="h-full bg-surface-2 text-[var(--text)]">
          <AppShell session={session}>{children}</AppShell>
        </body>
      </html>
    </SessionProvider>
  );
}
