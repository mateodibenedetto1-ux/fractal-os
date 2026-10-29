import Link from 'next/link';
import { getLabEntries, getLabPages } from '@/lib/data';
import { addLabEntry, syncAtlasNow } from '@/lib/actions';
import { METHOD, TIPOS, TIPO_HELP, TIPO_PLURAL, VAULT_LINKS } from '@/lib/lab-content';
import { AtlasTable } from '@/components/AtlasTable';

export const metadata = { title: 'Laboratorio' };

const TABS = [
  { k: 'resumen', l: 'Resumen' },
  { k: 'atlas', l: 'Atlas' },
  { k: 'clientes', l: 'Por cliente' },
  { k: 'criterios', l: 'Criterios y archivo' },
];

export default async function Lab({ searchParams }: { searchParams: Promise<{ v?: string; tipo?: string }> }) {
  const { v = 'resumen', tipo } = await searchParams;
  const [entries, pages] = await Promise.all([getLabEntries(), getLabPages()]);
  const CLIENT_CASES = pages.filter((p) => p.section === 'cliente');
  const CRITERIA = pages.filter((p) => p.section === 'criterio');
  const open = entries.filter((e) => e.estado !== 'Validado' && e.estado !== 'Archivado');
  const critical = open.filter((e) => e.prioridad === 'Crítica');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Laboratorio</h1>
          <p>Aprender de cada cliente y convertirlo en mejores sistemas.</p>
        </div>
        <form action={syncAtlasNow}><button className="btn">Traer cambios de Notion</button></form>
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <Link key={t.k} href={`/panel/laboratorio?v=${t.k}`} aria-current={v === t.k ? 'page' : undefined}>{t.l}</Link>
        ))}
      </nav>

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
