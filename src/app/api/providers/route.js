import { db } from '@/lib/db';
import { ensureSupplyRequestSchema } from '@/lib/supply-requests';

export async function GET() {
    try {
        await ensureSupplyRequestSchema();

        const { rows } = await db.execute('SELECT id, name, active FROM providers WHERE active = 1 ORDER BY name ASC');
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching providers:', error);
        return Response.json({ error: 'Failed to fetch providers' }, { status: 500 });
    }
}
