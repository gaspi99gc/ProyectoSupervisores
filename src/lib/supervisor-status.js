import { supabase } from '@/lib/db';

function normalizeSupervisorStatus(status) {
    return status === 'trabajando' || status === 'chambeando' ? 'chambeando' : 'afuera';
}

export async function ensureSupervisorStatusTable() {
    // On Supabase, tables are managed via SQL migrations
    return;
}

export async function ensureSupervisorStatusRow(supervisorId) {
    await supabase
        .from('supervisor_status')
        .upsert(
            { supervisor_id: supervisorId, status: 'afuera', updated_at: new Date().toISOString() },
            { onConflict: 'supervisor_id', ignoreDuplicates: true }
        );
}

export async function getSupervisorStatus(supervisorId) {
    await ensureSupervisorStatusRow(supervisorId);

    const { data, error } = await supabase
        .from('supervisor_status')
        .select('supervisor_id, status, current_service_id, entered_at, entered_lat, entered_lng, exited_at, updated_at')
        .eq('supervisor_id', supervisorId)
        .single();

    if (error || !data) {
        return null;
    }

    let currentServiceName = null;
    let currentServiceAddress = null;

    if (data.current_service_id) {
        const { data: service } = await supabase
            .from('services')
            .select('name, address')
            .eq('id', data.current_service_id)
            .single();

        if (service) {
            currentServiceName = service.name;
            currentServiceAddress = service.address;
        }
    }

    return {
        ...data,
        current_service_name: currentServiceName,
        current_service_address: currentServiceAddress,
        status: normalizeSupervisorStatus(data.status),
    };
}

export async function updateSupervisorStatus(supervisorId, status) {
    await ensureSupervisorStatusRow(supervisorId);

    const currentStatus = await getSupervisorStatus(supervisorId);
    const normalizedStatus = normalizeSupervisorStatus(status);
    const serviceId = Number(currentStatus?.current_service_id);

    if (normalizedStatus === 'afuera' && (!Number.isFinite(serviceId) || serviceId <= 0)) {
        throw new Error('No hay un servicio activo para registrar la salida.');
    }

    const now = new Date().toISOString();
    const updateData = { status: normalizedStatus, updated_at: now };

    if (normalizedStatus === 'chambeando') {
        updateData.entered_at = now;
    } else {
        updateData.current_service_id = null;
        updateData.entered_lat = null;
        updateData.entered_lng = null;
        updateData.exited_at = now;
    }

    const { error } = await supabase
        .from('supervisor_status')
        .update(updateData)
        .eq('supervisor_id', supervisorId);

    if (error) throw error;

    if (Number.isFinite(serviceId) && serviceId > 0) {
        await supabase
            .from('supervisor_presentismo_logs')
            .insert({
                supervisor_id: supervisorId,
                service_id: serviceId,
                event_type: normalizedStatus === 'chambeando' ? 'ingreso' : 'salida',
                event_lat: null,
                event_lng: null,
            });
    }

    return getSupervisorStatus(supervisorId);
}

export async function updateSupervisorStatusWithService(supervisorId, status, serviceId, coordinates) {
    await ensureSupervisorStatusRow(supervisorId);

    const normalizedStatus = normalizeSupervisorStatus(status);

    if (normalizedStatus !== 'chambeando') {
        return updateSupervisorStatus(supervisorId, normalizedStatus);
    }

    const normalizedServiceId = Number(serviceId);

    if (!Number.isFinite(normalizedServiceId) || normalizedServiceId <= 0) {
        throw new Error('Seleccioná un servicio antes de ingresar.');
    }

    const enteredLat = Number(coordinates?.lat);
    const enteredLng = Number(coordinates?.lng);

    if (!Number.isFinite(enteredLat) || !Number.isFinite(enteredLng)) {
        throw new Error('No se pudieron obtener las coordenadas exactas del ingreso.');
    }

    const now = new Date().toISOString();

    const { error } = await supabase
        .from('supervisor_status')
        .update({
            status: 'chambeando',
            current_service_id: normalizedServiceId,
            entered_at: now,
            entered_lat: enteredLat,
            entered_lng: enteredLng,
            exited_at: null,
            updated_at: now,
        })
        .eq('supervisor_id', supervisorId);

    if (error) throw error;

    await supabase
        .from('supervisor_presentismo_logs')
        .insert({
            supervisor_id: supervisorId,
            service_id: normalizedServiceId,
            event_type: 'ingreso',
            event_lat: enteredLat,
            event_lng: enteredLng,
        });

    return getSupervisorStatus(supervisorId);
}
