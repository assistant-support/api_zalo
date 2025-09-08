"use client";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from '@/app/actions/auth.action';
import {
    ServerCog,
    ChartPie,
    Combine,
    Star,
    BringToFront,
    Boxes,
    Workflow,
    FileCode2,
    ChevronDown,
    LogOut,
    X,
    Users,
    Bell, ShieldQuestionMark,
    MessageCircleCode,
    UsersRound,
    History,
    BellRing,
    MessageCircleMore,
    MonitorCog,
    Settings
} from "lucide-react";


const nav = [
    {
        key: "home",
        label: "Tổng quan",
        icon: ChartPie,
        items: [
            { href: "/", label: "Tổng quan", icon: UsersRound },
            { href: "/sal/history", label: "Khách hàng", icon: History },
            { href: "/sal/bell", label: "Hành động", icon: BellRing },
            { href: "/sal/messages", label: "Phân bổ", icon: MessageCircleMore }
        ],
    },
    // mục nhóm
    {
        key: "customer",
        label: "Chăm sóc",
        icon: UsersRound,
        items: [
            { href: "/sale", label: "Khách hàng", icon: UsersRound },
            { href: "/sale/history", label: "Lịch sử gọi điện", icon: History },
            { href: "/sale/bell", label: "Thông báo", icon: BellRing },
            { href: "/sale/messages", label: "Tin nhắn", icon: MessageCircleMore }
        ],
    },
    {
        key: "workflows",
        label: "Lịch trình",
        icon: Combine,
        items: [
            { href: "/workflows/genesis", label: "Lịch trình cố định", icon: Workflow },
            { href: "/workflows/explorer", label: "Lịch trình tùy biến", icon: BringToFront },
        ],
    },
    {
        key: "settings",
        label: "Cài đặt hệ thống",
        icon: Settings,
        items: [
            { href: "/service", label: "Dịch vụ", icon: ServerCog },
            { href: "/proxy", label: "Quản lý Proxy", icon: ShieldQuestionMark }
        ],
    },
    {
        key: "zalos",
        label: "Cài đặt Nâng cao",
        icon: MonitorCog,
        items: [
            { href: "/zalo", label: "Quản lý Zalo", icon: MessageCircleCode },
            { href: "/proxy", label: "Quản lý Proxy", icon: ShieldQuestionMark }
        ],
    }
];

