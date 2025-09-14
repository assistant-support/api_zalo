// /app/_client/AuthRealtime.tsx
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getSocket } from "@/lib/socket-client";

export default function AuthRealtime() {
    const { data: session, update } = useSession();
    useEffect(() => {
        const s = getSocket();
        const uid = session?.user?.id;
        if (!s || !uid) return;
        const room = `room:user:${uid}`;
        s.emit("join", room);
        const onInvalidate = () => {
            // Cập nhật session (next-auth v5)
            update();
        };
        s.on("auth:invalidate", onInvalidate);
        return () => {
            s.emit("leave", room);
            s.off("auth:invalidate", onInvalidate);
        };
    }, [session?.user?.id, update]);

    return null;
}
