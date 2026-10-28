import { DEMO } from '@/lib/env';
import { LoginForm } from './LoginForm';
import { Mark } from '@/components/Mark';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Ingresar' };

export default function Login() {
  if (DEMO) redirect('/panel');
  return (
    <main className="auth">
      <div className="panel auth-card">
        <Mark />
        <p className="muted" style={{ margin: '10px 0 26px' }}>Tu espacio de trabajo con Fractal.</p>
        <LoginForm />
        <p className="muted small" style={{ marginTop: 28 }}>© {new Date().getFullYear()} Fractal</p>
      </div>
    </main>
  );
}
