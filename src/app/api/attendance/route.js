import { supabase } from '@/lib/db';

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function getZone(distanceMeters) {
    if (distanceMeters <= 200) return 'green';
    if (distanceMeters <= 500) return 'yellow';
    return 'red';
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');
        const serviceId = searchParams.get('service_id');
        const active = searchParams.get('active');
        const today = searchParams.get('today');

        let query = supabase
            .from('attendance')
            .select('*, services:service_id(name, address), supervisors:supervisor_id(app_users(name, surname))')
            .order('timestamp', { ascending: false });

        if (supervisorId) query = query.eq('supervisor_id', supervisorId);
        if (serviceId) query = query.eq('service_id', serviceId);

        if (today === 'true') {
            // Argentina is UTC-3: today starts at 03:00 UTC
            const now = new Date();
            const argOffset = 3 * 60 * 60 * 1000;
            const argNow = new Date(now.getTime() - argOffset);
            const todayStr = argNow.toISOString().split('T')[0];
            const startUTC = `${todayStr}T03:00:00.000Z`;
            query = query.gte('timestamp', startUTC);
        }

        const { data, error } = await query;
        if (error) throw error;

        let rows = (data || []).map(a => ({
            ...a,
            service_name: a.services?.name || null,
            service_address: a.services?.address || null,
            supervisor_name: a.supervisors?.app_users?.name || null,
            supervisor_surname: a.supervisors?.app_users?.surname || null,
            services: undefined,
            supervisors: undefined,
        }));

        if (active === 'true') {
            rows = rows.filter(a => {
                if (a.type !== 'check-in') return false;
                return !rows.some(a2 =>
                    a2.supervisor_id === a.supervisor_id &&
                    a2.service_id === a.service_id &&
                    a2.type === 'check-out' &&
                    a2.timestamp > a.timestamp
                );
            });
        }

        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching attendance:', error);
        return Response.json({ error: 'Failed to fetch attendance' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { supervisor_id, service_id, type, lat, lng } = await req.json();

        const { data: allRecords } = await supabase
            .from('attendance')
            .select('*, services:service_id(name)')
            .eq('supervisor_id', supervisor_id)
            .order('timestamp', { ascending: false });

        const records = allRecords || [];

        // Find active check-in: a check-in with no subsequent check-out for same service
        const activeCheckin = records.find(a => {
            if (a.type !== 'check-in') return false;
            return !records.some(a2 =>
                a2.service_id === a.service_id &&
                a2.type === 'check-out' &&
                a2.timestamp > a.timestamp
            );
        });

        const hasActiveCheckin = Boolean(activeCheckin);

        if (type === 'check-in' && hasActiveCheckin) {
            return Response.json({
                error: `Ya tenés una entrada activa en "${activeCheckin.services?.name}". Fichá la salida primero.`,
                active_checkin: { ...activeCheckin, service_name: activeCheckin.services?.name }
            }, { status: 400 });
        }

        if (type === 'check-out' && (!hasActiveCheckin || activeCheckin.service_id !== service_id)) {
            return Response.json({ error: 'No hay una entrada activa para este servicio.' }, { status: 400 });
        }

        const { data: service } = await supabase
            .from('services')
            .select('lat, lng')
            .eq('id', service_id)
            .single();

        let verified = false;
        let distance_meters = null;
        let zone = 'red';

        if (service?.lat && service?.lng) {
            distance_meters = haversineDistance(lat, lng, service.lat, service.lng);
            zone = getZone(distance_meters);
            verified = zone === 'green';
        }

        const { data: result, error } = await supabase
            .from('attendance')
            .insert({ supervisor_id, service_id, type, lat, lng, verified, distance_meters, zone })
            .select()
            .single();

        if (error) throw error;

        return Response.json(result, { status: 201 });
    } catch (error) {
        console.error('Error recording attendance:', error);
        return Response.json({ error: 'Failed to record attendance' }, { status: 500 });
    }
}
