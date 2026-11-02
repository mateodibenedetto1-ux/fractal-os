'use client';

import { useEffect, useRef, useState } from 'react';
import { saveBrain } from '@/lib/actions';
import { BRAIN, MODULES, brainMarkdown, brainPct, sectionPct, type BrainData } from '@/lib/brain';

interface Props {
  orgId: string;
  name: string;
  initial: BrainData;
  demo?: boolean;
}

export function BrainEditor({ orgId, name, initial, demo }: Props) {
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

  return (
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
  );
}
