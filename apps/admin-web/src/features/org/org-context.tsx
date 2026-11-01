'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type Org = {
  id: string;
  name: string;
  timeZone: string;
  travelBufferMinutes: number;
  cancellationCutoffHours: number;
  mediaRetentionMonths: number | null;
  primaryColor: string | null;
  accentColor: string | null;
  logoPath: string | null;
  /** Signed URL (1 hour) of the logo, made on the server. */
  logoUrl: string | null;
};

export type Admin = { id: string; fullName: string };

const OrgContext = createContext<{ org: Org; admin: Admin } | null>(null);

/** Filled from the admin layout (server), which already loaded the business. */
export function OrgProvider({
  org,
  admin,
  children,
}: {
  org: Org;
  admin: Admin;
  children: ReactNode;
}) {
  return <OrgContext.Provider value={{ org, admin }}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const value = useContext(OrgContext);
  if (!value) throw new Error('useOrg must be used inside the admin layout');
  return value;
}
