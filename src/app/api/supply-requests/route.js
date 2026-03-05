import { db } from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');
        const serviceId = searchParams.get('service_id');

        let query = `
      SELECT sr.*, s.name as service_name, sup.name as supervisor_name, sup.surname as supervisor_surname
      FROM supply_requests sr
      JOIN services s ON sr.service_id = s.id
      JOIN supervisors sup ON sr.supervisor_id = sup.id
    `;
        const conditions = [];
        const args = [];

        if (supervisorId) {
            conditions.push('sr.supervisor_id = ?');
            args.push(supervisorId);
        }
        if (serviceId) {
            conditions.push('sr.service_id = ?');
            args.push(serviceId);
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

        // Start a transaction-like sequence (LibSQL currently supports batch or individual execution, doing individual for simplicity)
        const requestResult = await db.execute({
            sql: 'INSERT INTO supply_requests (supervisor_id, service_id, notas) VALUES (?, ?, ?) RETURNING id',
            args: [supervisor_id, service_id, notas || '']
        });

        const requestId = requestResult.rows[0].id;

        if (items && items.length > 0) {
            for (const item of items) {
                if (item.cantidad > 0) {
                    await db.execute({
                        sql: 'INSERT INTO supply_request_items (request_id, supply_id, cantidad) VALUES (?, ?, ?)',
                        args: [requestId, item.supply_id, item.cantidad]
                    });
                }
            }
        }

        return Response.json({ success: true, request_id: requestId }, { status: 201 });
    } catch (error) {
        console.error('Error creating supply request:', error);
        return Response.json({ error: 'Failed to create request' }, { status: 500 });
    }
}
