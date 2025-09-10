'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { nav } from './sidebar';

const defaultNav = nav

/** Beautify fallback segment -> "nang-mui" => "Nang Mui" (không thêm dấu) */
function toTitle(text) {
    if (!text) return '';
    return decodeURIComponent(text)
        .split('-')
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
}

/** Ghép đường dẫn lũy tiến cho các crumb */
function joinPath(parts) {
    const p = parts.filter(Boolean).join('/');
    return ('/' + p).replace(/\/+/g, '/');
}

/** Tìm item khớp nhất theo pathname: exact > prefix dài nhất; nếu trùng, ưu tiên nhóm xuất hiện sớm */
function findBestMatch(nav, pathname) {
    const flat = [];
    nav.forEach((g, gi) => {
        g.items?.forEach((it, ii) => {
            flat.push({ ...it, _group: g, _gi: gi, _ii: ii });
        });
    });

    // 1) exact match
    let best = flat.find((it) => it.href === pathname);

    // 2) prefix longest (bỏ qua '/')
    if (!best) {
        const cands = flat
            .filter((it) => it.href !== '/' && pathname.startsWith(it.href + '/'))
            .sort((a, b) => b.href.length - a.href.length || a._gi - b._gi || a._ii - b._ii);
        best = cands[0];
    }

    // 3) root '/' nếu không có gì
    if (!best) best = flat.find((it) => it.href === '/');

    return best || null;
}

/**
 * Breadcrumbs — tự map label tiếng Việt từ nav config.
 * Props:
 *  - nav?: cấu hình điều hướng (nếu không truyền, dùng defaultNav)
 *  - showGroup?: có hiển thị label nhóm không (default: true)
 *  - className?: string
 */
export default function Breadcrumbs({ nav = defaultNav, showGroup = true, className = '' }) {
    const pathname = usePathname();

    const crumbs = useMemo(() => {
        const segments = pathname.split('/').filter(Boolean);
        const best = findBestMatch(nav, pathname);

        // Nếu tìm được item trong nav:
        if (best) {
            const group = best._group;
            const baseHref = best.href === '/' ? '' : best.href; // phần cố định từ nav
            const baseSegs = baseHref.split('/').filter(Boolean);
            const restSegs = segments.slice(baseSegs.length); // đuôi động

            const items = [];

            if (showGroup && group?.label) {
                // group -> link về item đầu tiên của group nếu có
                const groupHome = group.items?.[0]?.href || '/';
                items.push({ href: groupHome, label: group.label, isGroup: true });
            }

            // item chính (từ nav)
            items.push({ href: best.href, label: best.label, icon: best.icon });

            // phần động còn lại
            let acc = best.href;
            restSegs.forEach((seg) => {
                acc = joinPath([acc, seg]);
                items.push({ href: acc, label: toTitle(seg) });
            });

            return items;
        }

        // Fallback: không thấy trong nav -> tách URL thường
        const items = [];
        let acc = '';
        segments.forEach((seg, i) => {
            acc = joinPath([acc, seg]);
            items.push({ href: acc, label: toTitle(seg), isLast: i === segments.length - 1 });
        });
        return items.length ? items : [{ href: '/', label: 'Tổng quan' }];
    }, [nav, pathname, showGroup]);

    const lastIndex = crumbs.length - 1;

    return (
        <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm ${className}`}>
            {crumbs.map((c, i) => {
                const isLast = i === lastIndex;
                const Icon = c.icon;
                const content = (
                    <>
                        <span className={isLast ? 'font-semibold' : 'text-[var(--muted)] hover:text-[var(--text)]'}>
                            {c.label}
                        </span>
                    </>
                );

                return (
                    <div key={c.href + i} className="flex items-center gap-1">
                        {isLast ? (
                            <span className="truncate max-w-[40vw]">{content}</span>
                        ) : (
                            <Link href={c.href || '#'} className="truncate max-w-[40vw]">
                                {content}
                            </Link>
                        )}
                        {i < lastIndex && <ChevronRight size={14} className="text-[var(--muted)]" />}
                    </div>
                );
            })}
        </nav>
    );
}
