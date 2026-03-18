import { db } from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');

        if (!supervisorId) {
            return Response.json({ error: 'supervisor_id is required' }, { status: 400 });
        }

        const { rows } = await db.execute({
            sql: `SELECT sr.*, s.name as service_name, s.address as service_address, s.lat, s.lng
                  FROM supervisor_routes sr
                  JOIN services s ON sr.service_id = s.id
                  WHERE sr.supervisor_id = ?
                  ORDER BY sr.route_order ASC`,
            args: [supervisorId]
        });

        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching supervisor routes:', error);
        return Response.json({ error: 'Failed to fetch routes' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { supervisor_id, services } = await req.json();
        // services = [{ service_id, route_order }, ...]

        if (!supervisor_id || !services || !Array.isArray(services)) {
            return Response.json({ error: 'supervisor_id and services array required' }, { status: 400 });
        }

        // Delete existing routes for this supervisor
        await db.execute({
            sql: 'DELETE FROM supervisor_routes WHERE supervisor_id = ?',
            args: [supervisor_id]
        });

        // Insert new routes
        for (const svc of services) {
            await db.execute({
                sql: 'INSERT INTO supervisor_routes (supervisor_id, service_id, route_order) VALUES (?, ?, ?)',
                args: [supervisor_id, svc.service_id, svc.route_order]
            });
        }

        // Return the new routes
        const { rows } = await db.execute({
            sql: `SELECT sr.*, s.name as service_name, s.address as service_address, s.lat, s.lng
                  FROM supervisor_routes sr
                  JOIN services s ON sr.service_id = s.id
                  WHERE sr.supervisor_id = ?
                  ORDER BY sr.route_order ASC`,
            args: [supervisor_id]
        });

        return Response.json(rows, { status: 201 });
    } catch (error) {
        console.error('Error saving supervisor routes:', error);
        return Response.json({ error: 'Failed to save routes' }, { status: 500 });
    }
}
