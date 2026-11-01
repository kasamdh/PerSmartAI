import type { Metadata } from 'next';

import { LegalPage, readLegalDoc } from '@/features/legal/legal-page';

export const dynamic = 'force-static';
export const metadata: Metadata = { title: 'Delete your account · Pet Sitter' };

export default function Page() {
  return <LegalPage blocks={readLegalDoc('account-deletion')} />;
}
