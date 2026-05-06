'use client';

import MainLayout from '@/components/MainLayout';

export default function JefeOperativoPage() {
    return (
        <MainLayout>
            <div>
                <header className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Panel Jefe Operativo</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Panel en construcción</p>
                    </div>
                </header>
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '1.1rem' }}>Las vistas del jefe operativo están siendo configuradas.</p>
                </div>
            </div>
        </MainLayout>
    );
}
