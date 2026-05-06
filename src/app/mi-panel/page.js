'use client';

import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import MainLayout from '@/components/MainLayout';
import { getSessionUser, saveSession } from '@/lib/session';

const SERVICE_NEAR_DISTANCE_METERS = 200;

function formatServiceAddress(address) {
    const rawAddress = address?.toString().trim();

    if (!rawAddress) {
        return 'Servicio sin direccion cargada';
    }

    const segments = rawAddress
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);

    if (segments.length === 0) {
        return 'Servicio sin direccion cargada';
    }

    const streetSegment = segments[0];
    const buenosAiresSegment = segments.find((segment, index) => {
        if (index === 0) return false;
        return segment.toLowerCase().includes('buenos aires');
    });

    if (buenosAiresSegment) {
        return `${streetSegment}, ${buenosAiresSegment}`;
    }

    if (segments.length > 1) {
        return `${streetSegment}, ${segments[1]}`;
    }

    return streetSegment;
}

function getDistanceInMeters(lat1, lng1, lat2, lng2) {
    const earthRadius = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(deltaPhi / 2) ** 2
        + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
}

export default function SupervisorHomePage() {
    const [currentUser, setCurrentUser] = useState(null);
    const [services, setServices] = useState([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [status, setStatus] = useState('afuera');
    const [entryCoordinates, setEntryCoordinates] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [biometricCount, setBiometricCount] = useState(0);
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);

    // Pedido de insumos
    const [supplies, setSupplies] = useState([]);
    const [showSupplyForm, setShowSupplyForm] = useState(false);
    const [supplyItems, setSupplyItems] = useState({});
    const [requestNotes, setRequestNotes] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [requestServiceId, setRequestServiceId] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    const selectedService = useMemo(() => {
        return services.find((service) => String(service.id) === selectedServiceId) || null;
    }, [selectedServiceId, services]);

    useEffect(() => {
        let cancelled = false;

        async function loadStatus() {
            try {
                const storedUser = getSessionUser();

                if (!storedUser) {
                    return;
                }

                const resolvedUser = storedUser;

                if (cancelled) return;

                setCurrentUser(resolvedUser);

                const supervisorId = Number(resolvedUser?.id);

                // Acceso rápido sin ID real — mostrar panel vacío
                if (!Number.isFinite(supervisorId) || supervisorId <= 0) {
                    setIsLoading(false);
                    return;
                }

                const response = await fetch(`/api/supervisor-status?supervisor_id=${supervisorId}`);
                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.error || 'No se pudo obtener el estado actual.');
                }

                if (!cancelled) {
                    setStatus(data.status || 'afuera');
                    setSelectedServiceId(data.current_service_id ? String(data.current_service_id) : '');
                    setEntryCoordinates(
                        Number.isFinite(Number(data.entered_lat)) && Number.isFinite(Number(data.entered_lng))
                            ? { lat: Number(data.entered_lat), lng: Number(data.entered_lng) }
                            : null
                    );
                }

                const servicesResponse = await fetch('/api/services');
                const servicesData = await servicesResponse.json().catch(() => ([]));

                if (!servicesResponse.ok) {
                    throw new Error(servicesData.error || 'No se pudieron cargar los servicios.');
                }

                if (!cancelled) {
                    setServices(Array.isArray(servicesData) ? servicesData : []);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError.message || 'No se pudo obtener el estado actual.');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        loadStatus();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!currentUser?.app_user_id) return;
        const loadCount = async () => {
            try {
                const res = await fetch('/api/auth/webauthn/credentials-count', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ appUserId: currentUser.app_user_id }),
                });
                const data = await res.json().catch(() => ({ count: 0 }));
                setBiometricCount(data.count || 0);
            } catch (e) {
                console.error(e);
            }
        };
        loadCount();
    }, [currentUser?.app_user_id]);

    const buttonLabel = useMemo(() => {
        if (isLoading) return 'CARGANDO...';
        return status === 'chambeando' ? 'SALIDA' : 'INGRESAR';
    }, [isLoading, status]);

    const getCurrentCoordinates = async () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            throw new Error('Tu dispositivo no permite obtener la ubicacion exacta.');
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }),
                (geoError) => reject(new Error(geoError.message || 'No se pudo obtener la ubicacion exacta del ingreso.')),
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0,
                }
            );
        });
    };

    const handleToggleStatus = async () => {
        if (!currentUser?.id || currentUser.id <= 0 || isLoading || isSaving) {
            return;
        }

        const nextStatus = status === 'chambeando' ? 'afuera' : 'chambeando';

        if (nextStatus === 'chambeando' && !selectedServiceId) {
            setError('Seleccioná un servicio antes de ingresar.');
            return;
        }

        try {
            setIsSaving(true);
            setError('');

            const ingresoCoordinates = nextStatus === 'chambeando'
                ? await getCurrentCoordinates()
                : null;

            if (
                nextStatus === 'chambeando'
                && ingresoCoordinates
                && Number.isFinite(Number(selectedService?.lat))
                && Number.isFinite(Number(selectedService?.lng))
            ) {
                const distanceMeters = getDistanceInMeters(
                    ingresoCoordinates.lat,
                    ingresoCoordinates.lng,
                    Number(selectedService.lat),
                    Number(selectedService.lng)
                );

                if (distanceMeters > SERVICE_NEAR_DISTANCE_METERS) {
                    await Swal.fire({
                        title: 'No estas en el servicio',
                        text: `Segui igual. La ubicacion de ingreso se registro a ${Math.round(distanceMeters)} metros del servicio seleccionado.`,
                        icon: 'warning',
                        iconColor: '#ef4444',
                        confirmButtonText: 'Entendido',
                        confirmButtonColor: '#ef4444',
                        background: '#ffffff',
                    });
                }
            }

            const response = await fetch('/api/supervisor-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supervisor_id: currentUser.id,
                    status: nextStatus,
                    service_id: nextStatus === 'chambeando' ? Number(selectedServiceId) : undefined,
                    lat: ingresoCoordinates?.lat,
                    lng: ingresoCoordinates?.lng,
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.error || 'No se pudo actualizar el estado.');
            }

            setStatus(data.status || nextStatus);
            setSelectedServiceId(data.current_service_id ? String(data.current_service_id) : '');
            setEntryCoordinates(
                Number.isFinite(Number(data.entered_lat)) && Number.isFinite(Number(data.entered_lng))
                    ? { lat: Number(data.entered_lat), lng: Number(data.entered_lng) }
                    : null
            );
        } catch (saveError) {
            setError(saveError.message || 'No se pudo actualizar el estado.');
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        fetch('/api/supplies')
            .then(r => r.json())
            .then(data => setSupplies(Array.isArray(data) ? data.filter(s => s.activo !== false) : []))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (showSupplyForm) setRequestServiceId(selectedServiceId);
    }, [showSupplyForm, selectedServiceId]);

    const setItemQty = (supplyId, qty) => {
        setSupplyItems(prev => {
            const next = { ...prev };
            if (!qty || qty <= 0) delete next[supplyId];
            else next[supplyId] = qty;
            return next;
        });
    };

    const handleSubmitRequest = async () => {
        if (!requestServiceId) {
            Swal.fire({ title: 'Seleccioná un servicio', icon: 'warning', confirmButtonColor: '#ef4444' });
            return;
        }
        const items = Object.entries(supplyItems)
            .filter(([, qty]) => qty > 0)
            .map(([supply_id, cantidad]) => ({ supply_id: Number(supply_id), cantidad: Number(cantidad) }));

        if (items.length === 0) {
            Swal.fire({ title: 'Agregá al menos un insumo', icon: 'warning', confirmButtonColor: '#ef4444' });
            return;
        }

        setIsSubmittingRequest(true);
        try {
            const res = await fetch('/api/supply-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supervisor_id: currentUser.id,
                    service_id: Number(requestServiceId),
                    items,
                    notas: requestNotes.trim(),
                    urgent: isUrgent,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al enviar el pedido');

            Swal.fire({ title: 'Pedido enviado', text: 'El pedido fue registrado correctamente.', icon: 'success', confirmButtonColor: '#10b981' });
            setSupplyItems({});
            setRequestNotes('');
            setIsUrgent(false);
            setShowSupplyForm(false);
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#ef4444' });
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const handleRegisterBiometric = async () => {
        if (!currentUser?.app_user_id) return;
        setIsBiometricLoading(true);
        try {
            const resOpts = await fetch('/api/auth/webauthn/register-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appUserId: currentUser.app_user_id }),
            });
            const { options, error: optsError } = await resOpts.json();
            if (optsError || !options) throw new Error(optsError || 'No se pudieron generar las opciones de registro');

            const { startRegistration } = await import('@simplewebauthn/browser');
            const credential = await startRegistration({ optionsJSON: options });

            const resVerify = await fetch('/api/auth/webauthn/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appUserId: currentUser.app_user_id, credential }),
            });
            const verifyData = await resVerify.json();
            if (!resVerify.ok || !verifyData.verified) {
                throw new Error(verifyData.error || 'No se pudo registrar el dispositivo biometrico');
            }

            Swal.fire({
                title: 'Registrado',
                text: 'Tu dispositivo biometrico fue registrado con exito.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
            setBiometricCount(1);
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.message || 'No se pudo completar el registro biometrico.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setIsBiometricLoading(false);
        }
    };

    const handleRemoveBiometric = async () => {
        if (!currentUser?.app_user_id) return;
        const confirm = await Swal.fire({
            title: 'Eliminar registro biometrico?',
            text: 'Ya no podras ingresar con huella digital o Face ID.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444',
        });
        if (!confirm.isConfirmed) return;
        setIsBiometricLoading(true);
        try {
            const res = await fetch('/api/auth/webauthn/remove-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appUserId: currentUser.app_user_id }),
            });
            if (!res.ok) throw new Error('Error al eliminar');
            Swal.fire({
                title: 'Eliminado',
                text: 'Tu registro biometrico fue eliminado.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
            setBiometricCount(0);
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: err.message || 'No se pudo eliminar el registro biometrico.',
                icon: 'error',
                confirmButtonColor: '#ef4444'
            });
        } finally {
            setIsBiometricLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="supervisor-home-view">
                <div className="supervisor-home-panel">
                    <div className="form-group supervisor-home-service-group">
                        <label>Ubicacion</label>
                        <select
                            value={selectedServiceId}
                            onChange={(e) => setSelectedServiceId(e.target.value)}
                            disabled={isLoading || isSaving || status === 'chambeando' || services.length === 0}
                        >
                            <option value="">
                                {isLoading
                                    ? 'Cargando servicios...'
                                    : services.length === 0
                                        ? 'No hay servicios cargados'
                                        : 'Seleccioná un servicio'}
                            </option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.name}
                                </option>
                            ))}
                        </select>

                        {selectedService ? (
                            <div className="placeholder-field" style={{ marginTop: '0.75rem' }}>
                                {formatServiceAddress(selectedService.address)}
                            </div>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        className={`btn supervisor-home-button ${status === 'chambeando' ? 'supervisor-home-button-active' : 'btn-primary'}`}
                        onClick={handleToggleStatus}
                        disabled={isLoading || isSaving || !currentUser?.id || currentUser.id <= 0}
                    >
                        {isSaving ? 'GUARDANDO...' : buttonLabel}
                    </button>

                    {!error ? (
                        <>
                            <p className="supervisor-home-status">
                                Estado actual: <strong>{status === 'chambeando' ? 'chambeando' : 'afuera'}</strong>
                                {status === 'chambeando' && selectedService ? ` en ${selectedService.name}` : ''}
                            </p>
                            {status === 'chambeando' && entryCoordinates ? (
                                <p className="supervisor-home-status">
                                    Coordenadas de ingreso: <strong>{entryCoordinates.lat.toFixed(6)}, {entryCoordinates.lng.toFixed(6)}</strong>
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <p className="supervisor-home-error">{error}</p>
                    )}

                    {currentUser?.app_user_id ? (
                        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                Dispositivo biometrico
                            </p>
                            {biometricCount > 0 ? (
                                <>
                                    <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                                        Huella digital / Face ID registrado
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={handleRemoveBiometric}
                                        disabled={isBiometricLoading}
                                    >
                                        {isBiometricLoading ? 'Procesando...' : 'Eliminar registro biometrico'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleRegisterBiometric}
                                    disabled={isBiometricLoading}
                                >
                                    {isBiometricLoading ? 'Procesando...' : 'Registrar huella digital / Face ID'}
                                </button>
                            )}
                        </div>
                    ) : null}

                    {/* Pedido de insumos */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Pedido de insumos</p>
                            <a href="/mi-panel/historico-pedidos" style={{ fontSize: '0.82rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
                                Ver historial →
                            </a>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => setShowSupplyForm(v => !v)}
                        >
                            {showSupplyForm ? 'Cancelar pedido' : 'Nuevo pedido de insumos'}
                        </button>

                        {showSupplyForm && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>Servicio</label>
                                    <select
                                        value={requestServiceId}
                                        onChange={e => setRequestServiceId(e.target.value)}
                                    >
                                        <option value="">Seleccioná un servicio</option>
                                        {services.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Insumos</label>
                                    {supplies.length === 0 ? (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay insumos disponibles.</p>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {supplies.map(supply => (
                                                <div key={supply.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span style={{ flex: 1, fontSize: '0.95rem' }}>
                                                        {supply.nombre}
                                                        {supply.unidad ? <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}> ({supply.unidad})</span> : null}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
                                                            onClick={() => setItemQty(supply.id, Math.max(0, (supplyItems[supply.id] || 0) - 1))}
                                                        >−</button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={supplyItems[supply.id] || ''}
                                                            onChange={e => setItemQty(supply.id, Number(e.target.value))}
                                                            style={{ width: '3.5rem', textAlign: 'center', padding: '0.2rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
                                                            onClick={() => setItemQty(supply.id, (supplyItems[supply.id] || 0) + 1)}
                                                        >+</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Notas (opcional)</label>
                                    <textarea
                                        value={requestNotes}
                                        onChange={e => setRequestNotes(e.target.value)}
                                        placeholder="Aclaraciones sobre el pedido..."
                                        rows={3}
                                        style={{ width: '100%', resize: 'vertical' }}
                                    />
                                </div>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isUrgent}
                                        onChange={e => setIsUrgent(e.target.checked)}
                                    />
                                    <span style={{ fontSize: '0.95rem' }}>Pedido urgente</span>
                                </label>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSubmitRequest}
                                    disabled={isSubmittingRequest}
                                >
                                    {isSubmittingRequest ? 'Enviando...' : 'Enviar pedido'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
