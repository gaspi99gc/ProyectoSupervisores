import { supabase } from '@/lib/db';
import { ensureSupervisorStatusRow } from '@/lib/supervisor-status';

function sanitize(row) {
    const user = row.app_users;
    return {
        id: row.id,
        name: user?.name || null,
        surname: user?.surname || null,
        dni: user?.username || null,
        login_enabled: user?.login_enabled !== false,
    };
}

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('supervisors')
            .select('id, app_users(name, surname, username, login_enabled)')
            .order('app_users(surname)', { ascending: true });

        if (error) throw error;

        return Response.json((data || []).map(sanitize));
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
