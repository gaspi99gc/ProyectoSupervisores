import { db } from '@/lib/db';
import { ensureSupplyRequestSchema } from '@/lib/supply-requests';

const ACTIVE_REQUEST_STATUSES = ['pendiente', 'revisado'];
const ALLOWED_REQUEST_STATUSES = ['pendiente', 'revisado', 'cerrado'];

function normalizeStatusFilter(status) {
    if (!status) return '';
    if (status === 'ok') return 'cerrado';
    if (status === 'en_gestion' || status === 'pedido_proveedor' || status === 'recibido') return 'revisado';
    return status;
}

function appendStatusCondition(conditions, args, status) {
    const normalizedStatus = normalizeStatusFilter(status);

    if (!normalizedStatus || normalizedStatus === 'todos') {
        return;
    }

    if (normalizedStatus === 'activos') {
        conditions.push(`sr.status IN (${ACTIVE_REQUEST_STATUSES.map(() => '?').join(', ')})`);
        args.push(...ACTIVE_REQUEST_STATUSES);
        return;
    }

    conditions.push('sr.status = ?');
    args.push(normalizedStatus);
}

function buildRequestConditions(searchParams, options = {}) {
    const { statusOnly = false } = options;
    const requestId = searchParams.get('request_id');
    const supervisorId = searchParams.get('supervisor_id');
    const serviceId = searchParams.get('service_id');
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');
    const providerId = searchParams.get('provider_id');
    const urgency = searchParams.get('urgency');

    const conditions = [];
    const args = [];

    appendStatusCondition(conditions, args, status);

    if (statusOnly) {
        return { conditions, args };
    }

    if (requestId) {
        conditions.push('sr.id = ?');
        args.push(requestId);
    }
    if (supervisorId) {
        conditions.push('sr.supervisor_id = ?');
        args.push(supervisorId);
    }
    if (serviceId) {
        conditions.push('sr.service_id = ?');
        args.push(serviceId);
    }
    if (date) {
        conditions.push(`date(datetime(sr.created_at, '-3 hours')) = ?`);
        args.push(date);
    }
    if (startDate) {
        conditions.push(`date(datetime(sr.created_at, '-3 hours')) >= ?`);
        args.push(startDate);
    }
    if (endDate) {
        conditions.push(`date(datetime(sr.created_at, '-3 hours')) <= ?`);
        args.push(endDate);
    }
    if (providerId) {
        conditions.push('sr.provider_id = ?');
        args.push(providerId);
    }
    if (urgency === 'solo_urgentes') {
        conditions.push('COALESCE(sr.urgent, 0) = 1');
    }

    return { conditions, args };
}

function buildWhereClause(conditions) {
    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
}

