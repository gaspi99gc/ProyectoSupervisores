import { db } from '@/lib/db';

export async function GET() {
    try {
        const { rows } = await db.execute('SELECT * FROM supervisors ORDER BY surname ASC, name ASC');
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching supervisors:', error);
        return Response.json({ error: 'Failed to fetch supervisors', details: String(error) }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { name, surname, dni } = await req.json();

        // Check if DNI already exists
        const existing = await db.execute({
            sql: 'SELECT id FROM supervisors WHERE dni = ?',
            args: [dni]
        });

        if (existing.rows.length > 0) {
            return Response.json({ error: 'Ya existe un supervisor con este DNI' }, { status: 400 });
        }

        const result = await db.execute({
            sql: 'INSERT INTO supervisors (name, surname, dni) VALUES (?, ?, ?) RETURNING id',
            args: [name, surname, dni]
        });

        const newId = result.rows[0].id;

        return Response.json({
            id: newId,
            name,
            surname,
            dni
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating supervisor:', error);
        return Response.json({ error: 'Failed to create supervisor', details: String(error) }, { status: 500 });
    }
}
