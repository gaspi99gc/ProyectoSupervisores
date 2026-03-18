'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MiPanelRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/mi-panel/presentismo');
    }, [router]);
    return null;
}
