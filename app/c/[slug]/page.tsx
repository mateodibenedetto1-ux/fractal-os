import Link from 'next/link';
import { getActions, getCalls, getDocs, getMilestones, getOrgBySlug, getResources, requireViewer } from '@/lib/data';
import { computeRoadmap } from '@/lib/roadmap';
import { RoadmapProgress } from '@/components/Roadmap';
import { fmtDate } from '@/lib/format';
import { Cells } from '@/components/Cells';
import { Icon } from '@/components/Icon';

export default async function PortalHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  const [v, actions, calls, resources, docs, milestones] = await Promise.all([
    requireViewer(), getActions(org.id), getCalls(org.id), getResources(org.id), getDocs(org.id), getMilestones(org.id),
  ]);
  const roadmap = computeRoadmap(milestones, org.start_date);
  const tops = actions.filter((a) => !a.parent_id);
  const pending = tops.filter((a) => !a.done);
  const pendingCalls = new Set(pending.map((a) => a.call_id).filter(Boolean)).size;
  const last = calls[0];
  const name = org.contact_name || (v.isStaff ? org.name : v.name);
  const base = `/c/${org.slug}`;

  const links = [
    org.program_url && { href: org.program_url, icon: 'book', title: 'Programa', text: 'Tus módulos y clases.' },
    org.drive_url && { href: org.drive_url, icon: 'folder', title: 'Drive', text: 'Tu carpeta con fuentes de información.' },
    org.tracker_url && { href: org.tracker_url, icon: 'sheet', title: 'Tracker de métricas', text: 'Tus números de cada semana.' },
  ].filter(Boolean) as { href: string; icon: string; title: string; text: string }[];

  return (
    <>
      <section className="hello">
        <h1>Bienvenido de vuelta, {name}</h1>
        <p>
          {last
            ? `Tu última llamada fue el ${fmtDate(last.held_at)}. Acá tenés lo que quedó pendiente y todo lo que te compartimos.`
            : 'Acá vas a encontrar lo que tenés que hacer después de cada llamada y todo lo que te compartimos.'}
        </p>
      </section>

      {roadmap.totalWeeks > 0 && (
        <Link href={`${base}/roadmap`} className="panel panel-pad" style={{ display: 'block', marginTop: 32, textDecoration: 'none' }}>
          <RoadmapProgress view={roadmap} compact />
        </Link>
      )}

      <Link href={`${base}/accionables`} className="panel next-card" style={{ textDecoration: 'none', marginTop: roadmap.totalWeeks > 0 ? 12 : 32 }}>
        <div className="stack" style={{ gap: 12 }}>
          <b style={{ fontWeight: 600 }}>Próximos accionables</b>
          <span className="muted">
            {pending.length
              ? `Te ${pending.length === 1 ? 'queda 1 accionable pendiente' : `quedan ${pending.length} accionables pendientes`}${pendingCalls ? ` de ${pendingCalls} ${pendingCalls === 1 ? 'llamada' : 'llamadas'}` : ''}.`
              : 'Tenés todo al día.'}
          </span>
          <Cells done={tops.length - pending.length} total={tops.length} size="lg" />
        </div>
        <span className="big" aria-hidden="true">{pending.length}</span>
      </Link>

      {pending.length > 0 && (
        <ul className="list panel" style={{ marginTop: 12 }}>
          {pending.slice(0, 3).map((a) => (
            <li key={a.id} className="list-row">
              <span className="cell" style={{ background: 'var(--brand)', opacity: 0.35 }} />
              <span className="grow">{a.title}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="links-grid" style={{ marginTop: 28 }}>
        <Link href={`${base}/recursos`} className="panel link-card">
          <Icon name="doc" />
          <b>Recursos y SOPs</b>
          <span className="muted small">{resources.length} documentos, hojas y carpetas en un solo lugar.</span>
        </Link>
        <Link href={`${base}/biblioteca`} className="panel link-card">
          <Icon name="book" />
          <b>Biblioteca</b>
          <span className="muted small">{docs.length} resúmenes y documentos de tus llamadas.</span>
        </Link>
        {links.map((l) => (
          <a key={l.title} href={l.href} target="_blank" rel="noopener noreferrer" className="panel link-card">
            <Icon name={l.icon} />
            <b>{l.title}</b>
            <span className="muted small">{l.text}</span>
          </a>
        ))}
      </div>
    </>
  );
}
