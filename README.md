# Fractal OS

Centro operativo de Fractal y portal de clientes. Una cuenta principal (Fractal) administra subcuentas (clientes), cada una con su propio portal.

**Panel Fractal** (`/panel`): Home, Clientes, Tareas, Reuniones, Integraciones y Ajustes. Calendario, Objetivos y Laboratorios quedan marcados como próximos.
Dentro de cada cliente: Resumen, Accionables, Llamadas, Recursos, Biblioteca, Roadmap y Accesos.

**Portal del cliente** (`/c/<cliente>`): Inicio, Accionables, Recursos, Biblioteca y Roadmap. El cliente solo ve lo suyo y solo puede marcar accionables como hechos.

**Fathom**: cuando termina una llamada, Fathom avisa a la app. Si alguno de los invitados coincide con los dominios o emails del cliente, la llamada se asigna sola y se generan:
- los accionables (con el porqué de cada uno), agrupados por llamada,
- un resumen en la Biblioteca,
- los links compartidos en Recursos.

Si no reconoce al cliente, la llamada queda en Reuniones → Sin asignar. Al asignarla podés marcar "Recordar este email" para que la próxima vez sea automático.

Sin `ANTHROPIC_API_KEY` se usan el resumen y los action items que manda Fathom (vienen en inglés). Con la clave, Claude los escribe en español y con más criterio.

---

## Ver la demo

Sin variables de entorno la app corre en modo demo con datos de ejemplo:

```bash
npm install
npm run dev
# http://localhost:3000/panel  y  http://localhost:3000/c/estudio-norte
```

## Ponerlo en producción (unos 20 minutos)

### 1. Supabase
1. Creá un proyecto en [supabase.com](https://supabase.com) (plan gratis).
2. SQL Editor → pegá `supabase/schema.sql` → Run.
3. Authentication → URL Configuration: en **Site URL** poné la URL de Vercel y en **Redirect URLs** agregá `https://TU-APP.vercel.app/**`.
4. (Opcional) Authentication → Providers → Google, si querés el botón "Continuar con Google".
5. Project Settings → API: copiá `URL`, `anon key` y `service_role key`.

### 2. GitHub + Vercel
1. Subí esta carpeta a un repo nuevo en GitHub.
2. En [vercel.com](https://vercel.com) → Add New Project → elegí el repo.
3. Environment Variables (las de `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://TU-APP.vercel.app`
   - `ANTHROPIC_API_KEY` (opcional, recomendado)
4. Deploy.

### 3. Tu usuario
1. En Supabase → Authentication → Users → Add user (tu email y contraseña).
2. SQL Editor, corré (con tu email):
   ```sql
   insert into memberships (user_id, org_id, role)
   select u.id, o.id, 'owner' from auth.users u, organizations o
   where u.email = 'TU_EMAIL' and o.slug = 'fractal';
   ```
3. Entrá a `/login`. Desde Ajustes podés invitar al resto del equipo.

### 4. Fathom
1. Panel → Integraciones → Crear conexión (una por cada persona que graba).
2. En Fathom: Settings → API Access → Manage → Add Webhook. Pegá la URL de la conexión, incluí transcript, summary y action items, y elegí "My recordings".
3. Copiá el secreto `whsec_…` que te da Fathom y guardalo en la conexión.
4. En cada cliente, completá "Dominios o emails para Fathom" (por ejemplo `brainzeed.com` o el Gmail del cliente).

La API y los webhooks de Fathom están incluidos en todos sus planes.

### 5. Importar desde Notion (una vez)
1. Creá una integración interna en notion.so/profile/integrations y copiá el token.
2. En Notion abrí **Wiki Clients** → ••• → Conexiones → agregá la integración.
3. En `.env.local` completá `NOTION_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
4. `npm run import:notion` (o `npm run import:notion brainzeed` para uno solo).

Trae por cliente: datos de la base Clientes, el Command Center de tareas como accionables, el Roadmap (llamadas e hitos) y la Biblioteca como documentos. Se puede volver a correr sin duplicar.

### 6. Invitar a un cliente
Cliente → Accesos → Enviar invitación. Le llega un email, crea su contraseña y entra directo a su portal.

---

## Estructura

```
app/panel/…            Panel de Fractal (staff)
app/c/[slug]/…         Portal del cliente
app/api/webhooks/fathom/[connectionId]   Recibe llamadas de Fathom
lib/process.ts         Llamada → accionables + resumen + recursos (Claude o Fathom)
lib/actions.ts         Todas las acciones de formularios
lib/data.ts            Lectura de datos (con modo demo)
supabase/schema.sql    Tablas y permisos (RLS)
scripts/import-notion.ts
```

Permisos: el equipo de Fractal (miembros de la cuenta principal) ve y edita todo. Un cliente solo lee su subcuenta y solo puede cambiar el estado de sus accionables; lo garantiza la base de datos, no solo la interfaz.
