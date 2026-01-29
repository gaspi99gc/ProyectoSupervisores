export const defaultSupervisors = [
  { id: 1, name: "Juana", surname: "Pérez" },
  { id: 2, name: "Carlos", surname: "García" },
  { id: 3, name: "María", surname: "López" },
  { id: 4, name: "Pedro", surname: "Martínez" },
  { id: 5, name: "Ana", surname: "Rodríguez" },
];

export const defaultServices = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `Servicio ${i + 1}`,
  address: `Dirección del Servicio ${i + 1}`,
}));
