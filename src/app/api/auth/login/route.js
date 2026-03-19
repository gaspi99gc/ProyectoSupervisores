import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';
import { ensureSupervisorAuthColumns } from '@/lib/supervisor-auth';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

export async function POST(req) {
    try {
        const { username, dni, password } = await req.json();
        const loginUsername = (username || dni || '').toString().trim();
        const loginPassword = (password || '').toString();

        if (!loginUsername || !loginPassword) {
            return Response.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 });
        }

        if (loginUsername === ADMIN_USERNAME) {
            if (loginPassword !== ADMIN_PASSWORD) {
                return Response.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
            }

            const adminUser = { id: 0, name: 'Admin', surname: 'LASIA', dni: ADMIN_USERNAME, role: 'admin' };
            return Response.json({ user: adminUser });
        }

        await ensureSupervisorAuthColumns();

        const { rows } = await db.execute({
            sql: 'SELECT id, name, surname, dni, password_hash, login_enabled FROM supervisors WHERE dni = ?',
            args: [loginUsername]
        });

        if (rows.length > 0) {
            const supervisor = rows[0];

            if (!supervisor.login_enabled) {
                return Response.json({ error: 'Tu acceso esta deshabilitado. Contactá al administrador.' }, { status: 403 });
            }

            if (!supervisor.password_hash) {
                return Response.json({ error: 'Tu usuario todavia no tiene contraseña configurada. Contactá al administrador.' }, { status: 401 });
            }

            if (!verifyPassword(loginPassword, supervisor.password_hash)) {
                return Response.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
            }

            const user = {
                id: supervisor.id,
                name: supervisor.name,
                surname: supervisor.surname,
                dni: supervisor.dni,
                role: 'supervisor'
            };
            return Response.json({ user });
        }

        return Response.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
    } catch (error) {
        console.error('Error in login API:', error);
        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
