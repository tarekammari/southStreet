'use client';

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { DEFAULT_BRAND, type Brand } from '@/lib/brand';

/**
 * The agency's brand + contact card + social links for client components.
 * The root layout reads it on the server (lib/brand-server.ts) and hands it
 * down here, so the name and logo are right on the first paint.
 */
export type AgencyInfo = Brand;

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return createElement(BrandContext.Provider, { value: brand }, children);
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}

/** Same as useBrand(); kept for the components that read contact details. */
export function useAgencyInfo(): AgencyInfo {
  return useContext(BrandContext);
}
