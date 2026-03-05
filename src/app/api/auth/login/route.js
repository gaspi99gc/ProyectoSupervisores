import { db } from '@/lib/db';

export async function POST(req) {
    try {
        const { dni } = await req.json();

        if (!dni) {
            return Response.json({ error: 'DNI es requerido' }, { status: 400 });
        }

        // Admin Shortcut (for development/owner)
        if (dni === 'admin') {
            const adminUser = { id: 0, name: 'Admin', surname: 'LASIA', dni: 'admin', role: 'admin' };
            return Response.json({ user: adminUser });
        }

        const { rows } = await db.execute({
            sql: 'SELECT * FROM supervisors WHERE dni = ?',
            args: [dni]
        });

        if (rows.length > 0) {
            const supervisor = rows[0];
            const user = { ...supervisor, role: 'supervisor' };
            return Response.json({ user });
        }

        return Response.json({ error: 'DNI incorrecto o usuario no encontrado' }, { status: 401 });
    } catch (error) {
        console.error('Error in login API:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
