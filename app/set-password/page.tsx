'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Mark } from '@/components/Mark';

export default function SetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    if (error) setError('La contraseña necesita al menos 8 caracteres.');
    else router.replace('/');
  }
  return (
    <main className="auth">
      <form className="panel auth-card stack" style={{ gap: 16 }} onSubmit={save}>
        <Mark />
        <h1 className="serif" style={{ fontSize: 26 }}>Bienvenido a Fractal</h1>
        <p className="muted">Elegí una contraseña para entrar a tu espacio cuando quieras.</p>
        <label className="field">
          Contraseña nueva
          <input className="input" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary">Guardar y entrar</button>
        {error && <p className="small" style={{ color: 'var(--brand)' }}>{error}</p>}
      </form>
    </main>
  );
}
