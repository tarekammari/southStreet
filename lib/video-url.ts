/** Turns a YouTube, Vimeo, or TikTok page link into an embeddable player URL. */
export function videoEmbedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const watch = url.searchParams.get('v');
    if (watch) return `https://www.youtube.com/embed/${watch}`;
    const nested = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/);
    return nested ? `https://www.youtube.com/embed/${nested[1]}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean).pop();
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host.endsWith('tiktok.com')) {
    const id = url.pathname.match(/\/video\/(\d+)/);
    return id ? `https://www.tiktok.com/embed/v2/${id[1]}` : null;
  }
  return null;
}

export function normalizeVideoLink(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url.toString();
}
