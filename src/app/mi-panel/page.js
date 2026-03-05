'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import Link from 'next/link';

export default function MiPanelParams() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const u = localStorage.getItem('currentUser');
        if (u) setUser(JSON.parse(u));
    }, []);

    if (!user) return <MainLayout>Cargando...</MainLayout>;

    return (
        <MainLayout>
            <div className="dashboard-view">
                <header className="flex-between" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Panel del Supervisor</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Hola, {user.name} {user.surname}</p>
                    </div>
                </header>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <Link href="/mi-panel/presentismo" style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-5px)' } }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📍</div>
                            <h2>Presentismo</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Fichada GPS en servicios</p>
                        </div>
                    </Link>

                    <Link href="/mi-panel/relevamiento" style={{ textDecoration: 'none' }}>
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-5px)' } }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
                            <h2>Relevamiento</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Pedido semanal de insumos</p>
                        </div>
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}
