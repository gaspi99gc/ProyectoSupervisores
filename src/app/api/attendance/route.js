import { db } from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');
        const serviceId = searchParams.get('service_id');

        let query = `
      SELECT a.*, s.name as service_name, s.address as service_address, 
             sup.name as supervisor_name, sup.surname as supervisor_surname
      FROM attendance a
      JOIN services s ON a.service_id = s.id
      JOIN supervisors sup ON a.supervisor_id = sup.id
    `;
        const conditions = [];
        const args = [];

        if (supervisorId) {
            conditions.push('a.supervisor_id = ?');
            args.push(supervisorId);
        }

        if (serviceId) {
            conditions.push('a.service_id = ?');
            args.push(serviceId);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        query += ' ORDER BY a.timestamp DESC';

        const { rows } = await db.execute({ sql: query, args });
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return Response.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { supervisor_id, service_id, type, lat, lng } = await req.json();

        // Verification: Calculate distance to service
        const service = await db.execute({
            sql: 'SELECT lat, lng FROM services WHERE id = ?',
            args: [service_id]
        });

        let verified = false;
        let distance_meters = null;

        if (service.rows.length > 0 && service.rows[0].lat && service.rows[0].lng) {
            const sLat = service.rows[0].lat;
            const sLng = service.rows[0].lng;

            // Haversine formula
            const R = 6371e3; // metres
            const φ1 = lat * Math.PI / 180;
            const φ2 = sLat * Math.PI / 180;
            const Δφ = (sLat - lat) * Math.PI / 180;
            const Δλ = (sLng - lng) * Math.PI / 180;

            const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            distance_meters = R * c;
            verified = distance_meters <= 200; // 200m threshold
        }

        const result = await db.execute({
            sql: `INSERT INTO attendance (supervisor_id, service_id, type, lat, lng, verified, distance_meters) 
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            args: [supervisor_id, service_id, type, lat, lng, verified ? 1 : 0, distance_meters]
        });

        return Response.json(result.rows[0], { status: 201 });
    } catch (error) {
        console.error('Error recording attendance:', error);
        return Response.json({ error: 'Failed to record attendance' }, { status: 500 });
    }
}
