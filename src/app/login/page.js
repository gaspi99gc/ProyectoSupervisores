'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginScreen() {
    const [dni, setDni] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni })
            });

            const data = await res.json();

            if (res.ok && data.user) {
                // En una app real usaríamos Cookies/JWT. Por ahora mantenemos localStorage
                // para afectar lo menos posible la migración inicial.
                localStorage.setItem('currentUser', JSON.stringify(data.user));

                // Redirigir según rol
                if (data.user.role === 'admin') {
                    router.push('/'); // Dashboard Admin
                } else {
                    router.push('/mi-panel'); // Panel Supervisor
                }
            } else {
                setError(data.error || 'DNI incorrecto.');
            }
        } catch (err) {
            setError('Error de conexión al servidor.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-logo">
                    <img src="/lasia-logo.png" alt="LASIA" style={{ maxWidth: '200px', display: 'block', margin: '0 auto 20px' }} />
                    <h2>Sistema de Supervisores</h2>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>DNI del Supervisor</label>
                        <input
                            type="text"
                            value={dni}
                            onChange={(e) => setDni(e.target.value)}
                            placeholder="Ingrese su DNI (ej: admin)"
                            required
                        />
                    </div>
                    {error && <p className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
                    <button type="submit" className="login-btn">
                        Ingresar
                    </button>
                </form>
            </div>
        </div>
    );
}
