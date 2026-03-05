'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/MainLayout';

export default function ConfigPage() {
    const [configTab, setConfigTab] = useState('supervisors');
    const [editingEntity, setEditingEntity] = useState(null);
    const [formData, setFormData] = useState({});

    const [supervisors, setSupervisors] = useState([]);
    const [services, setServices] = useState([]);
    const [supplies, setSupplies] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [supRes, servRes, supListRes] = await Promise.all([
                    fetch('/api/supervisors'),
                    fetch('/api/services'),
                    fetch('/api/supplies')
                ]);
                if (supRes.ok) setSupervisors(await supRes.json());
                if (servRes.ok) setServices(await servRes.json());
                if (supListRes.ok) setSupplies(await supListRes.json());
            } catch (err) {
                console.error(err);
            }
        };
        load();
    }, []);

    const openModal = (type, data = null) => {
        setEditingEntity({ type, data });
        if (type === 'supervisor') {
            setFormData(data || { name: '', surname: '', dni: '' });
        } else if (type === 'service') {
            setFormData(data || { name: '', address: '', lat: '', lng: '' });
        } else if (type === 'supply') {
            setFormData(data || { nombre: '', unidad: '', activo: true });
        }
    };

    const handleSave = async () => {
        const type = editingEntity.type;
        const isEdit = !!editingEntity.data;
        let endpoint = '/api/services';
        if (type === 'supervisor') endpoint = '/api/supervisors';
        else if (type === 'supply') endpoint = '/api/supplies';
        const url = isEdit ? `${endpoint}/${editingEntity.data.id}` : endpoint;
        const method = isEdit ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                if (type === 'supervisor') {
                    if (isEdit) {
                        setSupervisors(supervisors.map(s => s.id === editingEntity.data.id ? { ...s, ...formData } : s));
                    } else {
                        const newSup = await res.json();
                        setSupervisors([...supervisors, newSup]);
                    }
                } else if (type === 'service') {
                    if (isEdit) {
                        setServices(services.map(s => s.id === editingEntity.data.id ? { ...s, ...formData } : s));
                    } else {
                        const newServ = await res.json();
                        setServices([...services, newServ]);
                    }
                } else if (type === 'supply') {
                    if (isEdit) {
                        setSupplies(supplies.map(s => s.id === editingEntity.data.id ? { ...s, ...formData } : s));
                    } else {
                        const newSupply = await res.json();
                        setSupplies([...supplies, newSupply]);
                    }
                }
                setEditingEntity(null);
            } else {
                const data = await res.json();
                alert(data.error || 'Error al guardar');
            }
        } catch (err) {
            console.error(err);
            alert('Error de red');
        }
    };

    const handleDelete = async (type, id) => {
        if (!confirm(`¿Estás seguro de eliminar este ${type === 'supervisor' ? 'supervisor' : 'servicio'}?`)) return;

        const endpoint = type === 'supervisor' ? `/api/supervisors/${id}` : type === 'service' ? `/api/services/${id}` : `/api/supplies/${id}`;
        try {
            const res = await fetch(endpoint, { method: 'DELETE' });
            if (res.ok) {
                if (type === 'supervisor') {
                    setSupervisors(supervisors.filter(s => s.id !== id));
                } else if (type === 'service') {
                    setServices(services.filter(s => s.id !== id));
                } else if (type === 'supply') {
                    setSupplies(supplies.filter(s => s.id !== id));
                }
            } else {
                alert('No se pudo eliminar');
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <MainLayout>
            <div className="config-view">
                <header className="flex-between" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Configuración del Sistema</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Gestión de recursos y acceso</p>
                    </div>
                    <div className="tabs" style={{ display: 'flex', gap: '1rem', background: '#eee', padding: '0.4rem', borderRadius: '12px' }}>
                        <button
                            className={`btn ${configTab === 'supervisors' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setConfigTab('supervisors')}
                            style={{ boxShadow: configTab === 'supervisors' ? '' : 'none' }}
                        >
                            Supervisores
                        </button>
                        <button
                            className={`btn ${configTab === 'services' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setConfigTab('services')}
                            style={{ boxShadow: configTab === 'services' ? '' : 'none' }}
                        >
                            Servicios
                        </button>
                        <button
                            className={`btn ${configTab === 'supplies' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setConfigTab('supplies')}
                            style={{ boxShadow: configTab === 'supplies' ? '' : 'none' }}
                        >
                            Insumos
                        </button>
                    </div>
                </header>

                {configTab === 'supervisors' ? (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="flex-between" style={{ padding: '1.5rem' }}>
                            <h3>Lista de Supervisores</h3>
                            <button className="btn btn-primary" onClick={() => openModal('supervisor')}>+ Añadir Supervisor</button>
                        </div>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nombre completo</th>
                                    <th>DNI (Acceso)</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supervisors.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.surname}, {s.name}</strong></td>
                                        <td>{s.dni}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-secondary" style={{ marginRight: '0.5rem' }} onClick={() => openModal('supervisor', s)}>✏️</button>
                                            <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={() => handleDelete('supervisor', s.id)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : configTab === 'services' ? (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="flex-between" style={{ padding: '1.5rem' }}>
                            <h3>Lista de Servicios</h3>
                            <button className="btn btn-primary" onClick={() => openModal('service')}>+ Añadir Servicio</button>
                        </div>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Servicio</th>
                                    <th>Ubicación</th>
                                    <th>Coordenadas</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {services.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.name}</strong></td>
                                        <td>{s.address}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {Number(s.lat)?.toFixed(4)}, {Number(s.lng)?.toFixed(4)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-secondary" style={{ marginRight: '0.5rem' }} onClick={() => openModal('service', s)}>✏️</button>
                                            <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={() => handleDelete('service', s.id)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : configTab === 'supplies' ? (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="flex-between" style={{ padding: '1.5rem' }}>
                            <h3>Lista Fija de Insumos</h3>
                            <button className="btn btn-primary" onClick={() => openModal('supply')}>+ Añadir Insumo</button>
                        </div>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Insumo</th>
                                    <th>Unidad de Medida</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {supplies.map(s => (
                                    <tr key={s.id}>
                                        <td><strong>{s.nombre}</strong></td>
                                        <td>{s.unidad}</td>
                                        <td>
                                            <span className={`badge ${s.activo ? 'badge-success' : 'badge-danger'}`}>
                                                {s.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-secondary" style={{ marginRight: '0.5rem' }} onClick={() => openModal('supply', s)}>✏️</button>
                                            <button className="btn btn-secondary" style={{ color: 'var(--error)' }} onClick={() => handleDelete('supply', s.id)}>🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}

                {editingEntity && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h2>{editingEntity.data ? 'Editar' : 'Crear'} {editingEntity.type === 'supervisor' ? 'Supervisor' : 'Servicio'}</h2>
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {editingEntity.type === 'supervisor' ? (
                                    <>
                                        <input
                                            type="text" placeholder="Nombre" className="card" style={{ margin: 0 }}
                                            value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                        <input
                                            type="text" placeholder="Apellido" className="card" style={{ margin: 0 }}
                                            value={formData.surname || ''} onChange={e => setFormData({ ...formData, surname: e.target.value })}
                                        />
                                        <input
                                            type="text" placeholder="DNI" className="card" style={{ margin: 0 }}
                                            value={formData.dni || ''} onChange={e => setFormData({ ...formData, dni: e.target.value })}
                                        />
                                    </>
                                ) : editingEntity.type === 'service' ? (
                                    <>
                                        <input
                                            type="text" placeholder="Nombre del Servicio" className="card" style={{ margin: 0 }}
                                            value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                        <input
                                            type="text" placeholder="Dirección" className="card" style={{ margin: 0 }}
                                            value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        />
                                        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: 0 }}>
                                            <input
                                                type="number" placeholder="Latitud" className="card" style={{ margin: 0 }}
                                                value={formData.lat || ''} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                                            />
                                            <input
                                                type="number" placeholder="Longitud" className="card" style={{ margin: 0 }}
                                                value={formData.lng || ''} onChange={e => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <button className="btn btn-secondary" onClick={() => {
                                            navigator.geolocation.getCurrentPosition(pos => {
                                                setFormData({ ...formData, lat: pos.coords.latitude, lng: pos.coords.longitude });
                                            }, err => alert("No se pudo obtener la ubicación: " + err.message));
                                        }}>
                                            📍 Capturar posición actual
                                        </button>
                                    </>
                                ) : editingEntity.type === 'supply' ? (
                                    <>
                                        <input
                                            type="text" placeholder="Nombre del Insumo (ej: Lavandina)" className="card" style={{ margin: 0 }}
                                            value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        />
                                        <input
                                            type="text" placeholder="Unidad (ej: litros, unidades)" className="card" style={{ margin: 0 }}
                                            value={formData.unidad || ''} onChange={e => setFormData({ ...formData, unidad: e.target.value })}
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                                            <input
                                                type="checkbox"
                                                id="supply-active"
                                                checked={formData.activo === undefined ? true : formData.activo}
                                                onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                                                style={{ width: 'auto', margin: 0 }}
                                            />
                                            <label htmlFor="supply-active" style={{ margin: 0 }}>Insumo Activo</label>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                            <div className="flex-between" style={{ marginTop: '2rem' }}>
                                <button className="btn btn-secondary" onClick={() => setEditingEntity(null)}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSave}>
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
