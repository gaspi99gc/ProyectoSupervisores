import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const { nombre, unidad, activo } = await request.json();

        await db.execute({
            sql: 'UPDATE supplies SET nombre = ?, unidad = ?, activo = ? WHERE id = ?',
            args: [nombre, unidad || 'unidades', activo !== undefined ? activo : 1, id]
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        // Optionally, check if the supply is used in supply_request_items before deleting
        // Or simply set activo = 0 instead of hard delete

        await db.execute({
            sql: 'DELETE FROM supplies WHERE id = ?',
            args: [id]
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
