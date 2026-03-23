import { db } from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const requestId = searchParams.get('request_id');
        const supervisorId = searchParams.get('supervisor_id');
        const serviceId = searchParams.get('service_id');
        const date = searchParams.get('date');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        let query = `
      SELECT sr.*, s.name as service_name, s.address as service_address,
             sup.name as supervisor_name, sup.surname as supervisor_surname, sup.dni as supervisor_dni
      FROM supply_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN supervisors sup ON sr.supervisor_id = sup.id
    `;
        const conditions = [];
        const args = [];

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

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY sr.created_at DESC';

        const { rows: requests } = await db.execute({ sql: query, args });

        // Fetch items for each request
        for (let req of requests) {
            const { rows: items } = await db.execute({
                sql: `SELECT sri.cantidad, s.nombre, s.unidad 
              FROM supply_request_items sri 
              JOIN supplies s ON sri.supply_id = s.id 
              WHERE sri.request_id = ?`,
                args: [req.id]
            });
            req.items = items;
        }

        return Response.json(requests);
    } catch (error) {
        console.error('Error fetching supply requests:', error);
        return Response.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { supervisor_id, service_id, notas, items } = await req.json();

        if (!supervisor_id || !service_id) {
            return Response.json({ error: 'Supervisor y servicio son obligatorios.' }, { status: 400 });
        }

        const preparedItems = Array.isArray(items)
            ? items.filter((item) => item?.supply_id && Number(item.cantidad) > 0)
            : [];

        if (preparedItems.length === 0) {
            return Response.json({ error: 'El pedido debe incluir al menos un insumo con cantidad.' }, { status: 400 });
        }

        // Start a transaction-like sequence (LibSQL currently supports batch or individual execution, doing individual for simplicity)
        const requestResult = await db.execute({
            sql: 'INSERT INTO supply_requests (supervisor_id, service_id, notas) VALUES (?, ?, ?) RETURNING id',
            args: [supervisor_id, service_id, notas || '']
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
