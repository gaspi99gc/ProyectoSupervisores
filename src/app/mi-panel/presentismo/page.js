'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';
import { useRouter } from 'next/navigation';

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    if ((lat1 == lat2) && (lon1 == lon2)) return 0;
    else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) dist = 1;
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344; // to kilometers
        return dist * 1000; // to meters
    }
}

export default function PresentismoPage() {
    const [user, setUser] = useState(null);
    const [services, setServices] = useState([]);
    const [selectedService, setSelectedService] = useState('');
    const [status, setStatus] = useState(''); // 'loading', 'success', 'error'
    const [message, setMessage] = useState('');
    const router = useRouter();

    useEffect(() => {
        const u = localStorage.getItem('currentUser');
        if (!u) {
            router.push('/login');
            return;
        }
        setUser(JSON.parse(u));

        // Load services to pick where they are checking in
        fetch('/api/services')
            .then(res => res.json())
            .then(data => setServices(data))
            .catch(err => console.error(err));
    }, [router]);

    const handleFichada = (type) => {
        if (!selectedService) {
            setMessage('Seleccione un servicio primero.');
            setStatus('error');
            return;
        }

        const service = services.find(s => s.id === parseInt(selectedService));
        if (!service) return;

        setStatus('loading');
        setMessage('Obteniendo ubicación GPS...');

        if (!navigator.geolocation) {
            setStatus('error');
            setMessage('Tu navegador no soporta geolocalización.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                // Calculate distance if service has coords
                let distance = null;
                let verified = false;

                if (service.lat && service.lng) {
                    distance = getDistanceInMeters(latitude, longitude, service.lat, service.lng);
                    verified = distance <= 200; // 200 meters tolerance
                } else {
                    // Service has no coords, assuming verified false or handled by admin later
                    verified = false;
                }

                try {
                    const res = await fetch('/api/attendance', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            supervisor_id: user.id,
                            service_id: service.id,
                            type: type, // 'check-in' or 'check-out'
                            lat: latitude,
                            lng: longitude,
                            verified: verified,
                            distance_meters: distance
                        })
                    });

                    if (res.ok) {
                        setStatus('success');
                        setMessage(`Fichada de ${type === 'check-in' ? 'Entrada' : 'Salida'} registrada con éxito. ${verified ? '✅ Ubicación verificada.' : '⚠️ Ubicación no verificada (Lejos del servicio o servicio sin GPS).'}`);
                    } else {
                        setStatus('error');
                        setMessage('Error al registrar fichada en la base de datos.');
                    }
                } catch (err) {
                    setStatus('error');
                    setMessage('Error de red al registrar fichada.');
                }
            },
            (error) => {
                setStatus('error');
                setMessage(`Error GPS: ${error.message}. Asegúrate de dar permisos de ubicación a la página.`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    if (!user) return null;

    return (
        <MainLayout>
            <div className="presentismo-view" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <h1>📍 Presentismo GPS</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Registra tu asistencia en el servicio</p>
                </header>

                <div className="card">
                    <div className="form-group">
                        <label>Seleccionar Servicio Actual:</label>
                        <select
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem', fontSize: '1rem' }}
                        >
                            <option value="">-- Elige el servicio --</option>
                            {services.map(s => (
                                <option key={s.id} value={s.id}>{s.name} - {s.address}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '1rem', fontSize: '1.2rem', background: 'var(--success)', border: 'none' }}
                            onClick={() => handleFichada('check-in')}
                            disabled={status === 'loading'}
                        >
                            🟢 Entrada
                        </button>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '1rem', fontSize: '1.2rem', background: 'var(--error)', border: 'none' }}
                            onClick={() => handleFichada('check-out')}
                            disabled={status === 'loading'}
                        >
                            🔴 Salida
                        </button>
                    </div>

                    {message && (
                        <div style={{
                            marginTop: '2rem',
                            padding: '1rem',
                            borderRadius: '8px',
                            background: status === 'loading' ? '#e2e8f0' : status === 'success' ? '#dcfce7' : '#fee2e2',
                            color: status === 'success' ? '#166534' : status === 'error' ? '#991b1b' : '#334155',
                            textAlign: 'center',
                            fontWeight: '500'
                        }}>
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
