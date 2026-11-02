'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';

type Source = { id: string; title: string };
type Msg = { role: 'user' | 'assistant'; content: string; sources?: Source[] };

const STAFF_SUGGESTIONS = [
  'Armame un guion de setting para un lead frío de Instagram',
  '¿Cómo manejo la objeción "lo tengo que pensar"?',
  'Dame la estructura de una oferta de $100k según la bóveda',
  '¿Cómo delego las historias sin perder el criterio creativo?',
];

const CLIENT_SUGGESTIONS = [
  'Ayudame a definir mejor mi cliente ideal',
  'Revisá mi oferta y decime qué mejorarías',
  'Dame 5 ideas de reels para esta semana',
  'Armame una secuencia de historias para vender',
];

marked.use({ renderer: { html: () => '' } }); // nunca renderizar HTML crudo del modelo

const KEY = 'fractal-ia-chat';


interface Props {
  clients?: { slug: string; name: string }[];
  initialClient?: string;
  /** Cliente fijo: oculta el selector (sección Fractal IA dentro de un cliente). */
  fixedClient?: string;
  /** "client": responde como consultor del cliente, con su API key, sin mostrar documentos internos. */
  mode?: 'staff' | 'client';
  intro?: string;
}

export function FractalChat({ clients = [], initialClient, fixedClient, mode = 'staff', intro }: Props) {
  const [client, setClient] = useState(fixedClient ?? initialClient ?? '');
  const SUGGESTIONS = mode === 'client' ? CLIENT_SUGGESTIONS : STAFF_SUGGESTIONS;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Conversación por cliente, guardada solo en este navegador
  useEffect(() => {
    try { setMsgs(JSON.parse(sessionStorage.getItem(`${KEY}:${mode}:${client}`) ?? '[]')); } catch { setMsgs([]); }
  }, [client]);
  useEffect(() => {
    if (busy) return;
    try { sessionStorage.setItem(`${KEY}:${mode}:${client}`, JSON.stringify(msgs.slice(-30))); } catch { /* sin storage */ }
  }, [msgs, busy, client, mode]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: client || undefined, mode, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      let sources: Source[] = [];
      try { sources = JSON.parse(decodeURIComponent(res.headers.get('x-sources') ?? '[]')); } catch { /* sin fuentes */ }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: 'assistant', content: acc, sources }]);
      }
    } catch (e) {
      setMsgs([...next, { role: 'assistant', content: `⚠️ ${e instanceof Error && e.message ? e.message : 'No pude responder.'}` }]);
    } finally {
      setBusy(false);
      box.current?.focus();
    }
  };

  const cited = (m: Msg) => (m.sources ?? []).filter((s) => m.content.includes(`[${s.title}`));

  return (
    <div className="ai">
      <div className="ai-bar">
        {fixedClient ? <span className="muted small">{mode === 'client' ? 'Conoce tu Segundo cerebro, tu roadmap y tus tareas' : 'Con el contexto de este cliente'}</span> : (
          <label className="row" style={{ gap: 8 }}>
            <span className="muted small">Contexto</span>
            <select className="select" value={client} onChange={(e) => setClient(e.target.value)} disabled={busy}>
              <option value="">Solo la bóveda de Fractal</option>
              {clients.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
        )}
        {msgs.length > 0 && <button className="btn ghost sm" onClick={() => setMsgs([])} disabled={busy}>Nueva conversación</button>}
      </div>

      <div className="ai-log">
        {!msgs.length && (
          <div className="ai-empty">
            <h2>¿En qué te ayudo?</h2>
            <p className="muted">{intro ?? `Respondo con la bóveda de Fractal (SOPs, setting, closing, ofertas)${client ? ' y el Segundo cerebro del cliente elegido' : ''}, y te digo de qué documento sale cada cosa.`}</p>
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.role === 'user' ? <p>{m.content}</p> : m.content ? (
              <>
                <div className="ai-md" dangerouslySetInnerHTML={{ __html: marked.parse(m.content, { async: false }) as string }} />
                {!busy || i < msgs.length - 1 ? (cited(m).length ? cited(m) : m.sources ?? []).length > 0 && (
                  <div className="ai-sources">
                    <span className="muted small">{cited(m).length ? 'Fuentes' : 'Documentos consultados'}</span>
                    {(cited(m).length ? cited(m) : m.sources ?? []).map((s) => (
                      <Link key={s.id} href={`/panel/laboratorio/kb/${s.id}`} className="tag" target="_blank">{s.title}</Link>
                    ))}
                  </div>
                ) : null}
              </>
            ) : <p className="muted ai-typing">{mode === 'client' ? 'Pensando…' : 'Buscando en la bóveda…'}</p>}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <textarea
          ref={box}
          className="textarea"
          rows={2}
          placeholder="Preguntá algo o pedí un entregable…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>{busy ? 'Pensando…' : 'Enviar'}</button>
      </form>
    </div>
  );
}
