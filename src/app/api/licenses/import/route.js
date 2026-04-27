import { supabase } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        
        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }
        
        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        let addedCount = 0;
        let errors = [];
        
        for (const row of data) {
            const legajo = row.Legajo || row.legajo;
            const type = (row['Tipo Licencia'] || row.tipo_licencia || row.type || '').toLowerCase();
            const startDate = row['Fecha Inicio'] || row.fecha_inicio || row.start_date;
            const endDate = row['Fecha Fin'] || row.fecha_fin || row.end_date;
            const notes = row.Observaciones || row.observaciones || row.notes || '';
            
            if (!legajo || !type || !startDate || !endDate) {
                errors.push(`Fila incompleta: ${JSON.stringify(row)}`);
                continue;
            }
            
            // Buscar empleado por legajo
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('id')
                .eq('legajo', legajo)
                .single();
            
            if (empError || !employees) {
                errors.push(`Empleado no encontrado: ${legajo}`);
                continue;
            }
            
            const employee_id = employees.id;
            
            // Validar tipo de licencia
            const validTypes = ['vacaciones', 'enfermedad', 'maternidad', 'paternidad', 'psiquiatrica', 'sin_goce'];
            if (!validTypes.includes(type)) {
                errors.push(`Tipo de licencia inválido: ${type}`);
                continue;
            }
            
            try {
                const { error: insertError } = await supabase
                    .from('licenses')
                    .insert([{
                        employee_id,
                        type,
                        start_date: startDate,
                        end_date: endDate,
                        notes,
                        status: 'activa'
                    }]);
                
                if (insertError) {
                    errors.push(`Error insertando ${legajo}: ${insertError.message}`);
                } else {
                    addedCount++;
                }
            } catch (e) {
                errors.push(`Error insertando ${legajo}: ${e.message}`);
            }
        }
        
        return Response.json({ 
            message: `Importación completada. ${addedCount} licencias agregadas.`,
            added: addedCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error importing licenses:', error.message);
        return Response.json({ error: 'Failed to import licenses: ' + error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        const { data: rows, error } = await supabase
            .from('licenses')
            .select(`
                *,
                employees:employee_id (nombre, apellido, legajo)
            `)
            .order('start_date', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        // Convertir a Excel
        const exportData = rows.map(row => ({
            'Legajo': row.employees?.legajo,
            'Apellido': row.employees?.apellido,
            'Nombre': row.employees?.nombre,
            'Tipo Licencia': row.type,
            'Fecha Inicio': row.start_date,
            'Fecha Fin': row.end_date,
            'Observaciones': row.notes,
            'Estado': row.status
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Licencias');
        
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        return new Response(buf, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="licencias.xlsx"'
            }
        });
    } catch (error) {
        console.error('Error exporting licenses:', error.message);
        return Response.json({ error: 'Failed to export licenses: ' + error.message }, { status: 500 });
    }
}
