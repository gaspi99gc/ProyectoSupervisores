'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import MainLayout from '@/components/MainLayout';

export default function ComprasCrearPedidoPage() {
    const [services, setServices] = useState([]);
    const [supervisors, setSupervisors] = useState([]);
    const [supplies, setSupplies] = useState([]);
    const [serviceId, setServiceId] = useState('');
    const [supervisorId, setSupervisorId] = useState('');
    const [items, setItems] = useState({});
    const [notes, setNotes] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/services').then(r => r.json()).catch(() => []),
            fetch('/api/supervisors').then(r => r.json()).catch(() => []),
            fetch('/api/supplies').then(r => r.json()).catch(() => []),
        ]).then(([svcData, supvData, supData]) => {
            setServices(Array.isArray(svcData) ? svcData : []);
            setSupervisors(Array.isArray(supvData) ? supvData.filter(s => s.id) : []);
            setSupplies(Array.isArray(supData) ? supData.filter(s => s.activo !== false) : []);
        }).finally(() => setIsLoading(false));
    }, []);

    const setQty = (supplyId, qty) => {
        setItems(prev => {
            const next = { ...prev };
            if (!qty || qty <= 0) delete next[supplyId];
            else next[supplyId] = qty;
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!serviceId) {
            Swal.fire({ title: 'Seleccioná un servicio', icon: 'warning', confirmButtonColor: '#ef4444' });
            return;
        }
        if (!supervisorId) {
            Swal.fire({ title: 'Seleccioná un supervisor', icon: 'warning', confirmButtonColor: '#ef4444' });
            return;
        }
        const requestItems = Object.entries(items)
            .filter(([, qty]) => qty > 0)
            .map(([supply_id, cantidad]) => ({ supply_id: Number(supply_id), cantidad: Number(cantidad) }));

        if (requestItems.length === 0) {
            Swal.fire({ title: 'Agregá al menos un insumo', icon: 'warning', confirmButtonColor: '#ef4444' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/supply-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    supervisor_id: Number(supervisorId),
                    service_id: Number(serviceId),
                    items: requestItems,
                    notas: notes.trim(),
                    urgent,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al enviar el pedido');

            await Swal.fire({
                title: 'Pedido creado',
                text: 'El pedido fue registrado correctamente.',
                icon: 'success',
                confirmButtonColor: '#10b981',
            });
            setItems({});
            setNotes('');
            setUrgent(false);
            setServiceId('');
            setSupervisorId('');
        } catch (err) {
            Swal.fire({ title: 'Error', text: err.message, icon: 'error', confirmButtonColor: '#ef4444' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <MainLayout>
            <div className="view-container">
                <div className="view-header">
                    <h1 className="view-title">Crear Pedido de Insumos</h1>
                </div>

                {isLoading ? (
                    <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
                ) : (
                    <div className="supervisor-home-panel" style={{ maxWidth: '600px' }}>
                        <div className="form-group">
                            <label>Servicio</label>
                            <select value={serviceId} onChange={e => setServiceId(e.target.value)}>
                                <option value="">Seleccioná un servicio</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label>Supervisor</label>
                            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)}>
                                <option value="">Seleccioná un supervisor</option>
                                {supervisors.map(s => (
                                    <option key={s.id} value={s.id}>{s.surname}, {s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginTop: '1.25rem' }}>
                            <label>Insumos</label>
                            {supplies.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No hay insumos disponibles.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                                    {supplies.map(supply => (
                                        <div key={supply.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{ flex: 1, fontSize: '0.95rem' }}>
                                                {supply.nombre}
                                                {supply.unidad
                                                    ? <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}> ({supply.unidad})</span>
                                                    : null}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.2rem 0.65rem', fontSize: '1.1rem', lineHeight: 1 }}
                                                    onClick={() => setQty(supply.id, Math.max(0, (items[supply.id] || 0) - 1))}
                                                >−</button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={items[supply.id] || ''}
                                                    onChange={e => setQty(supply.id, Number(e.target.value))}
                                                    style={{ width: '3.5rem', textAlign: 'center', padding: '0.25rem 0.3rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.2rem 0.65rem', fontSize: '1.1rem', lineHeight: 1 }}
                                                    onClick={() => setQty(supply.id, (items[supply.id] || 0) + 1)}
                                                >+</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginTop: '1.25rem' }}>
                            <label>Notas (opcional)</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Aclaraciones sobre el pedido..."
                                rows={3}
                                style={{ width: '100%', resize: 'vertical' }}
                            />
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.75rem' }}>
                            <input
                                type="checkbox"
                                checked={urgent}
                                onChange={e => setUrgent(e.target.checked)}
                            />
                            <span style={{ fontSize: '0.95rem' }}>Pedido urgente</span>
                        </label>

                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1.25rem' }}
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Enviando...' : 'Crear pedido'}
                        </button>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
