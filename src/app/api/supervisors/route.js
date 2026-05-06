import { supabase } from '@/lib/db';
import { ensureSupervisorStatusRow } from '@/lib/supervisor-status';


export async function GET() {
    try {
        const { data, error } = await supabase
            .from('app_users')
            .select('id, name, surname, username, login_enabled, supervisors(id)')
            .eq('role', 'supervisor')
            .order('surname', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        const result = (data || []).map(u => ({
            id: u.supervisors?.[0]?.id ?? null,
            app_user_id: u.id,
            name: u.name,
            surname: u.surname,
            dni: u.username,
            login_enabled: u.login_enabled !== false,
        }));

        return Response.json(result);
    } catch (error) {
        console.error('Error fetching supervisors:', error);
        return Response.json({ error: 'Failed to fetch supervisors' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const { name, surname, dni, password, login_enabled } = await req.json();
        const normalizedName = name?.trim();
        const normalizedSurname = surname?.trim();
        const normalizedDni = dni?.toString().trim().toLowerCase();
        const normalizedPassword = password?.toString() || '';

        if (!normalizedName || !normalizedSurname || !normalizedDni) {
            return Response.json({ error: 'Nombre, apellido y DNI son obligatorios' }, { status: 400 });
        }
        if (normalizedPassword.length < 6) {
            return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
        }

        const email = `${normalizedDni}@lasia.com.ar`;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: normalizedPassword,
            email_confirm: true,
        });

        if (authError) {
            const msg = authError.message?.toLowerCase() || '';
            if (msg.includes('already') || authError.code === 'email_exists') {
                return Response.json({ error: 'Ya existe un supervisor con ese DNI' }, { status: 400 });
            }
            throw authError;
        }

        const authId = authData.user.id;

        const { error: profileError } = await supabase
            .from('app_users')
            .insert({
                id: authId,
                username: normalizedDni,
                name: normalizedName,
                surname: normalizedSurname,
                role: 'supervisor',
                login_enabled: login_enabled !== false,
            });

        if (profileError) {
            await supabase.auth.admin.deleteUser(authId);
            throw profileError;
        }

        const { data: sup, error: supError } = await supabase
            .from('supervisors')
            .insert({ app_user_id: authId })
            .select('id')
            .single();

        if (supError) {
            await supabase.auth.admin.deleteUser(authId);
            throw supError;
        }

        await ensureSupervisorStatusRow(sup.id);

        return Response.json({
            id: sup.id,
            name: normalizedName,
            surname: normalizedSurname,
            dni: normalizedDni,
            login_enabled: login_enabled !== false,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating supervisor:', error);
        return Response.json({ error: 'Failed to create supervisor' }, { status: 500 });
    }
}
