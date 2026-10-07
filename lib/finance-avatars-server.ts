import { getSqliteDb } from '@/lib/sqlite';
import { isImageSource, resolveUserPhoto } from '@/lib/user-access-view';
import { resolveClientAvatarFromIndex } from '@/lib/entity-avatar-display';

/** First hotel gallery image when supplier name matches a hotel record. */
export function inferSupplierImageFromHotels(nameAr: string): string {
  const name = String(nameAr || '').trim();
  if (!name) return '';
  try {
    const db = getSqliteDb();
    const hotels = db.prepare('SELECT name_ar, images FROM hotels').all() as {
      name_ar?: string;
      images?: string;
    }[];
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const target = norm(name);
    for (const h of hotels) {
      const hn = norm(String(h.name_ar || ''));
      if (!hn) continue;
      if (target.includes(hn) || hn.includes(target.slice(0, 12))) {
        try {
          const imgs = JSON.parse(String(h.images || '[]')) as string[];
          const url = imgs.find((u) => isImageSource(u));
          if (url) return String(url).trim();
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

let clientAvatarCache: Record<string, string> | null = null;

export function buildClientAvatarIndex(): Record<string, string> {
  if (clientAvatarCache) return clientAvatarCache;
  const index: Record<string, string> = {};
  try {
    const db = getSqliteDb();
    const users = db.prepare('SELECT id, username, name, avatar FROM users').all() as {
      id?: string;
      username?: string;
      name?: string;
      avatar?: string;
    }[];
    for (const u of users) {
      const photo = resolveUserPhoto(u.avatar);
      if (!photo) continue;
      const keys = [u.id, u.username, u.name].filter(Boolean).map((k) => String(k).trim());
      for (const k of keys) {
        index[k] = photo;
        index[k.toUpperCase()] = photo;
      }
    }
  } catch {
    /* ignore */
  }
  clientAvatarCache = index;
  return index;
}

export function resolveClientAvatar(code?: string | null, name?: string | null): string {
  return resolveClientAvatarFromIndex(buildClientAvatarIndex(), code, name);
}

export function resolveSupplierImageUrlServer(row: {
  image_url?: string | null;
  name_ar?: string;
  category?: string | null;
}): string {
  const explicit = String(row.image_url || '').trim();
  if (isImageSource(explicit)) return explicit;
  return inferSupplierImageFromHotels(String(row.name_ar || ''));
}
