import { db } from '@/lib/db';

let supervisorStatusTablesReady = false;

function normalizeSupervisorStatus(status) {
    return status === 'trabajando' || status === 'chambeando' ? 'chambeando' : 'afuera';
}

export async function ensureSupervisorStatusTable() {
    if (supervisorStatusTablesReady) {
        return;
    }

    await db.execute(`
        CREATE TABLE IF NOT EXISTS supervisor_status (
            supervisor_id INTEGER PRIMARY KEY REFERENCES supervisors(id),
            status TEXT NOT NULL DEFAULT 'afuera',
            current_service_id INTEGER REFERENCES services(id),
            entered_at DATETIME,
            entered_lat REAL,
            entered_lng REAL,
            exited_at DATETIME,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const { rows: supervisorStatusColumns } = await db.execute('PRAGMA table_info(supervisor_status)');
    const supervisorStatusColumnNames = new Set(supervisorStatusColumns.map((column) => column.name));

    if (!supervisorStatusColumnNames.has('entered_lat')) {
        await db.execute('ALTER TABLE supervisor_status ADD COLUMN entered_lat REAL');
    }

    if (!supervisorStatusColumnNames.has('entered_lng')) {
        await db.execute('ALTER TABLE supervisor_status ADD COLUMN entered_lng REAL');
    }

    await db.execute(`
        CREATE TABLE IF NOT EXISTS supervisor_presentismo_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supervisor_id INTEGER NOT NULL REFERENCES supervisors(id),
            service_id INTEGER NOT NULL REFERENCES services(id),
            event_type TEXT NOT NULL,
            event_lat REAL,
            event_lng REAL,
            occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const { rows: presentismoLogColumns } = await db.execute('PRAGMA table_info(supervisor_presentismo_logs)');
    const presentismoLogColumnNames = new Set(presentismoLogColumns.map((column) => column.name));

    if (!presentismoLogColumnNames.has('event_lat')) {
        await db.execute('ALTER TABLE supervisor_presentismo_logs ADD COLUMN event_lat REAL');
    }

    if (!presentismoLogColumnNames.has('event_lng')) {
        await db.execute('ALTER TABLE supervisor_presentismo_logs ADD COLUMN event_lng REAL');
    }

    supervisorStatusTablesReady = true;
}

export async function ensureSupervisorStatusRow(supervisorId) {
    await ensureSupervisorStatusTable();

    await db.execute({
        sql: `INSERT OR IGNORE INTO supervisor_status (supervisor_id, status, updated_at)
              VALUES (?, 'afuera', CURRENT_TIMESTAMP)`,
        args: [supervisorId]
    });
}

export async function getSupervisorStatus(supervisorId) {
    await ensureSupervisorStatusRow(supervisorId);

    const { rows } = await db.execute({
        sql: `SELECT ss.supervisor_id, ss.status, ss.current_service_id, ss.entered_at, ss.entered_lat, ss.entered_lng, ss.exited_at, ss.updated_at,
                     s.name AS current_service_name, s.address AS current_service_address
              FROM supervisor_status ss
              LEFT JOIN services s ON s.id = ss.current_service_id
              WHERE ss.supervisor_id = ?`,
        args: [supervisorId]
    });

    if (!rows[0]) {
        return null;
    }

    return {
        ...rows[0],
        status: normalizeSupervisorStatus(rows[0].status)
    };
}

export async function updateSupervisorStatus(supervisorId, status) {
    await ensureSupervisorStatusRow(supervisorId);

    const currentStatus = await getSupervisorStatus(supervisorId);

    const normalizedStatus = normalizeSupervisorStatus(status);
    const serviceId = Number(currentStatus?.current_service_id);
    const enteredAt = normalizedStatus === 'chambeando' ? 'CURRENT_TIMESTAMP' : 'entered_at';
    const exitedAt = normalizedStatus === 'afuera' ? 'CURRENT_TIMESTAMP' : 'exited_at';

    if (normalizedStatus === 'afuera' && (!Number.isFinite(serviceId) || serviceId <= 0)) {
        throw new Error('No hay un servicio activo para registrar la salida.');
    }

    await db.execute({
        sql: `UPDATE supervisor_status
              SET status = ?,
                  current_service_id = CASE WHEN ? = 'chambeando' THEN current_service_id ELSE NULL END,
                  entered_lat = CASE WHEN ? = 'chambeando' THEN entered_lat ELSE NULL END,
                  entered_lng = CASE WHEN ? = 'chambeando' THEN entered_lng ELSE NULL END,
                  entered_at = ${enteredAt},
                  exited_at = ${exitedAt},
                  updated_at = CURRENT_TIMESTAMP
              WHERE supervisor_id = ?`,
        args: [normalizedStatus, normalizedStatus, normalizedStatus, normalizedStatus, supervisorId]
    });

    await db.execute({
        sql: `INSERT INTO supervisor_presentismo_logs (supervisor_id, service_id, event_type, event_lat, event_lng)
              VALUES (?, ?, ?, ?, ?)`,
        args: [supervisorId, serviceId, normalizedStatus === 'chambeando' ? 'ingreso' : 'salida', null, null]
    });

    return getSupervisorStatus(supervisorId);
}

export async function updateSupervisorStatusWithService(supervisorId, status, serviceId, coordinates) {
    await ensureSupervisorStatusRow(supervisorId);

    const normalizedStatus = normalizeSupervisorStatus(status);

    if (normalizedStatus !== 'chambeando') {
        return updateSupervisorStatus(supervisorId, normalizedStatus);
    }

    const normalizedServiceId = Number(serviceId);

    if (!Number.isFinite(normalizedServiceId) || normalizedServiceId <= 0) {
        throw new Error('Seleccioná un servicio antes de ingresar.');
    }

    const enteredLat = Number(coordinates?.lat);
    const enteredLng = Number(coordinates?.lng);

    if (!Number.isFinite(enteredLat) || !Number.isFinite(enteredLng)) {
        throw new Error('No se pudieron obtener las coordenadas exactas del ingreso.');
    }

    await db.execute({
        sql: `UPDATE supervisor_status
              SET status = 'chambeando',
                  current_service_id = ?,
                  entered_at = CURRENT_TIMESTAMP,
                  entered_lat = ?,
                  entered_lng = ?,
                  exited_at = NULL,
                  updated_at = CURRENT_TIMESTAMP
              WHERE supervisor_id = ?`,
        args: [normalizedServiceId, enteredLat, enteredLng, supervisorId]
    });

    await db.execute({
        sql: `INSERT INTO supervisor_presentismo_logs (supervisor_id, service_id, event_type, event_lat, event_lng)
              VALUES (?, ?, 'ingreso', ?, ?)`,
        args: [supervisorId, normalizedServiceId, enteredLat, enteredLng]
    });

    return getSupervisorStatus(supervisorId);
}
