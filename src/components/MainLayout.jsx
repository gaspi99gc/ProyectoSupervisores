'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

export default function MainLayout({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // For easy dev migration, using localStorage for auth
        const saved = localStorage.getItem('currentUser');
        if (!saved) {
            router.push('/login');
        } else {
            setCurrentUser(JSON.parse(saved));
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        router.push('/login');
    };

    if (!currentUser) return null; // Wait for auth

    return (
        <div className="app-wrapper">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    LASIA <span>LIMPIEZA</span>
                </div>
                <nav className="sidebar-menu">
                    {currentUser.role === 'admin' ? (
                        <>
                            <Link href="/">
                                <div className={`menu-item ${pathname === '/' ? 'active' : ''}`}>
                                    🏠 Dashboard
                                </div>
                            </Link>
                            <Link href="/rrhh">
                                <div className={`menu-item ${pathname === '/rrhh' || pathname === '/periodo-prueba' ? 'active' : ''}`}>
                                    👥 RRHH
                                </div>
                            </Link>
                            <Link href="/supervisores">
                                <div className={`menu-item ${pathname === '/supervisores' ? 'active' : ''}`}>
                                    📋 Supervisores
                                </div>
                            </Link>
                            <Link href="/config">
                                <div className={`menu-item ${pathname === '/config' ? 'active' : ''}`}>
                                    ⚙ Configuración
                                </div>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href="/mi-panel/presentismo">
                                <div className={`menu-item ${pathname === '/mi-panel/presentismo' ? 'active' : ''}`}>
                                    📍 Fichaje
                                </div>
                            </Link>
                            <Link href="/mi-panel/relevamiento">
                                <div className={`menu-item ${pathname === '/mi-panel/relevamiento' ? 'active' : ''}`}>
                                    📦 Insumos
                                </div>
                            </Link>
                        </>
                    )}
                </nav>
                <div style={{ padding: '1rem 2rem' }}>
                    <button className="btn btn-secondary" style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: '#fff' }} onClick={handleLogout}>
                        🚪 Cerrar Sesión
                    </button>
                </div>
                <div style={{ padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                    Digitalización Integral<br />
                    {currentUser.name} {currentUser.surname}
                </div>
            </aside>

            <main className="main-container">
                <div className="content-area">
                    {children}
                </div>
            </main>
        </div>
    );
}