export async function GET(req) {
    try {
        await ensureSupplyRequestSchema();

        const { searchParams } = new URL(req.url);
        const includeMeta = searchParams.get('include_meta') === 'true';
        const { conditions, args } = buildRequestConditions(searchParams);
        const whereClause = buildWhereClause(conditions);

        const query = `
            SELECT sr.*, COALESCE(sr.urgent, 0) as urgent,
                   s.name as service_name, s.address as service_address,
                   sup.name as supervisor_name, sup.surname as supervisor_surname, sup.dni as supervisor_dni,
                   p.name as provider_name
            FROM supply_requests sr
            JOIN services s ON sr.service_id = s.id
            JOIN supervisors sup ON sr.supervisor_id = sup.id
            LEFT JOIN providers p ON sr.provider_id = p.id
            ${whereClause}
            ORDER BY sr.created_at DESC
        `;

        const { rows: requests } = await db.execute({ sql: query, args });

        for (const requestRow of requests) {
            const { rows: items } = await db.execute({
                sql: `SELECT sri.cantidad, s.nombre, s.unidad
                      FROM supply_request_items sri
                      JOIN supplies s ON sri.supply_id = s.id
                      WHERE sri.request_id = ?`,
                args: [requestRow.id]
            });
            requestRow.items = items;
            requestRow.status = normalizeStatusFilter(requestRow.status) || 'pendiente';
            requestRow.urgent = Boolean(requestRow.urgent);
        }

        if (!includeMeta) {
            return Response.json(requests);
        }

        const totalScope = buildRequestConditions(searchParams, { statusOnly: true });
        const totalScopeWhere = buildWhereClause(totalScope.conditions);
        const { rows: totalRows } = await db.execute({
            sql: `SELECT COUNT(*) as count FROM supply_requests sr ${totalScopeWhere}`,
            args: totalScope.args
        });

        return Response.json({
            requests,
            totalCount: Number(totalRows?.[0]?.count || 0),
        });
    } catch (error) {
        console.error('Error fetching supply requests:', error);
        return Response.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await ensureSupplyRequestSchema();

        const { supervisor_id, service_id, notas, items, urgent } = await req.json();

        if (!supervisor_id || !service_id) {
            return Response.json({ error: 'Supervisor y servicio son obligatorios.' }, { status: 400 });
        }

        const preparedItems = Array.isArray(items)
            ? items.filter((item) => item?.supply_id && Number(item.cantidad) > 0)
            : [];

        if (preparedItems.length === 0) {
            return Response.json({ error: 'El pedido debe incluir al menos un insumo con cantidad.' }, { status: 400 });
        }

        const requestResult = await db.execute({
            sql: 'INSERT INTO supply_requests (supervisor_id, service_id, notas, status, urgent) VALUES (?, ?, ?, ?, ?) RETURNING id',
            args: [supervisor_id, service_id, notas || '', 'pendiente', urgent ? 1 : 0]
        });

        const requestId = requestResult.rows[0].id;

        for (const item of preparedItems) {
            await db.execute({
                sql: 'INSERT INTO supply_request_items (request_id, supply_id, cantidad) VALUES (?, ?, ?)',
                args: [requestId, item.supply_id, item.cantidad]
            });
        }

        return Response.json({ success: true, request_id: requestId }, { status: 201 });
    } catch (error) {
        console.error('Error creating supply request:', error);
        return Response.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        await ensureSupplyRequestSchema();

        const { request_id, status, completed_by, provider_id } = await req.json();

        if (!request_id) {
            return Response.json({ error: 'request_id es requerido.' }, { status: 400 });
        }

        const normalizedStatus = normalizeStatusFilter(status) || 'pendiente';

        if (!ALLOWED_REQUEST_STATUSES.includes(normalizedStatus)) {
            return Response.json({ error: 'Estado inválido.' }, { status: 400 });
        }

        const normalizedProviderId = provider_id ? Number(provider_id) : null;
        if (provider_id && !Number.isFinite(normalizedProviderId)) {
            return Response.json({ error: 'Proveedor inválido.' }, { status: 400 });
        }

        await db.execute({
            sql: `UPDATE supply_requests
                  SET status = ?,
                      provider_id = ?,
                      completed_by = CASE WHEN ? = 'cerrado' THEN ? ELSE NULL END,
                      completed_at = CASE WHEN ? = 'cerrado' THEN CURRENT_TIMESTAMP ELSE NULL END
                  WHERE id = ?`,
            args: [normalizedStatus, normalizedProviderId, normalizedStatus, completed_by || null, normalizedStatus, request_id]
        });

        const { rows } = await db.execute({
            sql: `SELECT sr.id, sr.status, sr.provider_id, sr.completed_by, sr.completed_at,
                         p.name as provider_name
                  FROM supply_requests sr
                  LEFT JOIN providers p ON sr.provider_id = p.id
                  WHERE sr.id = ?`,
            args: [request_id]
        });

        const row = rows[0] || null;
        if (row) {
            row.status = normalizeStatusFilter(row.status) || 'pendiente';
        }

        return Response.json(row);
    } catch (error) {
        console.error('Error updating supply request status:', error);
        return Response.json({ error: 'Failed to update request status' }, { status: 500 });
    }
}
