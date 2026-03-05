'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import MainLayout from '@/components/MainLayout';

export default function PeriodoPruebaPage() {
    const [employees, setEmployees] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [empRes, servRes] = await Promise.all([
                    fetch('/api/employees'),
                    fetch('/api/services')
                ]);
                if (empRes.ok) setEmployees(await empRes.json());
                if (servRes.ok) setServices(await servRes.json());
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const exportTrialPeriodsToExcel = () => {
        const activeEmployees = employees.filter(e => e.estado_empleado === 'Activo');
        const sorted = [...activeEmployees].sort((a, b) => new Date(a.fecha_fin_prueba) - new Date(b.fecha_fin_prueba));

        const data = sorted.map(emp => {
            const hoy = new Date();
            const vto = new Date(emp.fecha_fin_prueba);
            const diffDays = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));

            let status = 'En Curso';
            if (diffDays < 0) status = 'Vencido';
            else if (diffDays <= 15) status = 'Próximo a Vencer';

            return {
                'Legajo': emp.legajo,
                'Apellido': emp.apellido,
                'Nombre': emp.nombre,
                'DNI': emp.dni,
                'CUIL': emp.cuil,
                'Servicio': emp.service_name || services.find(s => s.id === parseInt(emp.servicio_id))?.name || '---',
                'Fecha Ingreso': emp.fecha_ingreso,
                'Vencimiento Prueba': emp.fecha_fin_prueba,
                'Días Restantes': diffDays,
                'Estado': status
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vencimientos");
        XLSX.writeFile(workbook, `Reporte_Prueba_LASIA_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const activeEmployees = employees.filter(e => e.estado_empleado === 'Activo' && e.fecha_fin_prueba);
    const sorted = [...activeEmployees].sort((a, b) => new Date(a.fecha_fin_prueba) - new Date(b.fecha_fin_prueba));

    return (
        <MainLayout>
            <div className="periodo-prueba-view">
                <header className="flex-between" style={{ marginBottom: '2rem' }}>
                    <div>
                        <h1>Control de Períodos de Prueba</h1>
                        <p style={{ color: 'var(--text-muted)' }}>Gestión de estabilidad laboral (6 meses)</p>
                    </div>
                    <button className="btn btn-primary" onClick={exportTrialPeriodsToExcel}>📥 Descargar Informe Excel</button>
                </header>

                {loading ? (
                    <p>Cargando datos...</p>
                ) : (
                    <div className="card" style={{ padding: 0 }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Empleado</th>
                                    <th>Legajo</th>
                                    <th>Fecha Ingreso</th>
                                    <th>Vencimiento</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(emp => {
                                    const hoy = new Date();
                                    const vto = new Date(emp.fecha_fin_prueba);
                                    const diff = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));
                                    const status = diff < 0 ? 'badge-danger' : diff <= 15 ? 'badge-warning' : 'badge-success';
                                    const label = diff < 0 ? 'Vencido' : diff <= 15 ? 'Por Vencer' : 'Vigente';

                                    return (
                                        <tr key={emp.id}>
                                            <td><strong>{emp.apellido}, {emp.nombre}</strong></td>
                                            <td>{emp.legajo}</td>
                                            <td>{new Date(emp.fecha_ingreso).toLocaleDateString()}</td>
                                            <td><strong>{new Date(emp.fecha_fin_prueba).toLocaleDateString()}</strong></td>
                                            <td><span className={`badge ${status}`}>{label}</span></td>
                                            <td><button className="btn btn-secondary" onClick={() => window.location.href = '/rrhh'}>Gestión</button></td>
                                        </tr>
                                    );
                                })}
                                {sorted.length === 0 && (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '1rem' }}>No hay empleados en período de prueba</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
