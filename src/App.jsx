import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { defaultSupervisors, defaultServices } from './data';
import HRSection from './components/HRSection';
import './index.css';

function App() {
  // State for data
  const [supervisors, setSupervisors] = useState([]);
  const [services, setServices] = useState([]);
  const [visitedServices, setVisitedServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([
    { id: 1, nombre: 'DNI', requiere_vencimiento: false, dias_alerta: 30, obligatorio: true },
    { id: 2, nombre: 'CUIL/CUIT', requiere_vencimiento: false, dias_alerta: 30, obligatorio: true },
    { id: 3, nombre: 'Alta Temprana', requiere_vencimiento: false, dias_alerta: 30, obligatorio: true },
    { id: 4, nombre: 'Apto Médico', requiere_vencimiento: true, dias_alerta: 30, obligatorio: true },
    { id: 5, nombre: 'ART', requiere_vencimiento: true, dias_alerta: 15, obligatorio: true },
    { id: 6, nombre: 'Constancia Domicilio', requiere_vencimiento: false, dias_alerta: 30, obligatorio: false },
  ]);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // UI State
  const [view, setView] = useState('dashboard'); // 'dashboard', 'visitas', 'rrhh', 'periodo-prueba', 'config'
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(null); // 'supervisors', 'services'
  const [showVisitForm, setShowVisitForm] = useState(null);
  const [suppliesNote, setSuppliesNote] = useState('');

  // Load / Save Data
  useEffect(() => {
    const savedData = {
      supervisors: localStorage.getItem('app-supervisors'),
      services: localStorage.getItem('app-services'),
      visits: localStorage.getItem('app-visits'),
      employees: localStorage.getItem('app-employees'),
      docTypes: localStorage.getItem('app-doc-types'),
      empDocs: localStorage.getItem('app-emp-docs'),
      audits: localStorage.getItem('app-audits'),
    };

    setSupervisors(savedData.supervisors ? JSON.parse(savedData.supervisors) : defaultSupervisors);
    setServices(savedData.services ? JSON.parse(savedData.services) : defaultServices);
    setVisitedServices(savedData.visits ? JSON.parse(savedData.visits) : []);
    setEmployees(savedData.employees ? JSON.parse(savedData.employees) : []);
    if (savedData.docTypes) setDocumentTypes(JSON.parse(savedData.docTypes));
    setEmployeeDocuments(savedData.empDocs ? JSON.parse(savedData.empDocs) : []);
    setAuditLogs(savedData.audits ? JSON.parse(savedData.audits) : []);
  }, []);

  useEffect(() => { localStorage.setItem('app-supervisors', JSON.stringify(supervisors)); }, [supervisors]);
  useEffect(() => { localStorage.setItem('app-services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('app-visits', JSON.stringify(visitedServices)); }, [visitedServices]);
  useEffect(() => { localStorage.setItem('app-employees', JSON.stringify(employees)); }, [employees]);
  useEffect(() => { localStorage.setItem('app-doc-types', JSON.stringify(documentTypes)); }, [documentTypes]);
  useEffect(() => { localStorage.setItem('app-emp-docs', JSON.stringify(employeeDocuments)); }, [employeeDocuments]);
  useEffect(() => { localStorage.setItem('app-audits', JSON.stringify(auditLogs)); }, [auditLogs]);

  // Fix: Excel Export with Blob for better compatibility
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
        'Servicio': services.find(s => s.id === parseInt(emp.servicio_id))?.name || '---',
        'Fecha Ingreso': emp.fecha_ingreso,
        'Vencimiento Prueba': emp.fecha_fin_prueba,
        'Días Restantes': diffDays,
        'Estado': status
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vencimientos");

    // Using writeFile direct method from xlsx
    XLSX.writeFile(workbook, `Reporte_Prueba_LASIA_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Metrics logic
  const activeEmpCount = employees.filter(e => e.estado_empleado === 'Activo').length;
  const criticalCount = employees.filter(emp => {
    const mandatoryTypes = documentTypes.filter(t => t.obligatorio);
    return mandatoryTypes.some(type => {
      const doc = employeeDocuments.find(d => d.empleado_id === emp.id && d.documento_tipo_id === type.id);
      if (!doc) return true; // Missing
      if (!type.requiere_vencimiento) return false;
      return new Date(doc.fecha_vencimiento) < new Date(); // Vencido
    });
  }).length;
  const expiringTrialCount = employees.filter(e => {
    if (e.estado_empleado !== 'Activo') return false;
    const diff = (new Date(e.fecha_fin_prueba) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 15;
  }).length;

  const renderDashboard = () => (
    <div className="dashboard-view">
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Dashboard Holístico</h1>
          <p style={{ color: 'var(--text-muted)' }}>Bienvenido al panel central de LASIA</p>
        </div>
      </header>

      <div className="metrics-grid">
        <div className="metric-card">
          <label>Personal Activo</label>
          <div className="value">{activeEmpCount}</div>
          <div className="trend up">▲ +12 este mes</div>
        </div>
        <div className="metric-card">
          <label>Legajos Críticos</label>
          <div className="value" style={{ color: 'var(--error)' }}>{criticalCount}</div>
          <div className="trend down">▼ Revisión urgente</div>
        </div>
        <div className="metric-card">
          <label>Vtos. Prueba (15d)</label>
          <div className="value" style={{ color: 'var(--warning)' }}>{expiringTrialCount}</div>
          <div className="trend up">🟡 Pendientes</div>
        </div>
        <div className="metric-card">
          <label>Docs Pendientes</label>
          <div className="value">14</div>
          <div className="trend down">🔴 -3 hoy</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="card">
          <div className="flex-between">
            <h3>Estadísticas RRHH</h3>
            <button className="btn btn-secondary">Config</button>
          </div>
          <div className="graph-placeholder">
            Gráfico de Tendencias RRHH (Próximamente)
          </div>
        </div>
        <div className="card">
          <h3>Vencimientos próximos</h3>
          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table style={{ fontSize: '0.8rem' }}>
              <tbody>
                {employees.filter(e => e.estado_empleado === 'Activo').slice(0, 5).map(emp => (
                  <tr key={emp.id}>
                    <td><strong>{emp.apellido}, {emp.nombre}</strong></td>
                    <td><span className="badge badge-warning">Prueba</span></td>
                    <td style={{ textAlign: 'right' }}>{emp.fecha_fin_prueba}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderVisitas = () => (
    <div className="visitas-view">
      {!selectedSupervisor ? (
        <>
          <header className="flex-between" style={{ marginBottom: '2rem' }}>
            <div>
              <h1>Panel de Supervisores</h1>
              <p style={{ color: 'var(--text-muted)' }}>Selecciona un supervisor para registrar visitas</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfigModal('supervisors')}>Admin Supervisores</button>
              <button className="btn btn-secondary" onClick={() => setShowConfigModal('services')}>Admin Servicios</button>
            </div>
          </header>
          <div className="grid">
            {supervisors.map(s => (
              <div key={s.id} className="card clickable-row" onClick={() => setSelectedSupervisor(s)}>
                <h3>{s.name} {s.surname}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Supervisor de Servicios</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <header className="flex-between" style={{ marginBottom: '2rem' }}>
            <div>
              <button className="btn btn-secondary" onClick={() => setSelectedSupervisor(null)} style={{ marginBottom: '0.5rem' }}>← Cambiar</button>
              <h1>{selectedSupervisor.name} {selectedSupervisor.surname}</h1>
            </div>
            <input
              type="text"
              placeholder="Buscar servicio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="card" style={{ marginBottom: 0, padding: '0.5rem 1rem', width: '250px' }}
            />
          </header>
          <div className="grid">
            {services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(service => {
              const visit = visitedServices.find(v => v.serviceId === service.id && v.supervisorId === selectedSupervisor.id);
              return (
                <div key={service.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4>{service.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{service.address}</p>
                    {visit && <span className="badge badge-success">✔ Visitado</span>}
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowVisitForm(service)}>
                    {visit ? 'Revisar' : 'Registrar'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const renderPeriodoPrueba = () => {
    const activeEmployees = employees.filter(e => e.estado_empleado === 'Activo');
    const sorted = [...activeEmployees].sort((a, b) => new Date(a.fecha_fin_prueba) - new Date(b.fecha_fin_prueba));

    return (
      <div className="periodo-prueba-view">
        <header className="flex-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1>Control de Períodos de Prueba</h1>
            <p style={{ color: 'var(--text-muted)' }}>Gestión de estabilidad laboral (6 meses)</p>
          </div>
          <button className="btn btn-primary" onClick={exportTrialPeriodsToExcel}>📥 Descargar Informe Excel</button>
        </header>

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
                    <td>{emp.fecha_ingreso}</td>
                    <td><strong>{emp.fecha_fin_prueba}</strong></td>
                    <td><span className={`badge ${status}`}>{label}</span></td>
                    <td><button className="btn btn-secondary" onClick={() => { setView('rrhh'); }}>Ver</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        <div className="sidebar-logo">
          LASIA <span>LIMPIEZA</span>
        </div>
        <nav className="sidebar-menu">
          <div className={`menu-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
            🏠 Dashboard
          </div>
          <div className={`menu-item ${view === 'rrhh' ? 'active' : ''}`} onClick={() => setView('rrhh')}>
            👥 Personal
          </div>
          <div className={`menu-item ${view === 'periodo-prueba' ? 'active' : ''}`} onClick={() => setView('periodo-prueba')}>
            ⏳ Periodos Prueba
          </div>
          <div className={`menu-item ${view === 'visitas' ? 'active' : ''}`} onClick={() => setView('visitas')}>
            📋 Supervisores
          </div>
          <div className={`menu-item ${view === 'config' ? 'active' : ''}`} onClick={() => setView('config')}>
            ⚙ Configuración
          </div>
        </nav>
        <div style={{ padding: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
          Digitalización Integral
        </div>
      </aside>

      <main className="main-container">
        <div className="content-area">
          {view === 'dashboard' && renderDashboard()}
          {view === 'rrhh' && (
            <HRSection
              employees={employees}
              setEmployees={setEmployees}
              services={services}
              documentTypes={documentTypes}
              setDocumentTypes={setDocumentTypes}
              employeeDocuments={employeeDocuments}
              setEmployeeDocuments={setEmployeeDocuments}
              auditLogs={auditLogs}
              setAuditLogs={setAuditLogs}
              supervisors={supervisors}
            />
          )}
          {view === 'periodo-prueba' && renderPeriodoPrueba()}
          {view === 'visitas' && renderVisitas()}
          {view === 'config' && <div className="card"><h3>Página de configuración próximamente...</h3></div>}
        </div>
      </main>

      {/* Basic Admin Modals */}
      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="flex-between">
              <h2>Configuración</h2>
              <button className="btn btn-secondary" onClick={() => setShowConfigModal(null)}>✕</button>
            </header>
            <p style={{ marginTop: '1rem' }}>Función de edición rápida disponible próximamente.</p>
          </div>
        </div>
      )}

      {showVisitForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Registro de Visita</h2>
            <p>{showVisitForm.name}</p>
            <textarea
              placeholder="Insumos necesarios..."
              value={suppliesNote}
              onChange={e => setSuppliesNote(e.target.value)}
              className="card" style={{ width: '100%', marginTop: '1rem' }}
            />
            <div className="flex-between" style={{ marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowVisitForm(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => {
                const newVisit = { serviceId: showVisitForm.id, supervisorId: selectedSupervisor.id, timestamp: new Date().toISOString(), supplies: suppliesNote };
                setVisitedServices([...visitedServices, newVisit]);
                setShowVisitForm(null);
                setSuppliesNote('');
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
