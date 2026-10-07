export type GoogleMapPoint = {
  latitude: number;
  longitude: number;
  name: string;
};

const PLACE_PIN = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g;
const CAMERA = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const QUERY = /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i;

function finitePoint(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01);
}

function placeName(text: string) {
  const place = text.match(/\/place\/([^/@?#]+)/);
  if (!place) return '';
  try {
    return decodeURIComponent(place[1]).replace(/\+/g, ' ').replace(/-/g, ' ').trim();
  } catch {
    return place[1].replace(/\+/g, ' ').trim();
  }
}

/** Reads the place pin from a Google Maps URL. Prefers the !3d/!4d place point over the map camera. */
export function parseGoogleMapsLink(raw: string): GoogleMapPoint | null {
  const text = raw.trim();
  if (!text) return null;
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    decoded = text;
  }

  const pins = [...decoded.matchAll(PLACE_PIN)];
  if (!pins.length) {
    const encodedPins = [...text.matchAll(PLACE_PIN)];
    pins.push(...encodedPins);
  }

  let lat: number | null = null;
  let lng: number | null = null;
  if (pins.length) {
    const last = pins[pins.length - 1];
    lat = Number(last[1]);
    lng = Number(last[2]);
  } else {
    const hit = decoded.match(CAMERA) || text.match(CAMERA) || decoded.match(QUERY) || text.match(QUERY);
    if (hit) {
      lat = Number(hit[1]);
      lng = Number(hit[2]);
    }
  }

  if (lat == null || lng == null || !finitePoint(lat, lng)) return null;
  return { latitude: lat, longitude: lng, name: placeName(decoded) || placeName(text) };
}

export function isShortMapsLink(raw: string) {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'g.co';
  } catch {
    return false;
  }
}

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'google.com',
  'maps.google.com',
]);

export function isAllowedMapsUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (ALLOWED_HOSTS.has(host)) {
    if (host === 'goo.gl') return url.pathname.startsWith('/maps');
    if (host === 'google.com' || host === 'maps.google.com') return url.pathname.startsWith('/maps');
    return true;
  }
  if (host.endsWith('.google.com') || host.endsWith('.google.com.sa') || host.endsWith('.google.dz')) {
    return url.pathname.startsWith('/maps');
  }
  return false;
}
