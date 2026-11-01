import { ClientProfile } from '@/features/clients/client-profile';

export default async function ClientPage({ params }: PageProps<'/clients/[id]'>) {
  const { id } = await params;
  return <ClientProfile householdId={id} />;
}
