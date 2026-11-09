'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff } from './data';
import { supabaseAdmin } from './supabase/admin';
import { todayAR } from './health';
import { dailyTargetOf, recomputeKpi } from './eod';
import { NOTION_DB, createRow, hasNotion, updateRow } from './notion';

const refresh = () => revalidatePath('/panel/semaforo');

/** Guarda el reporte del día: valores de los KPIs, qué se hizo, pendientes y bloqueos. Lo copia a Notion (Fulfillment Reports). */
export async function saveEod(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const v = await requireStaff();
  const sb = supabaseAdmin();
  const day = String(form.get('day') || todayAR()).slice(0, 10);
  if (day > todayAR()) return { ok: false, error: 'No se puede reportar un día que todavía no pasó.' };

  // KPIs del día
  const entries = [...form.entries()].filter(([k]) => k.startsWith('kpi_'));
  let published = 0, planned = 0;
  const lines: string[] = [];
  for (const [k, raw] of entries) {
    const kpiId = k.slice(4);
    const value = Math.max(0, Number(raw) || 0);
    await sb.from('kpi_daily').upsert({ kpi_id: kpiId, day, value, updated_at: new Date().toISOString() });
    await recomputeKpi(sb, kpiId);
    const { data: kpi } = await sb.from('client_kpis').select('name, target').eq('id', kpiId).single();
    if (kpi) {
      const t = dailyTargetOf(Number(kpi.target));
      published += value; planned += t;
      lines.push(`${kpi.name}: ${value} de ${t}`);
    }
  }

  const row = {
    day, author: v.name,
    done: String(form.get('done') ?? '').trim() || null,
    pending: String(form.get('pending') ?? '').trim() || null,
    blockers: String(form.get('blockers') ?? '').trim() || null,
    published, planned, updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await sb.from('daily_reports').upsert(row, { onConflict: 'day,author' }).select('id, notion_id').single();
  if (error) return { ok: false, error: error.message };

  // Copia en Notion como registro (no bloquea si falla)
  if (hasNotion()) {
    try {
      const [, m, d] = day.split('-');
      const values = {
        'Nombre del reporte (ej: Nacho · 2/11)': `${v.name} · ${Number(d)}/${Number(m)}`,
        Date: day, Type: 'Daily', Published: published, Planned: Math.round(planned * 10) / 10,
        'On-Time Rate': planned ? Math.round((published / planned) * 100) / 100 : null,
        Notes: [row.done ? `Hecho: ${row.done}` : '', lines.length ? `KPIs: ${lines.join(' · ')}` : ''].filter(Boolean).join('\n'),
        Pending: row.pending, Blockers: row.blockers,
      };
      if (saved?.notion_id) await updateRow(saved.notion_id, values);
      else {
        const id = await createRow(NOTION_DB.fulfillmentReports, values);
        await sb.from('daily_reports').update({ notion_id: id }).eq('id', saved!.id);
      }
    } catch { /* el registro en Notion es secundario */ }
  }
  refresh();
  return { ok: true };
}

/** Suma o resta al valor de hoy de un KPI diario. */
export async function bumpKpiToday(kpiId: string, delta: number) {
  await requireStaff();
  const sb = supabaseAdmin();
  const day = todayAR();
  const { data } = await sb.from('kpi_daily').select('value').eq('kpi_id', kpiId).eq('day', day).maybeSingle();
  const value = Math.max(0, Number(data?.value ?? 0) + delta);
  await sb.from('kpi_daily').upsert({ kpi_id: kpiId, day, value, updated_at: new Date().toISOString() });
  await recomputeKpi(sb, kpiId);
  refresh();
}

/** Cierra un strike con la medida que se tomó. */
export async function closeStrike(id: string, measure: string) {
  const v = await requireStaff();
  await supabaseAdmin().from('strikes').update({ status: 'cerrado', measure: measure.trim() || null, closed_by: v.name }).eq('id', id);
  refresh();
}

export async function reopenStrike(id: string) {
  await requireStaff();
  await supabaseAdmin().from('strikes').update({ status: 'abierto' }).eq('id', id);
  refresh();
}
