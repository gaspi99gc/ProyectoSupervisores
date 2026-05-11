import { supabase } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'No se proporcionó archivo' }, { status: 400 });
        }

        const isCsv = file.name?.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
        let workbook;
        if (isCsv) {
            const text = await file.text();
            workbook = XLSX.read(text, { type: 'string' });
        } else {
            const bytes = await file.arrayBuffer();
            workbook = XLSX.read(bytes, { type: 'array' });
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return Response.json({ error: 'El archivo está vacío' }, { status: 400 });
        }

        const { data: existing } = await supabase.from('supplies').select('nombre');
        const existingNames = new Set(
            (existing || []).map(s => s.nombre.toLowerCase().trim())
        );

        let imported = 0;
        const failedRows = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2;

            const nombre = (row.nombre || row.Nombre || row.name || '').toString().trim();
            const unidad = (row.unidad || row.Unidad || row.unit || 'unidades').toString().trim();
            const proveedor = (row.proveedor || row.Proveedor || row.supplier || '').toString().trim() || null;
            const activoRaw = row.activo ?? row.Activo ?? row.active;
            const activo = activoRaw === undefined || activoRaw === ''
                ? true
                : activoRaw === false || activoRaw === 0 || String(activoRaw).toLowerCase() === 'false' || String(activoRaw) === '0'
                    ? false
                    : true;

            if (!nombre) {
                failedRows.push({ fila: rowNum, nombre: '', unidad, motivo: 'Falta el nombre del insumo' });
                continue;
            }

            if (existingNames.has(nombre.toLowerCase())) {
                failedRows.push({ fila: rowNum, nombre, unidad, motivo: 'Ya existe un insumo con este nombre' });
                continue;
            }

            try {
                const { error: insertError } = await supabase
                    .from('supplies')
                    .insert([{ nombre, unidad, activo, proveedor }]);

                if (insertError) {
                    failedRows.push({ fila: rowNum, nombre, unidad, motivo: insertError.message });
                } else {
                    existingNames.add(nombre.toLowerCase());
                    imported++;
                }
            } catch (e) {
                failedRows.push({ fila: rowNum, nombre, unidad, motivo: e.message });
            }
        }

        return Response.json({ imported, failedRows: failedRows.length > 0 ? failedRows : undefined });
    } catch (error) {
        console.error('Error importing supplies:', error.message);
        return Response.json({ error: 'Error al importar: ' + error.message }, { status: 500 });
    }
}

export async function GET() {
    const templateData = [
        { nombre: 'Lavandina', unidad: 'litros', proveedor: 'Proveedor Ejemplo SA' },
        { nombre: 'Detergente', unidad: 'litros', proveedor: 'Distribuidora Ejemplo' },
        { nombre: 'Guantes descartables', unidad: 'unidades', proveedor: '' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Insumos');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buf, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="plantilla-insumos.xlsx"',
        },
    });
}
