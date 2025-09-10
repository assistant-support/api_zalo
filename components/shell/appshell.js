"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/shell/sidebar";
import Breadcrumbs from "@/components/shell/breadcrumbs";
import { Bell, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

export default function AppShell({ session, children }) {
    const [collapsed, setCollapsed] = useState(false); // desktop collapse only
    const [accountOpen, setAccountOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer
    const pathname = usePathname();

    // Persist desktop collapse preference
    useEffect(() => {
        const saved = localStorage.getItem("app:navCollapsed");
        if (saved != null) setCollapsed(saved === "1");
    }, []);
    useEffect(() => {
        localStorage.setItem("app:navCollapsed", collapsed ? "1" : "0");
    }, [collapsed]);

    // Close overlays on route change
    useEffect(() => {
        setAccountOpen(false);
        setMobileOpen(false);
    }, [pathname]);

    return (
        <div className="min-h-screen w-full flex bg-surface-2 text-[var(--text)]">
            {/* Sidebar (desktop + mobile) */}
            <Sidebar
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                accountOpen={accountOpen}
                setAccountOpen={setAccountOpen}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
                session={session}
            />

            {/* Main */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ height: '100vh' }}>
                {/* Header */}
                <header className="sticky top-0 z-30 bg-surface border-b" style={{ borderColor: "var(--border)" }}>
                    <div className="h-14 flex items-center gap-2 px-3">
                        {/* Mobile open */}
                        <button
                            type="button"
                            className="icon-btn md:hidden"
                            aria-label="Open navigation"
                            onClick={() => setMobileOpen(true)}
                        >
                            <Menu size={18} />
                        </button>

                        {/* Desktop collapse toggle */}
                        <button
                            type="button"
                            className="icon-btn hidden md:inline-flex"
                            aria-label="Toggle sidebar"
                            onClick={() => setCollapsed((v) => !v)}
                            title="Thu gọn / Mở rộng"
                        >
                            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>

                        <div className="ml-1">
                            <Breadcrumbs />
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <button className="icon-btn" aria-label="Notifications">
                                <Bell size={18} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 min-w-0 flex overflow-hidden">{children}</main>
            </div>
        </div>
    );
}
