import { redirect } from 'next/navigation';
import { getMyClientOrg, requireViewer } from '@/lib/data';

export default async function Home() {
  const v = await requireViewer();
  if (v.isStaff) redirect('/panel');
  const org = await getMyClientOrg(v);
  if (org) redirect(`/c/${org.slug}`);
  redirect('/sin-acceso');
}
