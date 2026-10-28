import { signOut } from '@/lib/actions';
import { Mark } from '@/components/Mark';

export default function NoAccess() {
  return (
    <main className="auth">
      <div className="panel auth-card stack" style={{ gap: 16 }}>
        <Mark />
        <h1 className="serif" style={{ fontSize: 26 }}>Tu cuenta todavía no tiene un espacio asignado</h1>
        <p className="muted">Avisale a tu contacto en Fractal con qué email ingresaste y te damos acceso.</p>
        <form action={signOut}>
          <button className="btn">Salir</button>
        </form>
      </div>
    </main>
  );
}
