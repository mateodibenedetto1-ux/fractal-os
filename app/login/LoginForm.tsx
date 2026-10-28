'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = supabaseBrowser();
  const callback = () => `${window.location.origin}/auth/callback`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === 'password') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg({ tone: 'error', text: 'El email o la contraseña no coinciden. Probá de nuevo o pedí un link de acceso.' });
      else router.replace('/');
    } else {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback(), shouldCreateUser: false } });
      if (error) setMsg({ tone: 'error', text: 'No encontramos una cuenta con ese email. Pedile acceso a tu contacto en Fractal.' });
      else setMsg({ tone: 'ok', text: 'Te enviamos un link de acceso. Revisá tu email.' });
    }
    setBusy(false);
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <button
        className="btn"
        type="button"
        onClick={() => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })}
      >
        Continuar con Google
      </button>
      <div className="row muted small" style={{ gap: 12 }}>
        <span className="grow" style={{ borderTop: '1px solid var(--line)' }} />o<span className="grow" style={{ borderTop: '1px solid var(--line)' }} />
      </div>
      <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
        <label className="field">
          Email
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode === 'password' && (
          <label className="field">
            Contraseña
            <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button className="btn primary" disabled={busy}>
          {mode === 'password' ? 'Ingresar' : 'Enviarme un link'}
        </button>
      </form>
      <button className="btn ghost sm" type="button" onClick={() => setMode(mode === 'password' ? 'link' : 'password')}>
        {mode === 'password' ? 'Prefiero recibir un link por email' : 'Ingresar con contraseña'}
      </button>
      {msg && (
        <p role="status" className="small" style={{ color: msg.tone === 'error' ? 'var(--brand)' : 'var(--ok)' }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
