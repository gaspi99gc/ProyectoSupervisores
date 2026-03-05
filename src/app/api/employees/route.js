import { db } from '@/lib/db';

export async function GET() {
    try {
        const { rows } = await db.execute(`
      SELECT e.*, s.name as service_name, sup.name as supervisor_name, sup.surname as supervisor_surname
      FROM employees e
      LEFT JOIN services s ON e.servicio_id = s.id
      LEFT JOIN supervisors sup ON e.supervisor_id = sup.id
      ORDER BY e.apellido ASC, e.nombre ASC
    `);
        return Response.json(rows);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return Response.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const data = await req.json();

        // Check if Legajo exists
        if (data.legajo) {
            const existing = await db.execute({
                sql: 'SELECT id FROM employees WHERE legajo = ?',
                args: [data.legajo]
            });
            if (existing.rows.length > 0) {
                return Response.json({ error: 'Ya existe un empleado con este Legajo' }, { status: 400 });
            }
        }

        const { nombre, apellido, dni, cuil, fecha_ingreso, servicio_id, supervisor_id, legajo } = data;

        const result = await db.execute({
            sql: `INSERT INTO employees (legajo, nombre, apellido, dni, cuil, fecha_ingreso, servicio_id, supervisor_id, estado_empleado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Activo') RETURNING id`,
            args: [legajo || null, nombre, apellido, dni || null, cuil || null, fecha_ingreso || null, servicio_id || null, supervisor_id || null]
        });

        return Response.json({ id: result.rows[0].id, ...data, estado_empleado: 'Activo' }, { status: 201 });
    } catch (error) {
        console.error('Error creating employee:', error);
        return Response.json({ error: 'Failed to create employee' }, { status: 500 });
    }
}
