import Link from 'next/link';
import { getKbDocs, getLabEntries, getLabPages, getTeamCalls } from '@/lib/data';
import { marked } from 'marked';
import { TEAM_KINDS, teamLabel } from '@/lib/team';
import { fmtDate } from '@/lib/format';
import { reprocessCall } from '@/lib/actions';
import { MODULES } from '@/lib/brain';
import { addLabEntry, syncAtlasNow } from '@/lib/actions';
import { METHOD, TIPOS, TIPO_HELP, TIPO_PLURAL, VAULT_LINKS } from '@/lib/lab-content';
import { AtlasTable } from '@/components/AtlasTable';

export const metadata = { title: 'Laboratorio' };
export const maxDuration = 300;

const TABS = [
  { k: 'resumen', l: 'Resumen' },
  { k: 'atlas', l: 'Atlas' },
  { k: 'clientes', l: 'Por cliente' },
  { k: 'equipo', l: 'Equipo' },
  { k: 'criterios', l: 'Criterios y archivo' },
  { k: 'conocimiento', l: 'Conocimiento' },
];

export default async function Lab({ searchParams }: { searchParams: Promise<{ v?: string; tipo?: string; k?: string }> }) {
  const { v = 'resumen', tipo, k: teamK } = await searchParams;
  const [entries, pages, kb, teamCalls] = await Promise.all([
    getLabEntries(), getLabPages(),
    v === 'conocimiento' ? getKbDocs() : Promise.resolve([]),
    v === 'equipo' ? getTeamCalls(60) : Promise.resolve([]),
  ]);
  const CLIENT_CASES = pages.filter((p) => p.section === 'cliente');
  const CRITERIA = pages.filter((p) => p.section === 'criterio');
  const open = entries.filter((e) => e.estado !== 'Validado' && e.estado !== 'Archivado');
  const critical = open.filter((e) => e.prioridad === 'Crítica');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Laboratorio</h1>
          <p>Aprender de cada cliente y del equipo, y convertirlo en mejores sistemas.</p>
        </div>
        <form action={syncAtlasNow}><button className="btn">Traer cambios de Notion</button></form>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.k} href={`/panel/laboratorio?v=${t.k}`} aria-current={v === t.k ? 'page' : undefined}>{t.l}</Link>
        ))}
      </nav>

      {v === 'conocimiento' && (
        <div className="stack" style={{ gap: 22 }}>
          <p className="muted" style={{ maxWidth: '68ch' }}>
            La bóveda de documentos de Fractal: SOPs, setting, closing y ofertas. La IA de Fractal la consulta antes de responder. Solo la ve el equipo.
          </p>
          {kb.length === 0 && <div className="panel empty">Todavía no hay documentos cargados.</div>}
          {Array.from(new Set(kb.map((d) => d.category ?? 'Otros'))).map((cat) => {
            const list = kb.filter((d) => (d.category ?? 'Otros') === cat);
            return (
              <section key={cat}>
                <h2 className="section-title">{cat} · {list.length}</h2>
                <ul className="list panel">
                  {list.map((d) => (
                    <li key={d.id}>
                      <Link href={`/panel/laboratorio/kb/${d.id}`} className="list-row">
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div>{d.title}</div>
                          <div className="muted small">
                            {[MODULES.find((m) => m.k === d.module)?.title && `Módulo ${MODULES.find((m) => m.k === d.module)!.n} · ${MODULES.find((m) => m.k === d.module)!.title}`, d.kind, d.chars ? `${Math.round(d.chars / 1000)}k caracteres` : null].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {d.status !== 'ok' && <span className="tag warn">{d.status === 'sin_acceso' ? 'Sin acceso' : 'Sin texto'}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {v === 'resumen' && (
        <div className="stack" style={{ gap: 28 }}>
          <section>
            <h2 className="section-title">Cómo trabajamos un aprendizaje</h2>
            <ol className="panel method" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {METHOD.map((m, i) => (
                <div key={m.name} role="listitem"><span className="n">0{i + 1}</span><b>{m.name}</b><p className="muted small">{m.text}</p></div>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="section-title">Qué hay en el Atlas</h2>
            <div className="kpis" style={{ marginBottom: 0 }}>
              {TIPOS.map((t) => {
                const n = entries.filter((e) => e.tipo === t).length;
                if (!n) return null;
                return (
                  <Link key={t} href={`/panel/laboratorio?v=atlas&tipo=${encodeURIComponent(t)}`} className="panel kpi" style={{ textDecoration: 'none' }}>
                    <b>{n}</b><span>{TIPO_PLURAL[t]} · {TIPO_HELP[t].toLowerCase()}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="two">
            <section>
              <h2 className="section-title">Abierto y crítico · {critical.length}</h2>
              <ul className="list panel">
                {critical.map((e) => (
                  <li key={e.id}>
                    <Link href="/panel/laboratorio?v=atlas" className="list-row">
                      <div className="grow">
                        <div>{e.title}</div>
                        <div className="muted small">{e.tipo} · {e.area}{e.cliente ? ` · ${e.cliente}` : ''}</div>
                      </div>
                      <span className="tag">{e.estado}</span>
                    </Link>
                  </li>
                ))}
                {!critical.length && <li className="empty">No hay registros críticos abiertos.</li>}
              </ul>
            </section>
            <section>
              <h2 className="section-title">Bóveda central</h2>
              <ul className="list panel">
                {VAULT_LINKS.map((l) => (
                  <li key={l.id}>
                    <a className="list-row" href={`https://www.notion.so/${l.id}`} target="_blank" rel="noopener noreferrer">
                      <div className="grow"><div>{l.title}</div><div className="muted small">{l.text}</div></div>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}

      {v === 'atlas' && (
        <div className="stack" style={{ gap: 20 }}>
          <details className="panel panel-pad disclose">
            <summary className="row between"><b style={{ fontWeight: 500 }}>Registrar en el Atlas</b><span className="btn sm">Abrir</span></summary>
            <p className="muted small" style={{ margin: '10px 0 16px' }}>Se guarda acá y en el Atlas de Notion como respaldo.</p>
            <form action={addLabEntry} className="stack" style={{ gap: 14 }}>
              <label className="field">Qué pasó o qué aprendimos<input className="input" name="title" required /></label>
              <div className="form-grid">
                <label className="field">Tipo
                  <select className="select" name="tipo" defaultValue="Aprendizaje">{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
                </label>
                <label className="field">Área
                  <select className="select" name="area" defaultValue="Servicio">
                    {['Servicio', 'Creatividad', 'Operaciones', 'Oferta', 'Comercial', 'Producto', 'Finanzas'].map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <label className="field">Prioridad
                  <select className="select" name="prioridad" defaultValue="Media">{['Crítica', 'Alta', 'Media', 'Baja'].map((a) => <option key={a}>{a}</option>)}</select>
                </label>
                <label className="field">Cliente<input className="input" name="cliente" placeholder="Opcional" /></label>
                <label className="field">Fuente<input className="input" name="fuente" type="url" placeholder="Link de la llamada o documento" /></label>
              </div>
              <label className="field">Notas<textarea className="textarea" name="notas" style={{ minHeight: 90 }} placeholder="Hecho, causa probable y qué vamos a probar" /></label>
              <div><button className="btn primary">Registrar</button></div>
            </form>
          </details>
          <AtlasTable entries={entries} initialTipo={tipo} />
        </div>
      )}

      {v === 'clientes' && (
        <div className="stack" style={{ gap: 16 }}>
          <p className="muted small" style={{ maxWidth: '72ch' }}>
            Un caso por cliente: qué pasó, qué aprendimos y la regla que sale de eso. Son lecturas retrospectivas; la ficha completa separa hechos de interpretaciones.
          </p>
          {!CLIENT_CASES.length && <div className="panel empty">Todavía no hay fichas por cliente.</div>}
          <div className="case-grid">
            {CLIENT_CASES.map((c) => (
              <Link key={c.id} href={`/panel/laboratorio/doc/${c.notion_id}`} className="panel case">
                <div>
                  <div className="muted small">{c.client}</div>
                  <div style={{ fontWeight: 500, fontSize: 16 }}>{c.title}</div>
                </div>
                <dl style={{ margin: 0 }}>
                  <dt>Qué pasó</dt><dd>{c.happened}</dd>
                  <dt>Aprendizaje</dt><dd>{c.learning}</dd>
                  <dt>Regla</dt><dd className="rule">{c.rule}</dd>
                </dl>
              </Link>
            ))}
          </div>
        </div>
      )}

      {v === 'equipo' && (() => {
        const teamEntries = entries.filter((e) => e.cliente === 'Equipo');
        const calls = teamK ? teamCalls.filter((c) => (c.team_kind ?? 'equipo') === teamK) : teamCalls;
        return (
          <div className="stack" style={{ gap: 26 }}>
            <p className="muted small" style={{ maxWidth: '72ch' }}>
              Lo que sale de las reuniones internas: dailies, Creativity Core, llamadas con editores y del equipo. Cada reunión que asignás a Equipo en Reuniones genera su resumen, las tareas van al Tracker Fractal y lo aprendido queda acá y en el Atlas.
            </p>

            <section>
              <h2 className="section-title">Aprendizajes del equipo · {teamEntries.length}</h2>
              {teamEntries.length ? <AtlasTable entries={teamEntries} /> : <div className="panel empty">Todavía no hay aprendizajes de reuniones del equipo. Aparecen solos cuando asignás una reunión a Equipo.</div>}
            </section>

            <section>
              <div className="row between" style={{ flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                <h2 className="section-title" style={{ margin: 0 }}>Reuniones · {calls.length}</h2>
                <div className="chips">
                  <Link href="/panel/laboratorio?v=equipo" className={`chip ${!teamK ? 'on' : ''}`}>Todas</Link>
                  {TEAM_KINDS.map((t) => (
                    <Link key={t.k} href={`/panel/laboratorio?v=equipo&k=${t.k}`} className={`chip ${teamK === t.k ? 'on' : ''}`}>
                      {t.l} · {teamCalls.filter((c) => (c.team_kind ?? 'equipo') === t.k).length}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {!calls.length && <div className="panel empty">No hay reuniones de este tipo todavía.</div>}
                {calls.map((c) => (
                  <details key={c.id} className="panel panel-pad disclose">
                    <summary className="row between" style={{ gap: 10 }}>
                      <div className="grow">
                        <div style={{ fontWeight: 500 }}>{c.title}</div>
                        <div className="muted small">{teamLabel(c.team_kind)} · {fmtDate(c.held_at)}{c.status !== 'procesada' ? ` · ${c.status === 'error' ? 'Error al procesar' : 'Procesando'}` : ''}</div>
                      </div>
                      <span className="btn sm">Ver resumen</span>
                    </summary>
                    <div className="ai-md" style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: marked.parse((c.summary_md ?? '_Sin resumen todavía._').replace(/<[^>]+>/g, ''), { async: false }) as string }} />
                    <div className="row" style={{ gap: 8, marginTop: 12 }}>
                      {c.share_url && <a className="btn sm" href={c.share_url} target="_blank" rel="noopener noreferrer">Grabación</a>}
                      <form action={reprocessCall.bind(null, c.id)}><button className="btn sm ghost" title="Vuelve a generar resumen y tareas">Regenerar</button></form>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        );
      })()}

      {v === 'criterios' && (
        <ul className="list panel">
          {!CRITERIA.length && <li className="empty">Todavía no hay criterios cargados.</li>}
          {CRITERIA.map((c) => (
            <li key={c.id}>
              <Link href={`/panel/laboratorio/doc/${c.notion_id}`} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div style={{ fontWeight: 500 }}>{c.title}</div>
                  <div className="muted small" style={{ marginTop: 3, maxWidth: '70ch' }}>{c.summary}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
