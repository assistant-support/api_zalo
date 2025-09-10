'use client';

import { usePathname } from 'next/navigation';
import AppShell from './appshell';

export default function ShellGate({ session, children }) {
    const pathname = usePathname();
    const noShell = pathname?.startsWith('/form'); 

    if (noShell) return children;
    if (!session) return children; 

    return <AppShell session={session}>{children}</AppShell>;
}
