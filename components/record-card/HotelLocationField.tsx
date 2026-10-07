'use client';

import React, { useState } from 'react';
import GoogleMapPinLink, { hasMapPoint } from '@/components/hotels/GoogleMapPinLink';
import { jsonAuthHeaders } from '@/lib/api-client';
import { isShortMapsLink, parseGoogleMapsLink } from '@/lib/google-maps-link';

export default function HotelLocationField({
  latitude,
  longitude,
  readOnly,
  onChange,
}: {
  latitude: string;
  longitude: string;
  city?: string;
  readOnly?: boolean;
  onChange?: (latitude: string, longitude: string) => void;
}) {
  const pinned = hasMapPoint(latitude, longitude);
  const [link, setLink] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);

  const applyPoint = (lat: number, lng: number, name: string) => {
    onChange?.(String(lat), String(lng));
    setHint(name ? `تم تحديد الموقع: ${name}` : 'تم تحديد الموقع من الرابط.');
  };

  const applyLink = async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const direct = parseGoogleMapsLink(text);
    if (direct) {
      applyPoint(direct.latitude, direct.longitude, direct.name);
      return;
    }
    if (!isShortMapsLink(text) && !/^https?:\/\//i.test(text)) {
      setHint('الصق رابط المكان من خرائط جوجل.');
      return;
    }
    setBusy(true);
    setHint('');
    try {
      const res = await fetch('/api/admin/maps-link', {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ url: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.point) {
        setHint(data.error || 'تعذر قراءة الموقع من الرابط.');
        return;
      }
      applyPoint(Number(data.point.latitude), Number(data.point.longitude), String(data.point.name || ''));
    } catch {
      setHint('تعذر قراءة الرابط.');
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    if (!pinned) return null;
    return (
      <div className="hotel-location is-view">
        <span>الموقع</span>
        <GoogleMapPinLink latitude={Number(latitude)} longitude={Number(longitude)} />
      </div>
    );
  }

  return (
    <section className="hotel-location">
      <div className="hotel-location-head">
        <h4>الموقع</h4>
        {pinned ? <GoogleMapPinLink latitude={Number(latitude)} longitude={Number(longitude)} /> : null}
      </div>
      <label className="hotel-location-link">
        <span>رابط خرائط جوجل</span>
        <input
          type="url"
          value={link}
          onChange={(e) => {
            const next = e.target.value;
            setLink(next);
            if (parseGoogleMapsLink(next)) void applyLink(next);
          }}
          onBlur={() => {
            if (link.trim()) void applyLink(link);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void applyLink(link);
            }
          }}
          placeholder="https://www.google.com/maps/place/..."
          className="luxury-form-input"
          dir="ltr"
          disabled={busy}
        />
      </label>
      {hint ? <p className={`hotel-location-note${hint.startsWith('تم') ? ' is-ok' : ''}`}>{busy ? '…' : hint}</p> : null}
    </section>
  );
}
