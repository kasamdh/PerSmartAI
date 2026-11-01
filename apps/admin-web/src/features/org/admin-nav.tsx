'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { signOut } from '@/app/actions';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/requests', label: 'Booking requests' },
  { href: '/clients', label: 'Clients & pets' },
  { href: '/sitters', label: 'Sitters' },
  { href: '/settings', label: 'Settings' },
] as const;

export function AdminNav({
  orgName,
  logoUrl,
  adminName,
}: {
  orgName: string;
  logoUrl: string | null;
  adminName: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="border-b border-gray-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 p-4">
        {logoUrl ? (
          // Signed storage URL; next/image would need the Supabase host configured.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg object-contain" />
        ) : (
          <div className="bg-brand text-on-brand flex h-10 w-10 items-center justify-center rounded-lg font-bold">
            {orgName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{orgName}</div>
          <div className="truncate text-xs text-gray-500">{adminName}</div>
        </div>
      </div>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:pb-0">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(link.href) ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
              isActive(link.href) ? 'bg-brand text-on-brand' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="hidden p-4 lg:block">
        <button type="submit" className="text-sm text-gray-600 underline hover:text-gray-900">
          Sign out
        </button>
      </form>
    </aside>
  );
}
