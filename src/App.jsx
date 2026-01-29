import { useState, useEffect } from 'react';
import { defaultSupervisors, defaultServices } from './data';
import './index.css';

function App() {
  // State for data
  const [supervisors, setSupervisors] = useState([]);
  const [services, setServices] = useState([]);
  const [visitedServices, setVisitedServices] = useState([]);

  // App State
  const [selectedSupervisor, setSelectedSupervisor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(null); // 'supervisors', 'services', or null
  const [showVisitForm, setShowVisitForm] = useState(null); // service object or null
  const [suppliesNote, setSuppliesNote] = useState('');

  // Load data from localStorage on mount
  useEffect(() => {
    const savedSupervisors = localStorage.getItem('app-supervisors');
    const savedServices = localStorage.getItem('app-services');
    const savedVisits = localStorage.getItem('app-visits');

    setSupervisors(savedSupervisors ? JSON.parse(savedSupervisors) : defaultSupervisors);
    setServices(savedServices ? JSON.parse(savedServices) : defaultServices);
    setVisitedServices(savedVisits ? JSON.parse(savedVisits) : []);
  }, []);

  // Sync data to localStorage
  useEffect(() => { localStorage.setItem('app-supervisors', JSON.stringify(supervisors)); }, [supervisors]);
  useEffect(() => { localStorage.setItem('app-services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('app-visits', JSON.stringify(visitedServices)); }, [visitedServices]);

  const handleVisitSubmit = (e) => {
    e.preventDefault();
    if (!suppliesNote.trim()) {
      alert('Por favor, indica los insumos necesarios.');
      return;
    }

    const newVisit = {
      serviceId: showVisitForm.id,
      supervisorId: selectedSupervisor.id,
      timestamp: new Date().toISOString(),
      supplies: suppliesNote,
    };

    setVisitedServices([...visitedServices, newVisit]);
    setShowVisitForm(null);
    setSuppliesNote('');
  };

  const isVisited = (serviceId) => visitedServices.some(v => v.serviceId === serviceId);

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const progress = Math.round((visitedServices.length / services.length) * 100);

  // Configuration Handlers
  const addService = () => {
    const name = prompt('Nombre del nuevo servicio:');
    const address = prompt('Dirección del nuevo servicio:');
    if (name && address) {
      const newService = {
        id: Math.max(0, ...services.map(s => s.id)) + 1,
        name,
        address
      };
      setServices([...services, newService]);
    }
  };

  const editService = (id) => {
    const service = services.find(s => s.id === id);
    const name = prompt('Nuevo nombre:', service.name);
    const address = prompt('Nueva dirección:', service.address);
    if (name && address) {
      setServices(services.map(s => s.id === id ? { ...s, name, address } : s));
    }
  };

  const editSupervisor = (id) => {
    const supervisor = supervisors.find(s => s.id === id);
    const name = prompt('Nuevo nombre:', supervisor.name);
    const surname = prompt('Nuevo apellido:', supervisor.surname);
    if (name && surname) {
      setSupervisors(supervisors.map(s => s.id === id ? { ...s, name, surname } : s));
    }
  };

  const addSupervisor = () => {
    const name = prompt('Nombre del nuevo supervisor:');
    const surname = prompt('Apellido del nuevo supervisor:');
    if (name && surname) {
      const newSupervisor = {
        id: Math.max(0, ...supervisors.map(s => s.id)) + 1,
        name,
        surname
      };
      setSupervisors([...supervisors, newSupervisor]);
    }
  };

  if (!selectedSupervisor) {
    return (
      <div className="container">
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1>Control de Visitas</h1>
          <p style={{ color: 'var(--text-muted)' }}>Selecciona tu perfil o administra el sistema</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowConfig('supervisors')}>⚙ Supervisores</button>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowConfig('services')}>⚙ Servicios</button>
          </div>
        </header>

        <div className="grid">
          {supervisors.map(s => (
            <button key={s.id} className="card btn btn-primary" onClick={() => setSelectedSupervisor(s)} style={{ textAlign: 'left', cursor: 'pointer' }}>
              <h3>{s.name} {s.surname}</h3>
              <p>Supervisor de Servicios</p>
            </button>
          ))}
        </div>

        {/* Configuration Modals */}
        {showConfig === 'supervisors' && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="flex-between">
                <h2>Administrar Supervisores</h2>
                <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowConfig(null)}>✕</button>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={addSupervisor}>+ Agregar Nuevo Supervisor</button>
              <div className="mgmt-list">
                {supervisors.map(s => (
                  <div key={s.id} className="mgmt-item">
                    <span>{s.name} {s.surname}</span>
                    <button className="btn btn-primary" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => editSupervisor(s.id)}>Editar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showConfig === 'services' && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="flex-between">
                <h2>Administrar Servicios</h2>
                <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowConfig(null)}>✕</button>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={addService}>+ Agregar Nuevo Servicio</button>
              <div className="mgmt-list">
                {services.map(s => (
                  <div key={s.id} className="mgmt-item">
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: '600' }}>{s.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.address}</div>
                    </div>
                    <button className="btn btn-primary" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => editService(s.id)}>Editar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Panel de Visitas</h1>
          <button className="btn" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={() => setSelectedSupervisor(null)}>
            Salir ({selectedSupervisor.name})
          </button>
        </div>

        <div className="card" style={{ marginTop: '1rem', background: '#f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: '600' }}>Progreso Semanal</span>
            <span>{visitedServices.length} / {services.length} ({progress}%)</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--success)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        <input
          type="text"
          placeholder="Buscar servicio por nombre o dirección..."
          className="card"
          style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </header>

      <div className="grid">
        {filteredServices.map(service => {
          const visited = isVisited(service.id);
          const vInfo = visited ? visitedServices.find(v => v.serviceId === service.id) : null;
          const sName = vInfo ? supervisors.find(s => s.id === vInfo.supervisorId)?.name : '';

          return (
            <div key={service.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem' }}>{service.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{service.address}</p>
                {visited && (
                  <p style={{ color: 'var(--success)', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.25rem' }}>
                    ✔ Visitado: {vInfo.supplies.substring(0, 30)}...
                  </p>
                )}
              </div>
              <div>
                {visited ? (
                  <span className="badge badge-success">Completado</span>
                ) : (
                  <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowVisitForm(service)}>
                    Registrar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visit Form Modal */}
      {showVisitForm && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleVisitSubmit}>
            <h2>Registro de Visita</h2>
            <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{showVisitForm.name}</p>

            <div className="form-group">
              <label>Insumos de limpieza necesarios para la semana:</label>
              <textarea
                required
                placeholder="Ej: 5L Desinfectante, 2 paquetes de bolsas, etc..."
                value={suppliesNote}
                onChange={(e) => setSuppliesNote(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowVisitForm(null); setSuppliesNote(''); }}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar Visita</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
