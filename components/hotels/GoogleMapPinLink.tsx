'use client';

export function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=16&hl=ar`;
}

export function hasMapPoint(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.01 && Math.abs(lng) > 0.01;
}

export default function GoogleMapPinLink({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  return (
    <a
      href={googleMapsUrl(latitude, longitude)}
      target="_blank"
      rel="noreferrer"
      className="hotel-gmap-pin"
      aria-label="فتح الموقع في خرائط جوجل"
      title="فتح في خرائط جوجل"
    >
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
        <path fill="#EA4335" d="M24 4C15.2 4 8 11.1 8 19.8 8 31.2 22.2 43.2 23.2 44.1c.4.4 1.1.4 1.6 0C25.8 43.2 40 31.2 40 19.8 40 11.1 32.8 4 24 4z" />
        <path fill="#FBBC04" d="M24 4c-4.6 0-8.8 2-11.7 5.2 2.6-1.6 5.6-2.5 8.8-2.5 8.8 0 16 7.1 16 15.8 0 4.2-2.2 9.4-5.6 14.4C36.6 31.6 40 25.2 40 19.8 40 11.1 32.8 4 24 4z" />
        <path fill="#34A853" d="M12.3 9.2C9.6 12 8 15.7 8 19.8c0 6.6 4.8 14.2 11.4 20.6-4.8-6.8-8.6-13.6-8.6-20.6 0-3.2 1-6.2 2.7-8.8-.4-.6-.8-1.2-1.2-1.8z" />
        <circle fill="#fff" cx="24" cy="19.5" r="7.2" />
        <circle fill="#4285F4" cx="24" cy="19.5" r="4.2" />
      </svg>
    </a>
  );
}
