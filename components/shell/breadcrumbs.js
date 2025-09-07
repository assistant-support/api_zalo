"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

function toTitle(text) {
    if (!text) return "";
    return text
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
}

export default function Breadcrumbs() {
    const pathname = usePathname();
    const segments = pathname.split("/").filter(Boolean);
    const items = ["Dashboard", ...segments.map(toTitle)];

    return (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
            {items.map((seg, i) => (
                <div key={i} className="flex items-center gap-1">
                    <span className={i === items.length - 1 ? "font-semibold" : "text-muted"}>{seg}</span>
                    {i < items.length - 1 && <ChevronRight size={14} className="text-muted" />}
                </div>
            ))}
        </nav>
    );
}
