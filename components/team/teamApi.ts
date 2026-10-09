import { authHeaders } from '@/lib/api-client';
import { adminFetch, keyErrorMessage } from '@/lib/webauthn-client';
import type { Member, Viewer } from './teamModel';

/**
 * Calls behind the Team workspace. Writes go through adminFetch, so an action
 * that needs a fresh security-key tap (428) asks for it and retries once.
 */

export type ApiResult<T = any> = { ok: true; data: T } | { ok: false; error: string; status?: number };

async function send<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const { json, ...rest } = init;
    const res = await adminFetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers as Record<string, string>) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || 'تعذّر تنفيذ العملية', status: res.status };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: keyErrorMessage(err) };
  }
}

export async function loadTeam(): Promise<ApiResult<{ members: Member[]; viewer: Viewer }>> {
  try {
    const res = await fetch('/api/admin/users', { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || 'تعذّر تحميل الفريق', status: res.status };
    return {
      ok: true,
      data: {
        members: (data.users || []) as Member[],
        viewer: { id: data.viewer?.id, role: data.viewer?.role, assignableRoles: data.viewer?.assignableRoles || [] },
      },
    };
  } catch {
    return { ok: false, error: 'تعذّر الاتصال بالخادم' };
  }
}

export const patchAccount = (userId: string, body: Record<string, unknown>) =>
  send<{ message?: string; invite?: { url: string; expiresInMinutes: number } }>('/api/admin/users', {
    method: 'PATCH',
    json: { userId, ...body },
  });

export const createAccount = (body: Record<string, unknown>) =>
  send<{
    message?: string;
    user?: Member;
    credentials?: { username: string; password?: string; qrPayload?: string };
    invite?: { url: string; expiresInMinutes: number };
  }>('/api/admin/users', { method: 'POST', json: body });

export const deleteAccount = (userId: string) =>
  send<{ message?: string }>(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const createStaff = (body: Record<string, unknown>) =>
  send<{ morshid_id: string; message?: string; credentials?: { username: string; password?: string; qrPayload?: string } }>(
    '/api/admin/morshids',
    { method: 'POST', json: body }
  );

export const patchStaff = (staffId: string, body: Record<string, unknown>) =>
  send<{ message?: string }>('/api/admin/morshids', { method: 'PATCH', json: { morshid_id: staffId, ...body } });

export const deleteStaff = (staffId: string) =>
  send<{ message?: string }>(`/api/admin/morshids?id=${encodeURIComponent(staffId)}`, { method: 'DELETE' });

export const issueCredentials = (userId: string, action: 'rotate-password' | 'rotate-qr') =>
  send<{ message?: string; password?: string; qrImage?: string; account?: { username?: string } }>('/api/admin/credentials', {
    method: 'POST',
    json: { userId, action },
  });

export type Activity = {
  devices: { id: string; ip: string; device: string; lastSeen: string; active: boolean }[];
  events: { id: string; at: string; title: string; detail: string; ip?: string }[];
};

export async function loadActivity(userId: string): Promise<ApiResult<Activity>> {
  try {
    const res = await fetch(`/api/admin/users?activityFor=${encodeURIComponent(userId)}`, { headers: authHeaders(), cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || 'تعذّر تحميل النشاط' };
    return { ok: true, data: { devices: data.devices || [], events: data.events || [] } };
  } catch {
    return { ok: false, error: 'تعذّر تحميل النشاط' };
  }
}

export async function uploadPhoto(file: File): Promise<ApiResult<{ url: string }>> {
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/upload-image', { method: 'POST', headers: authHeaders(), body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) return { ok: false, error: data?.error || 'تعذّر رفع الصورة' };
    return { ok: true, data: { url: data.url } };
  } catch {
    return { ok: false, error: 'تعذّر رفع الصورة' };
  }
}