export default function Sidebar({
    collapsed,
    setCollapsed,
    accountOpen,
    setAccountOpen,
    mobileOpen,
    setMobileOpen,
    session
}) {
    const pathname = usePathname();
    const [openKeys, setOpenKeys] = useState(nav.filter(i => i.items).map(i => i.key));
    const accountRef = useRef(null);

    // constants to lock icon center position
    const RAIL = 76; // sidebar width when collapsed
    const PAD = 8; // constant horizontal padding on both states
    const INNER_RAIL = RAIL - PAD * 2; // width of the rail cell inside padded content

    useEffect(() => {
        const onDocClick = (e) => {
            if (!accountRef.current) return;
            if (!accountRef.current.contains(e.target)) setAccountOpen(false);
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [setAccountOpen]);

    const toggleGroup = (key) =>
        setOpenKeys((keys) =>
            keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        );
    const isActive = (href) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
                    }`}
                onClick={() => setMobileOpen(false)}
            />

            {/* Mobile drawer: CHỈ mount khi mở để tránh double-portal */}
            {mobileOpen && (
                <aside
                    className={`fixed md:hidden z-50 top-0 left-0 bottom-0 bg-surface border-r transition-transform duration-200 translate-x-0`}
                    style={{ width: 280, borderColor: "var(--border)" }}
                >
                    <div className="flex items-center justify-between px-3 py-3">
                        <Link
                            href="/"
                            className="flex items-center px-2 py-2"
                            style={{ borderRadius: "var(--radius)" }}
                        >
                            <Boxes size={20} className="text-[var(--primary-700)]" />
                            <span className="ml-2 font-semibold">Acme Inc</span>
                        </Link>
                        <button
                            className="icon-btn"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <NavGroups
                        rail={INNER_RAIL}
                        pad={PAD}
                        collapsed={false}
                        openKeys={openKeys}
                        toggleGroup={toggleGroup}
                        isActive={isActive}
                    />
                    <AccountBlock
                        rail={INNER_RAIL}
                        pad={PAD}
                        collapsed={false}
                        accountOpen={accountOpen}
                        setAccountOpen={setAccountOpen}
                        accountRef={accountRef}
                    />
                </aside>
            )}

            {/* Desktop sidebar */}
            <aside
                className="hidden md:flex flex-col border-r bg-surface select-none overflow-y-hidden overflow-x-visible"
                style={{
                    width: collapsed ? RAIL : 280,
                    borderColor: "var(--border)",
                    transition: "width .22s cubic-bezier(.2,0,0,1)",
                    height: "100vh",
                }}
            >
                {/* Brand row (constant padding so icon x-position never moves) */}
                <div className="py-3" style={{ paddingInline: PAD }}>
                    <div
                        className="grid items-center min-w-0"
                        style={{
                            gridTemplateColumns: `${INNER_RAIL}px 1fr`,
                            transition:
                                "grid-template-columns .22s cubic-bezier(.2,0,0,1)",
                        }}
                    >
                        <Link
                            href="/"
                            className="grid place-items-center h-9 rounded"
                            style={{ borderRadius: "var(--radius)" }}
                        >
                            <Boxes size={20} className="text-[var(--primary-700)]" />
                        </Link>
                        <div className="min-w-0 overflow-hidden whitespace-nowrap">
                            <span
                                className={`brand-name block max-w-full truncate font-semibold ${collapsed ? "opacity-0" : "opacity-100"
                                    }`}
                            >
                                Blink Kim Sale
                            </span>
                        </div>
                    </div>
                </div>

                {/* Groups scroller */}
                <div
                    className="flex-1 scroll overflow-x-hidden overscroll-contain scrollbar-stable min-w-0"
                    style={{ paddingInline: PAD }}
                >
                    <NavGroups
                        rail={INNER_RAIL}
                        pad={PAD}
                        collapsed={collapsed}
                        openKeys={openKeys}
                        toggleGroup={toggleGroup}
                        isActive={isActive}
                    />
                </div>

                {/* Account */}
                <AccountBlock
                    rail={INNER_RAIL}
                    pad={PAD}
                    collapsed={collapsed}
                    accountOpen={accountOpen}
                    setAccountOpen={setAccountOpen}
                    accountRef={accountRef}
                    session={session}
                />
            </aside>
        </>
    );
}

function NavGroups({ rail, pad, collapsed, openKeys, toggleGroup, isActive }) {
    const cols = `${rail}px ${collapsed ? "0fr" : "1fr"}`;
    const halfRail = rail / 2; // vạch nằm tại tâm rail của hàng cha
    return (
        <nav className="min-w-0">
            {nav.map((n) => {
                const opened = openKeys.includes(n.key);
                const Icon = n.icon;

                // ===== MỤC ĐƠN (link trực tiếp)
                if (n.href) {
                    const active = isActive(n.href);
                    return (
                        <div key={n.key} className="min-w-0">
                            <Link
                                href={n.href}
                                className={`block h-9 my-[2px] rounded px-0 w-full min-w-0 ${active ? "bg-[var(--primary-50)] text-[var(--primary-800)]" : ""
                                    }`}
                                style={{ borderRadius: "var(--radius)" }}
                                title={collapsed ? n.label : undefined}
                            >
                                <div
                                    className="grid items-center w-full h-full min-w-0 cursor-pointer"
                                    style={{
                                        gridTemplateColumns: cols,
                                        transition: "grid-template-columns .22s cubic-bezier(.2,0,0,1)",
                                    }}
                                >
                                    <div className="grid place-items-center">
                                        <Icon size={18} className="shrink-0" />
                                    </div>
                                    <div className="min-w-0 overflow-hidden whitespace-nowrap">
                                        <span className={`block max-w-full truncate ${collapsed ? "opacity-0" : "opacity-100"}`}>
                                            {n.label}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                }

                // ===== MỤC NHÓM (có con)
                return (
                    <div key={n.key} className="mb-1 min-w-0">
                        {/* Hàng cha */}
                        <button
                            className="w-full h-9 rounded nav-parent px-0 min-w-0"
                            onClick={() => toggleGroup(n.key)}
                            title={n.label}
                            aria-expanded={opened}
                        >
                            <div
                                className="grid items-center w-full h-full min-w-0"
                                style={{
                                    gridTemplateColumns: cols,
                                    transition: "grid-template-columns .22s cubic-bezier(.2,0,0,1)",
                                }}
                            >
                                <div className="grid place-items-center">
                                    <Icon size={18} />
                                </div>
                                <div className="min-w-0 overflow-hidden">
                                    <div className={`flex items-center gap-2 ${collapsed ? "opacity-0" : "opacity-100"}`}>
                                        <span className="truncate">{n.label}</span>
                                        <ChevronDown
                                            size={16}
                                            className={`ml-auto transition-transform ${opened ? "rotate-180" : "-rotate-90"}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Children */}
                        <div
                            className={`grid transition-[grid-template-rows] duration-200 ${opened ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                }`}
                        >
                            {collapsed ? (
                                // --- THU GỌN: chỉ icon con, giữa rail
                                <ul className="overflow-hidden">
                                    {n.items.map((it) => {
                                        const IconChild = it.icon;
                                        const active = isActive(it.href);
                                        return (
                                            <li key={it.href}>
                                                <Link
                                                    href={it.href}
                                                    className={`block h-9 my-[2px] rounded w-full ${active ? "bg-[var(--primary-50)]" : ""
                                                        }`}
                                                    style={{ borderRadius: "var(--radius)" }}
                                                    title={it.label}
                                                >
                                                    <div className="grid" style={{ gridTemplateColumns: `${rail}px` }}>
                                                        <div className="grid place-items-center h-9">
                                                            <IconChild size={18} />
                                                        </div>
                                                    </div>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                // --- MỞ RỘNG: vạch dọc + icon con cách vạch 5px
                                <div className="overflow-hidden">
                                    <div
                                        className="grid items-start"
                                        style={{ gridTemplateColumns: `${halfRail}px 1fr` }}
                                    >
                                        {/* Cột trái: vạch dọc full chiều cao khối con */}
                                        <div className="relative self-stretch">
                                            <span
                                                className="absolute right-0 top-2 bottom-2 w-px"
                                                style={{ background: "var(--border)" }}
                                            />
                                        </div>

                                        {/* Danh sách con: cách vạch 5px */}
                                        <ul className="pl-[24px] min-w-0">
                                            {n.items.map((it) => {
                                                const IconChild = it.icon;
                                                const active = isActive(it.href);
                                                return (
                                                    <li key={it.href} className="min-w-0">
                                                        <Link
                                                            href={it.href}
                                                            className={`block h-9 my-[2px] rounded w-full min-w-0 ${active ? "bg-[var(--primary-50)] text-[var(--primary-800)]" : ""
                                                                }`}
                                                            style={{ borderRadius: "var(--radius)" }}
                                                        >
                                                            {/* 20px icon + 1fr label để icon sát vạch */}
                                                            <div
                                                                className="grid items-center w-full h-full min-w-0 gap-2 px-2"
                                                                style={{ gridTemplateColumns: "20px 1fr" }}
                                                            >
                                                                <div className="flex items-center justify-center w-5 h-5">
                                                                    <IconChild size={18} />
                                                                </div>
                                                                <div className="min-w-0 overflow-hidden whitespace-nowrap">
                                                                    <span className="block max-w-full truncate text-sm">{it.label}</span>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </nav>
    );
}


/* ===== Account popover (portal) ===== */
function AccountBlock({
    rail,
    pad,
    collapsed,
    accountOpen,
    setAccountOpen,
    accountRef,
    session
}) {


    const cols = `${rail}px ${collapsed ? "0fr" : "1fr"}`;
    // refs cho button và popover
    const btnRef = useRef(null);
    const popRef = useRef(null);

    // vị trí popover
    const [pos, setPos] = useState({ top: 0, left: 0, width: 280 });

    // Close bằng ESC
    useEffect(() => {
        const onEsc = (e) => e.key === "Escape" && setAccountOpen(false);
        document.addEventListener("keydown", onEsc);
        return () => document.removeEventListener("keydown", onEsc);
    }, [setAccountOpen]);

    // Tính toán vị trí (popover nổi cạnh avatar, tránh tràn màn hình)
    const place = () => {
        const btn = btnRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        const width = 280;
        let left = r.right + 12 + window.scrollX; // nổi bên phải avatar
        let top = r.top + window.scrollY - 12;

        if (left + width + 8 > window.innerWidth + window.scrollX) {
            left = window.innerWidth + window.scrollX - width - 8;
        }
        setPos((p) => ({ ...p, top, left, width }));

        // lần 2: căn giữa theo chiều cao thật của popover
        requestAnimationFrame(() => {
            const h = popRef.current?.offsetHeight || 0;
            if (!h) return;
            const centeredTop = r.top + window.scrollY - (h - r.height) / 2;
            const clampedTop = Math.max(
                window.scrollY + 8,
                Math.min(centeredTop, window.scrollY + window.innerHeight - h - 8)
            );
            setPos({ top: clampedTop, left, width });
        });
    };

    // Recompute khi mở, resize, scroll
    useLayoutEffect(() => {
        if (!accountOpen) return;
        place();
        const onWin = () => place();
        window.addEventListener("resize", onWin);
        window.addEventListener("scroll", onWin, true);
        return () => {
            window.removeEventListener("resize", onWin);
            window.removeEventListener("scroll", onWin, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountOpen]);

    const toggle = (e) => {
        e.stopPropagation();
        setAccountOpen((v) => !v);
    };

    return (
        <div
            className="relative border-t py-3"
            style={{ borderColor: "var(--border)", paddingInline: pad }}
            ref={accountRef}
        >
            <button
                ref={btnRef}
                className="w-full h-12 rounded hover:bg-[var(--primary-50)]"
                onClick={toggle}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                style={{ borderRadius: "var(--radius)" }}
            >
                <div
                    className="grid items-center w-full h-full min-w-0"
                    style={{
                        gridTemplateColumns: cols,
                        transition: "grid-template-columns .22s cubic-bezier(.2,0,0,1)",
                    }}
                >
                    <div className="grid place-items-center">
                        <img
                            src={session?.user?.image}
                            alt="avatar"
                            className="h-8 w-8 rounded-[var(--radius)]"
                        />
                    </div>

                    {!collapsed && (
                        <div className="flex items-center gap-3 pr-2 min-w-0">
                            <div className="min-w-0 text-left">
                                <div className="truncate leading-tight"> {session?.user?.name || 'User Name'}</div>
                                <div className="text-xs text-muted truncate">   {session?.user?.email || 'User Email'}</div>
                            </div>
                            <div className="ml-auto">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    )}
                </div>
            </button>

            {/* Popover nổi: portal + position: fixed (không bị clip khi thu gọn) */}
            {accountOpen &&
                createPortal(
                    <>
                        {/* overlay trong suốt để bắt click ra ngoài */}
                        <div
                            className="fixed inset-0 z-[60]"
                            onClick={() => setAccountOpen(false)}
                        />
                        <div
                            ref={popRef}
                            className="fixed z-[61] menu animate-pop"
                            style={{ top: pos.top, left: pos.left, width: pos.width }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-3 px-3 py-2">
                                <img
                                    src={session?.user?.image || '/avatar.png'}
                                    alt="avatar"
                                    className="h-8 w-8 rounded-[var(--radius)]"
                                />
                                <div className="min-w-0">
                                    <div className="font-semibold leading-tight truncate">
                                        {session?.user?.name || 'User Name'}
                                    </div>
                                    <div className="text-xs text-muted truncate">
                                        {session?.user?.email || 'User Email'}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="my-1"
                                style={{ borderTop: "1px solid var(--border)" }}
                            />

                            {/* Items */}
                            <ul className="p-1">
                                <li>
                                    <button
                                        className="menu-item w-full text-left"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <Star size={16} /> <span>Upgrade to Pro</span>
                                    </button>
                                </li>
                                <li>
                                    <Link
                                        href="/account"
                                        className="menu-item"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <Users size={16} /> <span>Account</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/billing"
                                        className="menu-item"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <FileCode2 size={16} /> <span>Billing</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/notifications"
                                        className="menu-item"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <Bell size={16} /> <span>Notifications</span>
                                    </Link>
                                </li>
                            </ul>

                            <div
                                className="my-1"
                                style={{ borderTop: "1px solid var(--border)" }}
                            />
                            <div className="p-1">
                                <form action={logoutAction}>
                                    <button
                                        type="submit"
                                        className="menu-item menu-item--danger w-full text-left"
                                        style={{ borderRadius: "var(--radius)" }}
                                    >
                                        <LogOut size={16} /> <span>Log out</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
}
