'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';

export default function InsumosPurchasesPage() {
    const [supplies, setSupplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingSupply, setEditingSupply] = useState(null);
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/supplies');
            if (res.ok) setSupplies(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openModal = (supply = {}) => {
        setEditingSupply(supply);
        setFormData(supply.id ? { nombre: supply.nombre, unidad: supply.unidad, activo: supply.activo !== false } : { nombre: '', unidad: 'unidades', activo: true });
    };

    const closeModal = () => setEditingSupply(null);

    const handleSave = async () => {
        if (!formData.nombre?.trim()) {
            alert('Ingresá el nombre del insumo.');
            return;
        }

        setSaving(true);
        try {
            const url = editingSupply?.id ? `/api/supplies/${editingSupply.id}` : '/api/supplies';
            const method = editingSupply?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                await load();
                closeModal();
            } else {
                alert(data.error || 'Error al guardar');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (supply) => {
        if (!confirm(`¿Eliminar "${supply.nombre}"?`)) return;
        const res = await fetch(`/api/supplies/${supply.id}`, { method: 'DELETE' });
        if (res.ok) {
            setSupplies(supplies.filter(s => s.id !== supply.id));
        } else {
            alert('No se pudo eliminar el insumo.');
        }
    };

    return (
        <MainLayout>
            <div>
                <header className="page-header" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Insumos</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Catálogo de insumos disponibles para pedidos</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => openModal()}>+ Añadir Insumo</button>
                </header>

                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table className="table mobile-cards-table">
                            <thead>
                                <tr>
                                    <th>Insumo</th>
                                    <th>Unidad de Medida</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando...</td></tr>
                                ) : supplies.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay insumos cargados.</td></tr>
                                ) : supplies.map(s => (
                                    <tr key={s.id}>
                                        <td data-label="Insumo"><strong>{s.nombre}</strong></td>
                                        <td data-label="Unidad de Medida">{s.unidad}</td>
                                        <td data-label="Estado">
                                            <span className={`badge ${s.activo ? 'badge-success' : 'badge-danger'}`}>
                                                {s.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td data-label="Acciones" className="mobile-hide-label" style={{ textAlign: 'right' }}>
                                            <div className="table-action-group">
                                                <button className="btn btn-secondary" onClick={() => openModal(s)}>✏️</button>
                                                <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={() => handleDelete(s)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {editingSupply !== null && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingSupply?.id ? 'Editar Insumo' : 'Añadir Insumo'}</h2>

                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <input
                                type="text" placeholder="Nombre del insumo (ej: Lavandina)" className="card" style={{ margin: 0 }}
                                value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            />
                            <input
                                type="text" placeholder="Unidad (ej: litros, unidades, kg)" className="card" style={{ margin: 0 }}
                                value={formData.unidad || ''} onChange={e => setFormData({ ...formData, unidad: e.target.value })}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="supply-active"
                                    checked={formData.activo !== false}
                                    onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                                    style={{ width: 'auto', margin: 0 }}
                                />
                                <label htmlFor="supply-active" style={{ margin: 0 }}>Insumo activo</label>
                            </div>
                        </div>
                        <div className="config-modal-actions" style={{ marginTop: '2rem' }}>
                            <button className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
