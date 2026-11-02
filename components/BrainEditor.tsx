'use client';

import { useEffect, useRef, useState } from 'react';
import { saveBrain } from '@/lib/actions';
import { BRAIN, MODULES, brainMarkdown, brainPct, sectionPct, type BrainData } from '@/lib/brain';

type RoadmapStatus = 'generando' | 'listo' | 'error' | null;
const THRESHOLD = 80; // igual que ROADMAP_THRESHOLD en lib/roadmap-ai

interface Props {
  orgId: string;
  name: string;
  initial: BrainData;
  demo?: boolean;
  roadmap?: { roadmap_status: RoadmapStatus; roadmap_at: string | null; roadmap_error: string | null };
  /** Vista del equipo: puede volver a crear el roadmap. */
  staff?: boolean;
  roadmapHref?: string;
}

export function BrainEditor({ orgId, name, initial, demo, roadmap, staff, roadmapHref }: Props) {
  const [data, setData] = useState<BrainData>(initial);
  const [active, setActive] = useState(() => BRAIN.find((s) => sectionPct(initial, s) < 100)?.k ?? BRAIN[0].k);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const flush = async () => {
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length || demo) return;
    setStatus('saving');
    try {
      await saveBrain(orgId, patch);
      setStatus('saved');
    } catch {
      pending.current = { ...patch, ...pending.current };
      setStatus('error');
    }
  };

  const change = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    pending.current[key] = value;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  };

  // Guarda lo pendiente antes de salir de la página
  useEffect(() => {
    const onLeave = () => { if (Object.keys(pending.current).length) void flush(); };
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('beforeunload', onLeave); onLeave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const section = BRAIN.find((s) => s.k === active)!;
  const idx = BRAIN.indexOf(section);
  const mod = MODULES.find((m) => m.k === section.mod)!;
  const total = brainPct(data);

  // ---------- Roadmap personalizado ----------
  const [rm, setRm] = useState(roadmap ?? { roadmap_status: null as RoadmapStatus, roadmap_at: null as string | null, roadmap_error: null as string | null });
  const [rmBusy, setRmBusy] = useState(false);
  // El servidor lo dispara al guardar cuando se cruza el umbral; acá solo lo reflejamos
  useEffect(() => {
    if (!rm.roadmap_status && total >= THRESHOLD && status === 'saved' && !demo) setRm((r) => ({ ...r, roadmap_status: 'generando' }));
  }, [total, status, rm.roadmap_status, demo]);
  useEffect(() => {
    if (rm.roadmap_status !== 'generando' || demo) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/brain/roadmap?org=${orgId}`, { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); if (j.roadmap_status && j.roadmap_status !== 'generando') setRm(j); }
      } catch { /* reintenta en el próximo ciclo */ }
    }, 6000);
    return () => clearInterval(id);
  }, [rm.roadmap_status, orgId, demo]);
  const createRoadmap = async () => {
    setRmBusy(true);
    setRm((r) => ({ ...r, roadmap_status: 'generando', roadmap_error: null }));
    try {
      await flush();
      const r = await fetch('/api/brain/roadmap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orgId }) });
      const j = await r.json().catch(() => ({}));
      setRm(r.ok ? { roadmap_status: 'listo', roadmap_at: new Date().toISOString(), roadmap_error: null } : { roadmap_status: 'error', roadmap_at: null, roadmap_error: j.error ?? 'No se pudo crear' });
    } finally {
      setRmBusy(false);
    }
  };

  const go = (k: string) => {
    void flush();
    setActive(k);
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const download = () => {
    const blob = new Blob([brainMarkdown(data, name)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `segundo-cerebro-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const banner = (
    <div className={`panel panel-pad brain-roadmap ${rm.roadmap_status ?? 'pendiente'}`}>
      {rm.roadmap_status === 'listo' ? (
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="grow" style={{ minWidth: 240 }}>
            <b>Roadmap personalizado listo</b>
            <p className="muted small">Creado el {new Date(rm.roadmap_at ?? Date.now()).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} a partir de este Segundo cerebro. Tiene los hitos de las 12 semanas, las tareas en Accionables y el documento con la estrategia en Biblioteca.</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {roadmapHref && <a className="btn primary sm" href={roadmapHref}>Ver roadmap</a>}
            {staff && <button className="btn sm" disabled={rmBusy} onClick={() => { if (confirm('¿Volver a crear el roadmap? Reemplaza los hitos y las tareas pendientes que creó la IA.')) void createRoadmap(); }}>Volver a crear</button>}
          </div>
        </div>
      ) : rm.roadmap_status === 'generando' ? (
        <div>
          <b className="ai-typing">Creando tu roadmap personalizado…</b>
          <p className="muted small">Lo armamos con todo lo que escribiste y con cómo trabajamos con todos nuestros clientes. Tarda 1 o 2 minutos; podés seguir acá.</p>
        </div>
      ) : rm.roadmap_status === 'error' ? (
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="grow" style={{ minWidth: 240 }}>
            <b>No se pudo crear el roadmap</b>
            <p className="muted small">{staff ? rm.roadmap_error : 'Volvé a intentar en un rato. Si sigue fallando, avisale al equipo de Fractal.'}</p>
          </div>
          <button className="btn sm" disabled={rmBusy} onClick={() => void createRoadmap()}>Reintentar</button>
        </div>
      ) : (
        <div className="row between wrap" style={{ gap: 12 }}>
          <div className="grow" style={{ minWidth: 240 }}>
            <b>{total >= THRESHOLD ? 'Ya podés crear tu roadmap' : `Completá el ${THRESHOLD} % y creamos tu roadmap`}</b>
            <p className="muted small">
              {total >= THRESHOLD
                ? 'Con lo que escribiste armamos tu roadmap personalizado de 12 semanas.'
                : `Cuando llegues al ${THRESHOLD} %, se crea solo tu roadmap personalizado de 12 semanas, basado en lo que escribas acá. Te falta ${THRESHOLD - total} %.`}
            </p>
            <div className="bar" style={{ maxWidth: 320, marginTop: 8 }}><span style={{ width: `${Math.min(100, (total / THRESHOLD) * 100)}%` }} /></div>
          </div>
          {(total >= THRESHOLD || staff) && <button className="btn primary sm" disabled={rmBusy || demo} onClick={() => void createRoadmap()}>Crear roadmap</button>}
        </div>
      )}
    </div>
  );

  return (
    <>
    {banner}
    <div className="brain" ref={top}>
      <aside className="brain-index">
        <div className="brain-total">
          <b>{total}%</b>
          <span className="muted small">de tu Segundo cerebro completo</span>
          <div className="bar"><span style={{ width: `${total}%` }} /></div>
        </div>
        <nav aria-label="Secciones">
          {MODULES.map((m) => (
            <div key={m.k} className="brain-mod">
              <span className="brain-mod-title">{m.n} · {m.title}</span>
              {BRAIN.filter((s) => s.mod === m.k).map((s) => {
                const p = sectionPct(data, s);
                return (
                  <button key={s.k} className={`brain-tab ${s.k === active ? 'on' : ''} ${p === 100 ? 'full' : ''}`} onClick={() => go(s.k)}>
                    <i>{s.n}</i>
                    <span>{s.title}</span>
                    <em>{p}%</em>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <span className={`muted small brain-status ${status}`}>
            {status === 'saving' ? 'Guardando…' : status === 'error' ? 'No se pudo guardar. Reintentá.' : 'Autoguardado activo'}
          </span>
          <button className="btn ghost sm" onClick={download} style={{ marginLeft: 'auto' }}>Descargar</button>
        </div>
      </aside>

      <section className="brain-body" key={section.k}>
        <div className="brain-kicker">Sección {section.n} de {BRAIN.length} · Módulo {mod.n} {mod.title}</div>
        <h2>{section.title}</h2>
        <p className="muted">{section.intro}</p>
        <div className="bar" style={{ margin: '14px 0 26px', maxWidth: 260 }}><span style={{ width: `${sectionPct(data, section)}%` }} /></div>

        <div className="stack" style={{ gap: 22 }}>
          {section.fields.map((f) => {
            const key = `${section.k}.${f.k}`;
            return (
              <label key={key} className="brain-field">
                <span className="brain-label">{f.label}</span>
                {f.help && <span className="muted small">{f.help}</span>}
                {f.short ? (
                  <input className="input" value={data[key] ?? ''} onChange={(e) => change(key, e.target.value)} onBlur={() => void flush()} />
                ) : (
                  <textarea className="input" rows={3} value={data[key] ?? ''} onChange={(e) => change(key, e.target.value)} onBlur={() => void flush()} />
                )}
              </label>
            );
          })}
        </div>

        <div className="row between" style={{ marginTop: 30 }}>
          {idx > 0 ? <button className="btn" onClick={() => go(BRAIN[idx - 1].k)}>← {BRAIN[idx - 1].title}</button> : <span />}
          {idx < BRAIN.length - 1 && <button className="btn primary" onClick={() => go(BRAIN[idx + 1].k)}>{BRAIN[idx + 1].title} →</button>}
        </div>
      </section>
    </div>
    </>
  );
}
