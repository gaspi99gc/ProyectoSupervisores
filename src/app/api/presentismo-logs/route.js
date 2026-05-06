import { supabase } from '@/lib/db';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');
        const serviceId = searchParams.get('service_id');
        const days = Number(searchParams.get('days'));

        let query = supabase
            .from('supervisor_presentismo_logs')
            .select('id, event_type, occurred_at, event_lat, event_lng, services:service_id(id, name, address), supervisors:supervisor_id(id, app_users(name, surname, username))')
            .order('occurred_at', { ascending: false });

        if (supervisorId) query = query.eq('supervisor_id', supervisorId);
        if (serviceId) query = query.eq('service_id', serviceId);

        if (Number.isFinite(days) && days > 0) {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            query = query.gte('occurred_at', cutoff.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data || []).map(pl => ({
            id: pl.id,
            event_type: pl.event_type,
            occurred_at: pl.occurred_at,
            event_lat: pl.event_lat,
            event_lng: pl.event_lng,
            service_id: pl.services?.id || null,
            service_name: pl.services?.name || null,
            service_address: pl.services?.address || null,
            supervisor_id: pl.supervisors?.id || null,
            supervisor_name: pl.supervisors?.app_users?.name || null,
            supervisor_surname: pl.supervisors?.app_users?.surname || null,
            supervisor_dni: pl.supervisors?.app_users?.username || null,
        }));

        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching presentismo logs:', error);
        return Response.json({ error: 'No se pudieron obtener los logs de presentismo' }, { status: 500 });
    }
}
