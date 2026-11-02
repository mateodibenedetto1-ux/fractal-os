'use client';

import { useState, useTransition } from 'react';
import { connectAiKey, disconnectAiKey } from '@/lib/actions';

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Creá tu cuenta en Anthropic',
    body: <>Entrá a <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a> y registrate con tu email (o iniciá sesión si ya tenés cuenta). Anthropic es la empresa detrás de Claude, el modelo que usa Fractal IA.</>,
  },
  {
    title: 'Cargá créditos',
    body: <>En <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer">Settings → Billing</a> agregá una tarjeta y cargá saldo. Con 5 a 10 USD alcanza para empezar. Cada conversación descuenta de ese saldo, y en Settings → Limits podés poner un tope de gasto mensual.</>,
  },
  {
    title: 'Creá una API key',
    body: <>Andá a <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Settings → API Keys</a>, tocá <b>Create Key</b> y ponele de nombre &ldquo;Fractal IA&rdquo;.</>,
  },
  {
    title: 'Copiala y pegala acá abajo',
    body: <>La key empieza con <code>sk-ant-</code> y Anthropic la muestra una sola vez, así que copiala completa antes de cerrar la ventana.</>,
  },
];

export function AiKeyConnect({ orgId, connected, hint, compact }: { orgId: string; connected: boolean; hint: string | null; compact?: boolean }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(!compact);
  const [pending, start] = useTransition();

  if (connected) {
    return (
      <div className="ai-key-ok">
        <span className="dot ok" aria-hidden="true" />
        <span className="small">API key de Anthropic conectada <span className="muted">(termina en {hint ?? '····'})</span></span>
        <button
          className="btn ghost sm"
          disabled={pending}
          onClick={() => { if (confirm('¿Desconectar la API key? Fractal IA va a dejar de funcionar hasta que conectes otra.')) start(() => disconnectAiKey(orgId)); }}
        >
          {pending ? 'Desconectando…' : 'Desconectar'}
        </button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await connectAiKey(orgId, key);
      if (!r.ok) setError(r.error ?? 'No se pudo conectar.');
      else setKey('');
    });
  };

  return (
    <div className="panel panel-pad ai-connect">
      <div className="row between">
        <div>
          <h2>Conectá tu IA</h2>
          <p className="muted">Fractal IA funciona con tu propia cuenta de Anthropic: vos controlás el gasto y tus conversaciones quedan a tu nombre. Se configura una sola vez y lleva unos 5 minutos.</p>
        </div>
        {compact && <button className="btn sm" onClick={() => setOpen(!open)}>{open ? 'Ocultar' : 'Ver cómo'}</button>}
      </div>

      {open && (
        <>
          <ol className="ai-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="ai-step-n">{i + 1}</span>
                <div><b>{s.title}</b><p className="muted small">{s.body}</p></div>
              </li>
            ))}
          </ol>

          <form className="ai-key-form" onSubmit={submit}>
            <input
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-ant-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              aria-label="API key de Anthropic"
            />
            <button className="btn primary" disabled={pending || key.trim().length < 20}>{pending ? 'Verificando…' : 'Conectar'}</button>
          </form>
          {error && <p className="small" style={{ color: 'var(--warn)', marginTop: 8 }}>{error}</p>}
          <p className="muted small" style={{ marginTop: 10 }}>
            Tu key se guarda cifrada y solo se usa para tus conversaciones con Fractal IA. Nadie del equipo la puede ver. Podés desconectarla acá o revocarla desde Anthropic cuando quieras.
          </p>
        </>
      )}
    </div>
  );
}
