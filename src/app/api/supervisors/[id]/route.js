import { db } from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const id = params.id;
        const { name, surname, dni } = await req.json();

        await db.execute({
            sql: 'UPDATE supervisors SET name = ?, surname = ?, dni = ? WHERE id = ?',
            args: [name, surname, dni, id]
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error updating supervisor:', error);
        return Response.json({ error: 'Failed to update supervisor' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const id = params.id;
        await db.execute({
            sql: 'DELETE FROM supervisors WHERE id = ?',
            args: [id]
        });
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error deleting supervisor:', error);
        return Response.json({ error: 'Failed to delete supervisor' }, { status: 500 });
    }
}
