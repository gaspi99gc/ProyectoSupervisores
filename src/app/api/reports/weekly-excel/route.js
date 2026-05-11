import { supabase } from '@/lib/db';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

// Argentina is fixed at UTC-3 (no DST)
const toArg = (date) => new Date(date.getTime() - 3 * 60 * 60 * 1000);

const formatArgDate = (date) => {
    const a = toArg(date);
    return `${String(a.getUTCDate()).padStart(2, '0')}/${String(a.getUTCMonth() + 1).padStart(2, '0')}/${a.getUTCFullYear()}`;
};

const formatArgTime = (date) => {
    const a = toArg(date);
    return `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}:${String(a.getUTCSeconds()).padStart(2, '0')}`;
};

const formatDuration = (ms) => {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const DAY_NAMES = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
const BLUE = 'FF2E75B6';
const WHITE = 'FFFFFFFF';
const DARK_HEADER = 'FF1F3A4A';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const supervisorId = searchParams.get('supervisor_id');

        if (!supervisorId) {
            return Response.json({ error: 'supervisor_id es requerido' }, { status: 400 });
        }

        // --- Previous week calculation (Argentina time, Mon–Sun) ---
        const now = new Date();
        const argNow = toArg(now);
        const argDow = argNow.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
        const daysSinceMonday = argDow === 0 ? 6 : argDow - 1;

        // Monday of current week at 00:00 Argentina = 03:00 UTC
        const currentMondayUTC = new Date(argNow);
        currentMondayUTC.setUTCDate(argNow.getUTCDate() - daysSinceMonday);
        currentMondayUTC.setUTCHours(3, 0, 0, 0);

        // Previous week bounds
        const weekStart = new Date(currentMondayUTC);
        weekStart.setUTCDate(currentMondayUTC.getUTCDate() - 7);

        const weekEnd = new Date(currentMondayUTC);
        weekEnd.setUTCMilliseconds(-1); // Sunday 23:59:59.999 Argentina

        // --- Fetch supervisor name ---
        const { data: supData } = await supabase
            .from('supervisors')
            .select('app_users(name, surname)')
            .eq('id', supervisorId)
            .single();

        const supName = supData?.app_users?.name || 'Supervisor';
        const supSurname = supData?.app_users?.surname || '';
        const supervisorFullName = supSurname ? `${supSurname}, ${supName}` : supName;

        // --- Fetch logs ---
        const { data, error } = await supabase
            .from('supervisor_presentismo_logs')
            .select('event_type, occurred_at, service_id, services:service_id(name)')
            .eq('supervisor_id', supervisorId)
            .gte('occurred_at', weekStart.toISOString())
            .lte('occurred_at', weekEnd.toISOString())
            .order('occurred_at', { ascending: true });

        if (error) throw error;

        const logs = (data || []).map(l => ({
            event_type: l.event_type,
            occurred_at: new Date(l.occurred_at),
            service_id: l.service_id,
            service_name: l.services?.name || 'Sin servicio',
        }));

        // --- Pair ingreso + salida into visits ---
        const openIngresos = {};
        const visits = [];

        for (const event of logs) {
            if (event.event_type === 'ingreso') {
                openIngresos[event.service_id] = event;
            } else if (event.event_type === 'salida' && openIngresos[event.service_id]) {
                const ingreso = openIngresos[event.service_id];
                visits.push({
                    service_name: event.service_name,
                    ingreso: ingreso.occurred_at,
                    egreso: event.occurred_at,
                    durationMs: event.occurred_at - ingreso.occurred_at,
                });
                delete openIngresos[event.service_id];
            }
        }

        visits.sort((a, b) => a.ingreso - b.ingreso);

        // Group by day index (0=Mon … 6=Sun)
        const visitsByDay = Array.from({ length: 7 }, () => []);
        for (const visit of visits) {
            const dow = toArg(visit.ingreso).getUTCDay();
            const dayIdx = dow === 0 ? 6 : dow - 1;
            visitsByDay[dayIdx].push(visit);
        }

        // --- Build Excel ---
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte Semanal');

        sheet.columns = [
            { width: 14 },
            { width: 45 },
            { width: 13 },
            { width: 13 },
            { width: 12 },
        ];

        const weekStartLabel = formatArgDate(weekStart);
        const weekEndLabel = formatArgDate(weekEnd);

        const addRow = (...values) => sheet.addRow(values);

        const styleCell = (cell, opts = {}) => {
            if (opts.bold || opts.size || opts.color) {
                cell.font = { bold: opts.bold, size: opts.size, color: opts.color ? { argb: opts.color } : undefined };
            }
            if (opts.bg) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            }
            if (opts.align) {
                cell.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: false };
            }
        };

        // Row 1: Title
        addRow(`REPORTE SEMANAL  —  ${supervisorFullName.toUpperCase()}  |  ${weekStartLabel} al ${weekEndLabel}`);
        sheet.mergeCells(`A1:E1`);
        styleCell(sheet.getCell('A1'), { bold: true, size: 12, align: 'center' });
        sheet.getRow(1).height = 24;

        // Row 2: Column headers
        const headers = ['FECHA', 'SERVICIO', 'HORA INGRESO', 'HORA EGRESO', 'DURACIÓN'];
        sheet.addRow(headers);
        headers.forEach((_, i) => {
            const cell = sheet.getCell(2, i + 1);
            styleCell(cell, { bold: true, color: WHITE, bg: DARK_HEADER, align: 'center' });
        });
        sheet.getRow(2).height = 18;

        let totalWeekMs = 0;

        for (let d = 0; d < 7; d++) {
            // Compute Argentina date for this weekday
            const dayUTC = new Date(weekStart);
            dayUTC.setUTCDate(weekStart.getUTCDate() + d);
            const dayLabel = `${DAY_NAMES[d]} ${formatArgDate(dayUTC)}`;

            // Day header row (blue, merged)
            sheet.addRow([dayLabel]);
            const dayRowNum = sheet.rowCount;
            sheet.mergeCells(`A${dayRowNum}:E${dayRowNum}`);
            styleCell(sheet.getCell(`A${dayRowNum}`), { bold: true, size: 11, color: WHITE, bg: BLUE, align: 'center' });
            sheet.getRow(dayRowNum).height = 20;

            // Service visits
            const dayVisits = visitsByDay[d];
            let dayTotalMs = 0;

            for (const visit of dayVisits) {
                dayTotalMs += visit.durationMs;
                const row = sheet.addRow([
                    formatArgDate(visit.ingreso),
                    visit.service_name,
                    formatArgTime(visit.ingreso),
                    formatArgTime(visit.egreso),
                    formatDuration(visit.durationMs),
                ]);
                row.getCell(3).alignment = { horizontal: 'center' };
                row.getCell(4).alignment = { horizontal: 'center' };
                row.getCell(5).alignment = { horizontal: 'center' };
            }

            totalWeekMs += dayTotalMs;

            // Empty row before total
            sheet.addRow([]);

            // Total del día
            sheet.addRow(['', '', '', 'TOTAL DEL DÍA:', formatDuration(dayTotalMs)]);
            const totalRowNum = sheet.rowCount;
            styleCell(sheet.getCell(totalRowNum, 4), { bold: true, align: 'right' });
            styleCell(sheet.getCell(totalRowNum, 5), { bold: true, align: 'center' });

            // Empty row between days
            sheet.addRow([]);
        }

        // Total general
        sheet.addRow([]);
        sheet.addRow(['', '', '', 'TOTAL GENERAL DE HORAS', formatDuration(totalWeekMs)]);
        const grandRowNum = sheet.rowCount;
        styleCell(sheet.getCell(grandRowNum, 4), { bold: true, size: 12, align: 'right' });
        styleCell(sheet.getCell(grandRowNum, 5), { bold: true, size: 12, align: 'center' });

        // Output
        const buffer = await workbook.xlsx.writeBuffer();
        const safeName = supervisorFullName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_');
        const filename = `Reporte_Semanal_${safeName}_${weekStartLabel.replace(/\//g, '-')}.xlsx`;

        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (err) {
        console.error('Error generando Excel semanal:', err);
        return Response.json({ error: String(err?.message || err) }, { status: 500 });
    }
}
