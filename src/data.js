export const defaultSupervisors = [
  { id: 1, name: "Juana", surname: "Pérez", dni: "1" },
  { id: 2, name: "Carlos", surname: "García", dni: "2" },
  { id: 3, name: "María", surname: "López", dni: "3" },
  { id: 4, name: "Pedro", surname: "Martínez", dni: "4" },
  { id: 5, name: "Ana", surname: "Rodríguez", dni: "5" },
];

export const defaultServices = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  name: `Servicio ${i + 1}`,
  address: `Dirección del Servicio ${i + 1}`,
  lat: -34.6037 + (Math.random() - 0.5) * 0.1, // Random coords near Buenos Aires for testing
  lng: -58.3816 + (Math.random() - 0.5) * 0.1,
}));
