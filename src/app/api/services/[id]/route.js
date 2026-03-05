import { db } from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const id = params.id;
        const { name, address, lat, lng } = await req.json();

        await db.execute({
            sql: 'UPDATE services SET name = ?, address = ?, lat = ?, lng = ? WHERE id = ?',
            args: [name, address, lat, lng, id]
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error updating service:', error);
        return Response.json({ error: 'Failed to update service' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const id = params.id;
        await db.execute({
            sql: 'DELETE FROM services WHERE id = ?',
            args: [id]
        });
        return Response.json({ success: true });
    } catch (error) {
        console.error('Error deleting service:', error);
        return Response.json({ error: 'Failed to delete service' }, { status: 500 });
    }
}
