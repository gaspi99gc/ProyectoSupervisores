import { db } from '@/lib/db';

export async function GET() {
    try {
        const { rows } = await db.execute('SELECT * FROM services ORDER BY name ASC');
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching services:', error);
        return Response.json({ error: 'Failed to fetch services' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { name, address, lat, lng } = await req.json();

        const result = await db.execute({
            sql: 'INSERT INTO services (name, address, lat, lng) VALUES (?, ?, ?, ?) RETURNING id',
            args: [name, address, lat, lng]
        });

        const newId = result.rows[0].id;

        return Response.json({
            id: newId,
            name,
            address,
            lat,
            lng
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating service:', error);
        return Response.json({ error: 'Failed to create service' }, { status: 500 });
    }
}
