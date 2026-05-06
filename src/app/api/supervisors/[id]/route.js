import { supabase } from '@/lib/db';

export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const { name, surname, dni, password, login_enabled } = await req.json();
        const normalizedName = name?.trim();
        const normalizedSurname = surname?.trim();
        const normalizedDni = dni?.toString().trim().toLowerCase();
        const normalizedPassword = password?.toString() || '';

        if (!normalizedName || !normalizedSurname || !normalizedDni) {
            return Response.json({ error: 'Nombre, apellido y DNI son obligatorios' }, { status: 400 });
        }
        if (normalizedPassword && normalizedPassword.length < 6) {
            return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        // Look up the app_user_id via the integer supervisor id
        const { data: sup, error: supFetchError } = await supabase
            .from('supervisors')
            .select('id, app_user_id')
            .eq('id', id)
            .single();

        if (supFetchError || !sup) {
            return Response.json({ error: 'Supervisor no encontrado' }, { status: 404 });
        }

        // Check DNI uniqueness (username in app_users)
        const { data: existing } = await supabase
            .from('app_users')
            .select('id')
            .eq('username', normalizedDni)
            .neq('id', sup.app_user_id)
            .maybeSingle();

        if (existing) {
            return Response.json({ error: 'Ya existe un supervisor con ese DNI' }, { status: 400 });
        }

        if (normalizedPassword) {
            const { error: pwError } = await supabase.auth.admin.updateUserById(sup.app_user_id, { password: normalizedPassword });
            if (pwError) throw pwError;
        }

        const { error: updateError } = await supabase
            .from('app_users')
            .update({
                name: normalizedName,
                surname: normalizedSurname,
                username: normalizedDni,
                login_enabled: login_enabled !== false,
            })
            .eq('id', sup.app_user_id);

        if (updateError) throw updateError;

        return Response.json({
            id: sup.id,
            name: normalizedName,
            surname: normalizedSurname,
            dni: normalizedDni,
            login_enabled: login_enabled !== false,
        });
    } catch (error) {
        console.error('Error updating supervisor:', error);
        return Response.json({ error: 'Failed to update supervisor' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        const { data: sup, error: supFetchError } = await supabase
            .from('supervisors')
            .select('app_user_id')
            .eq('id', id)
            .single();

        if (supFetchError || !sup) {
            return Response.json({ error: 'Supervisor no encontrado' }, { status: 404 });
        }

        // Deleting the auth user cascades: auth.users → app_users → supervisors → status/routes/logs
        const { error } = await supabase.auth.admin.deleteUser(sup.app_user_id);
        if (error) throw error;

        return Response.json({ success: true });
    } catch (error) {
        console.error('Error deleting supervisor:', error);
        return Response.json({ error: 'Failed to delete supervisor' }, { status: 500 });
    }
}
