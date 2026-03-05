import { db } from '@/lib/db';

export async function GET() {
    try {
        const { rows } = await db.execute('SELECT * FROM document_types');
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching document types:', error);
        return Response.json({ error: 'Failed to fetch document types' }, { status: 500 });
    }
}
