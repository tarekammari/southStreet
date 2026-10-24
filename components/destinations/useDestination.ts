'use client';

import { useEffect, useState } from 'react';
import type { Package } from '@/types';
import { publicList } from '@/lib/public-catalog';
import { parseTripDate } from '@/lib/booking-catalog';
import { isBookable, programAvailability } from '@/lib/program-display';
import { isTourism, tourOf } from '@/lib/tour';
import { encodeRooms, type HotelOffer } from '@/lib/hotels/types';

/** Prices on the destination pages are for one double room. */
export const STAY_ROOMS = [{ adults: 2, children: 0, childAges: [] as number[] }];

/** The destination's tourist trips still on sale, bookable first, then by date. */
export function useDestinationTrips(destId: string) {
  const [trips, setTrips] = useState<Package[] | null>(null);
  useEffect(() => {
    let live = true;
    publicList<Package>('packages')
      .then((data) => {
        if (!live) return;
        setTrips(
          (Array.isArray(data) ? data : [])
            .filter((p) => isTourism(p) && programAvailability(p) !== 'expired' && tourOf(p).country === destId)
            .sort((a, b) => {
              const ba = isBookable(programAvailability(a)) ? 0 : 1;
              const bb = isBookable(programAvailability(b)) ? 0 : 1;
              if (ba !== bb) return ba - bb;
              return (parseTripDate(a.start_date)?.getTime() ?? Infinity) - (parseTripDate(b.start_date)?.getTime() ?? Infinity);
            })
        );
      })
      .catch(() => live && setTrips([]));
    return () => {
      live = false;
    };
  }, [destId]);
  return trips;
}

/** The agency's bookable hotels in a destination for the given stay. */
export function useDestinationHotels(destId: string, dates: { checkIn: string; checkOut: string }) {
  const [hotels, setHotels] = useState<HotelOffer[] | null>(null);
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ dest: destId, checkIn: dates.checkIn, checkOut: dates.checkOut, rooms: encodeRooms(STAY_ROOMS) });
    fetch(`/api/hotels/search?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { hotels: [] }))
      .then((d: { hotels?: HotelOffer[] }) => live && setHotels((d.hotels || []).filter((h) => h.supplier === 'own')))
      .catch(() => live && setHotels([]));
    return () => {
      live = false;
    };
  }, [destId, dates.checkIn, dates.checkOut]);
  return hotels;
}

export const perNight = (h: HotelOffer) => h.total_from / Math.max(1, h.nights);
/** «فندق واحد» / «فندقان» / «5 فنادق» / «12 فندقاً». */
export const hotelsCount = (n: number) => (n === 1 ? 'فندق واحد' : n === 2 ? 'فندقان' : `${n} ${n <= 10 ? 'فنادق' : 'فندقاً'}`);
