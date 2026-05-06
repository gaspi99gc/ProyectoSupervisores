import { supabase } from '@/lib/db';

const ACTIVE_REQUEST_STATUSES = ['pendiente', 'revisado'];
const ALLOWED_REQUEST_STATUSES = ['pendiente', 'revisado', 'cerrado'];

function normalizeStatusFilter(status) {
    if (!status) return '';
    if (status === 'ok') return 'cerrado';
    if (status === 'en_gestion' || status === 'pedido_proveedor' || status === 'recibido') return 'revisado';
    return status;
}

// Argentina is UTC-3. Convert an Argentina YYYY-MM-DD to UTC range [start, end).
function argentinaDateToUTCRange(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, d, 3, 0, 0)); // midnight AR = 03:00 UTC
    const end = new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0));
    return { start: start.toISOString(), end: end.toISOString() };
}

function buildSupabaseQuery(searchParams) {
    const requestId = searchParams.get('request_id');
    const supervisorId = searchParams.get('supervisor_id');
    const serviceId = searchParams.get('service_id');
    const date = searchParams.get('date');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');
    const providerId = searchParams.get('provider_id');
    const urgency = searchParams.get('urgency');

    let query = supabase
        .from('supply_requests')
        .select('*, services:service_id(name, address), supervisors:supervisor_id(name, surname, dni), providers:provider_id(name)')
        .order('created_at', { ascending: false });

    const normalizedStatus = normalizeStatusFilter(status);
    if (normalizedStatus === 'activos') {
        query = query.in('status', ACTIVE_REQUEST_STATUSES);
    } else if (normalizedStatus && normalizedStatus !== 'todos') {
        query = query.eq('status', normalizedStatus);
    }

    if (requestId) query = query.eq('id', requestId);
    if (supervisorId) query = query.eq('supervisor_id', supervisorId);
    if (serviceId) query = query.eq('service_id', serviceId);
    if (providerId) query = query.eq('provider_id', providerId);
    if (urgency === 'solo_urgentes') query = query.eq('urgent', true);

    if (date) {
        const { start, end } = argentinaDateToUTCRange(date);
        query = query.gte('created_at', start).lt('created_at', end);
    }
    if (startDate) {
        const { start } = argentinaDateToUTCRange(startDate);
        query = query.gte('created_at', start);
    }
    if (endDate) {
        const { end } = argentinaDateToUTCRange(endDate);
        query = query.lt('created_at', end);
    }

    return query;
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const includeMeta = searchParams.get('include_meta') === 'true';

        const { data: requestsRaw, error, count } = await buildSupabaseQuery(searchParams);
        if (error) throw error;

        const requests = await Promise.all((requestsRaw || []).map(async (row) => {
            const { data: itemsRaw } = await supabase
                .from('supply_request_items')
                .select('cantidad, supplies:supply_id(nombre, unidad)')
                .eq('request_id', row.id);

            const items = (itemsRaw || []).map(i => ({
                cantidad: i.cantidad,
                nombre: i.supplies?.nombre || null,
                unidad: i.supplies?.unidad || null,
            }));

            return {
                ...row,
                service_name: row.services?.name || null,
                service_address: row.services?.address || null,
                supervisor_name: row.supervisors?.name || null,
                supervisor_surname: row.supervisors?.surname || null,
                supervisor_dni: row.supervisors?.dni || null,
                provider_name: row.providers?.name || null,
                services: undefined,
                supervisors: undefined,
                providers: undefined,
                urgent: Boolean(row.urgent),
                status: normalizeStatusFilter(row.status) || 'pendiente',
                items,
            };
        }));

        if (!includeMeta) {
            return Response.json(requests);
        }

        // Count with status-only filter
        const statusParam = searchParams.get('status');
        const normalizedStatus = normalizeStatusFilter(statusParam);
        let countQuery = supabase.from('supply_requests').select('id', { count: 'exact', head: true });
        if (normalizedStatus === 'activos') {
            countQuery = countQuery.in('status', ACTIVE_REQUEST_STATUSES);
        } else if (normalizedStatus && normalizedStatus !== 'todos') {
            countQuery = countQuery.eq('status', normalizedStatus);
        }

        const { count: totalCount } = await countQuery;

        return Response.json({ requests, totalCount: totalCount || 0 });
    } catch (error) {
        console.error('Error fetching supply requests:', error);
        return Response.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { supervisor_id, service_id, notas, items, urgent } = await req.json();

        if (!supervisor_id || !service_id) {
            return Response.json({ error: 'Supervisor y servicio son obligatorios.' }, { status: 400 });
        }

        const preparedItems = Array.isArray(items)
            ? items.filter((item) => item?.supply_id && Number(item.cantidad) > 0)
            : [];

        if (preparedItems.length === 0) {
            return Response.json({ error: 'El pedido debe incluir al menos un insumo con cantidad.' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('supply_requests')
            .insert({
                supervisor_id,
                service_id,
                notas: notas || '',
                status: 'pendiente',
                urgent: Boolean(urgent),
            })
            .select('id')
            .single();

        if (error) throw error;

        const requestId = data.id;

        await supabase.from('supply_request_items').insert(
            preparedItems.map(item => ({
                request_id: requestId,
                supply_id: item.supply_id,
                cantidad: item.cantidad,
            }))
        );

        return Response.json({ success: true, request_id: requestId }, { status: 201 });
    } catch (error) {
        console.error('Error creating supply request:', error);
        return Response.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

export async function PATCH(req) {
    try {
        const { request_id, status, completed_by, provider_id } = await req.json();

        if (!request_id) {
            return Response.json({ error: 'request_id es requerido.' }, { status: 400 });
        }

        const normalizedStatus = normalizeStatusFilter(status) || 'pendiente';

        if (!ALLOWED_REQUEST_STATUSES.includes(normalizedStatus)) {
            return Response.json({ error: 'Estado inválido.' }, { status: 400 });
        }

        const normalizedProviderId = provider_id ? Number(provider_id) : null;
        if (provider_id && !Number.isFinite(normalizedProviderId)) {
            return Response.json({ error: 'Proveedor inválido.' }, { status: 400 });
        }

        const updateData = {
            status: normalizedStatus,
            provider_id: normalizedProviderId,
            completed_by: normalizedStatus === 'cerrado' ? completed_by || null : null,
            completed_at: normalizedStatus === 'cerrado' ? new Date().toISOString() : null,
        };

        const { error: updateError } = await supabase
            .from('supply_requests')
            .update(updateData)
            .eq('id', request_id);

        if (updateError) throw updateError;

        const { data, error } = await supabase
            .from('supply_requests')
            .select('id, status, provider_id, completed_by, completed_at, providers:provider_id(name)')
            .eq('id', request_id)
            .single();

        if (error) throw error;

        const row = {
            ...data,
            provider_name: data.providers?.name || null,
            providers: undefined,
            status: normalizeStatusFilter(data.status) || 'pendiente',
        };

        return Response.json(row);
    } catch (error) {
        console.error('Error updating supply request status:', error);
        return Response.json({ error: 'Failed to update request status' }, { status: 500 });
    }
}
