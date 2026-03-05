import { db } from '@/lib/db';

export async function GET() {
    try {
        const { rows } = await db.execute('SELECT * FROM supplies WHERE activo = 1 ORDER BY nombre ASC');
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching supplies:', error);
        return Response.json({ error: 'Failed to fetch supplies' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { nombre, unidad } = await req.json();

        const result = await db.execute({
            sql: 'INSERT INTO supplies (nombre, unidad) VALUES (?, ?) RETURNING id',
            args: [nombre, unidad || 'unidades']
        });

        return Response.json({ id: result.rows[0].id, nombre, unidad, activo: 1 }, { status: 201 });
    } catch (error) {
        console.error('Error creating supply:', error);
        return Response.json({ error: 'Failed to create supply' }, { status: 500 });
    }
}
