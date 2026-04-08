# PLATAFORMA
## ALPHA 0.1.22
**Notas de version - Abr 2026**

En esta version se mejoro fuerte el flujo de Compras y la visualizacion movil del panel de supervisor.
Tambien se ajusto la identidad visual y la exportacion de reportes.

**A chambear!**

## COMPRAS / FLUJO DE PEDIDOS
- Se simplificaron los estados operativos a tres etapas: Pendiente, Enviar al proveedor y Cerrado.
- Nuevo flujo de accion en tabla:
  - Si esta Pendiente, el boton muestra Enviar al proveedor.
  - Si esta Enviar al proveedor, el boton muestra Confirmar recepcion.
- Las acciones se reorganizaron visualmente para mayor claridad (boton principal arriba, exportaciones debajo).

## COMPRAS / FILTROS Y TRAZABILIDAD
- Nuevo filtro por Pedido # para buscar pedidos por ID exacto.
- Se agrego la columna Pedido # en la tabla, usando el ID real de base de datos.
- Se elimino la columna Notas de la grilla principal para reducir ruido visual.

## COMPRAS / DETALLE Y ALERTAS
- Se reemplazo "Ver detalle completo en Excel o PDF" por boton Ver detalle.
- El detalle abre modal con: numero de pedido, estado, servicio, insumos y notas.
- El modal ahora adapta icono, titulo y color segun estado del pedido.

## REPORTES PDF
- Se incorporo el logo institucional centrado en la cabecera de los PDF de Compras.
- Se mantuvo compatibilidad con exportacion individual y por listado filtrado.

## SUPERVISOR / MOBILE UX
- Historico de pedidos optimizado para telefono sin scroll lateral.
- Diseno tipo tarjetas con jerarquia visual mejorada en Fecha, Servicio, Insumos y Notas.
- Se reforzo contraste y legibilidad en componentes moviles.

## UI / BRANDING
- Se actualizo el logo lateral global del sistema a imagen institucional (PNG).
- Ajustes de tamano y centrado para desktop y mobile.

---
Plataforma interna  
Abr 2026 - S2  
alpha 0.1.22
