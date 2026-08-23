/**
 * Fetches a JSON array, retrying once. In dev the request that triggers a route's
 * first compile can return 500, which otherwise leaves a section looking empty.
 */
export async function fetchJsonList<T>(url: string): Promise<T[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data as T[];
      }
    } catch {
      // fall through to the retry
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return [];
}
