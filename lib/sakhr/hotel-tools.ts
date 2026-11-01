/**
 * Sakhr's hotel & trip tools. Like every Sakhr tool they run through the
 * app's own API handlers with the user's credentials, so search shows what
 * that user may see (staff also see the test supplier), and a booking is a
 * confirmation card the user approves, then follows the usual path
 * (agency accepts → accountant deposit with the approval rules).
 */
import { callRoute } from '@/lib/sakhr/route-call';
import { GET as hotelSearchGET } from '@/app/api/hotels/search/route';
import { GET as hotelDetailGET } from '@/app/api/hotels/[id]/route';
import { GET as hotelDestinationsGET } from '@/app/api/hotels/destinations/route';
import { POST as hotelBookPOST } from '@/app/api/hotels/book/route';
import { GET as hotelBookingsGET } from '@/app/api/admin/hotel-bookings/route';
import { POST as tripDetailsPOST } from '@/app/api/bookings/trip-details/route';
import { BOARD_LABEL, encodeRooms, type BoardType, type GuestRoom } from '@/lib/hotels/types';
import { VISA_LABEL, VISA_STATUSES, type VisaStatus } from '@/lib/visa';
import type { SakhrTool, ToolResult, Who } from '@/lib/sakhr/tools';

const EVERYONE: Who[] = ['ANON', 'PILGRIM_USER', 'AGENCY_AGENT', 'GUIDE_MURSHID', 'ACCOUNTANT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];
const SIGNED_IN: Who[] = EVERYONE.filter((r) => r !== 'ANON');
const STAFF: Who[] = ['AGENCY_AGENT', 'ACCOUNTANT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];
const VISA_STAFF: Who[] = ['AGENCY_AGENT', 'AGENCY_MANAGER', 'SUPER_ADMIN'];

const money = (n: unknown) => `${Math.round(Number(n) || 0).toLocaleString('ar-DZ')} دج`;
const fail = (res: { status: number; data: any }): ToolResult => ({ ok: false, status: res.status, error: String(res.data?.error || 'تعذّر تنفيذ الطلب') });

/** One room per entry: [{adults, children, child_ages}] — default 1 room × 2 adults. */
function roomsArg(a: any): GuestRoom[] {
  const list = Array.isArray(a?.rooms) && a.rooms.length ? a.rooms : [{ adults: a?.adults ?? 2, children: a?.children ?? 0, child_ages: a?.child_ages }];
  return list.slice(0, 5).map((r: any) => {
    const children = Math.max(0, Math.min(4, Number(r.children) || 0));
    const ages = (Array.isArray(r.child_ages) ? r.child_ages : []).map((n: any) => Math.max(0, Math.min(17, Number(n) || 0)));
    return { adults: Math.max(1, Math.min(6, Number(r.adults) || 2)), children, childAges: Array.from({ length: children }, (_, i) => ages[i] ?? 8) };
  });
}

const STAY_PARAMS = {
  check_in: { type: 'string', description: 'Arrival date YYYY-MM-DD.' },
  check_out: { type: 'string', description: 'Departure date YYYY-MM-DD.' },
  rooms: {
    type: 'array',
    description: 'One item per room. Default: one room, 2 adults.',
    items: {
      type: 'object',
      properties: {
        adults: { type: 'number' },
        children: { type: 'number' },
        child_ages: { type: 'array', items: { type: 'number' } },
      },
    },
  },
};

const hotelLink = (id: string, a: any, rooms: GuestRoom[]) =>
  `/hotels/${encodeURIComponent(id)}?${new URLSearchParams({ checkIn: a.check_in, checkOut: a.check_out, rooms: encodeRooms(rooms) })}`;

export const HOTEL_TOOLS: SakhrTool[] = [
  {
    name: 'hotel_destinations',
    description: 'Countries and cities where the agency has bookable hotels (with counts), for hotel-only bookings.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Optional words (country, city or hotel name).' } } },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, a) => {
      const res = await callRoute(hotelDestinationsGET as any, ctx, { path: '/api/hotels/destinations', query: { q: a?.query || '' } });
      return res.ok ? { ok: true, data: { suggestions: res.data.suggestions } } : fail(res);
    },
  },
  {
    name: 'hotels_search',
    description:
      'Search hotels for a hotel-only stay: destination (country code TR/MY/EG/TN/ES/GB/SA, a city or a hotel name), dates and rooms. Returns each hotel with the cheapest total for the whole stay in DZD, meal plan, free cancellation and a link. Ask for the dates if the user did not give them.',
    parameters: {
      type: 'object',
      properties: { destination: { type: 'string', description: 'Country code, city or hotel name.' }, ...STAY_PARAMS },
      required: ['destination', 'check_in', 'check_out'],
    },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, a) => {
      const rooms = roomsArg(a);
      const res = await callRoute(hotelSearchGET as any, ctx, {
        path: '/api/hotels/search',
        query: { dest: a.destination, checkIn: a.check_in, checkOut: a.check_out, rooms: encodeRooms(rooms) },
      });
      if (!res.ok) return fail(res);
      const hotels = (res.data.hotels || []).slice(0, 12).map((h: any) => ({
        id: h.hotel_id,
        name: h.name,
        stars: h.stars,
        place: [h.area, h.city_label, h.country_label].filter(Boolean).join(' · '),
        total_for_stay: money(h.total_from),
        nights: h.nights,
        meal_plan: BOARD_LABEL[h.board_from as BoardType],
        free_cancellation: h.free_cancel,
        test_supplier_not_bookable: h.supplier === 'test' || undefined,
        link: hotelLink(h.hotel_id, a, rooms),
      }));
      return {
        ok: true,
        data: {
          count: hotels.length,
          hotels,
          search_page: `/hotels/search?${new URLSearchParams({ dest: a.destination, checkIn: a.check_in, checkOut: a.check_out, rooms: encodeRooms(rooms) })}`,
        },
      };
    },
  },
  {
    name: 'hotel_rooms',
    description: 'Room choices of one hotel for the dates and guests: room type, beds, meal plan, total for the stay, cancellation deadline, rooms left and offer ids (needed to book).',
    parameters: { type: 'object', properties: { hotel_id: { type: 'string' }, ...STAY_PARAMS }, required: ['hotel_id', 'check_in', 'check_out'] },
    roles: EVERYONE,
    kind: 'read',
    run: async (ctx, a) => {
      const rooms = roomsArg(a);
      const id = String(a.hotel_id || '');
      const res = await callRoute(((req: any) => hotelDetailGET(req, { params: Promise.resolve({ id }) })) as any, ctx, {
        path: `/api/hotels/${encodeURIComponent(id)}`,
        query: { checkIn: a.check_in, checkOut: a.check_out, rooms: encodeRooms(rooms) },
      });
      if (!res.ok) return fail(res);
      const h = res.data.hotel;
      return {
        ok: true,
        data: {
          hotel: h.name,
          place: [h.area, h.city_label, h.country_label].filter(Boolean).join(' · '),
          check_in_time: h.check_in_time,
          check_out_time: h.check_out_time,
          bookable: h.bookable,
          rooms: (h.offers || []).map((list: any[], i: number) => ({
            for_room: i + 1,
            guests: `${rooms[i].adults} adults${rooms[i].children ? ` + ${rooms[i].children} children` : ''}`,
            choices: list.slice(0, 8).map((o) => ({
              offer_id: o.offer_id,
              room: o.room_name,
              beds: o.beds,
              meal_plan: BOARD_LABEL[o.board as BoardType],
              total: money(o.total),
              per_night: money(o.per_night),
              cancellation: o.free_cancel_until ? `free until ${o.free_cancel_until}` : 'non-refundable',
              rooms_left: o.left,
            })),
          })),
          link: hotelLink(h.hotel_id, a, rooms),
        },
      };
    },
  },
  {
    name: 'hotel_book',
    description:
      'Send a hotel booking request (the agency confirms it with the hotel, then the deposit is paid at the agency). Needs offer ids from hotel_rooms (one per room, same order), the lead guest full name as in the passport and a phone. Staff booking for a client must pass customer_id. Prices are re-checked by the server.',
    parameters: {
      type: 'object',
      properties: {
        hotel_id: { type: 'string' },
        ...STAY_PARAMS,
        offer_ids: { type: 'array', items: { type: 'string' } },
        guest_name: { type: 'string' },
        phone: { type: 'string' },
        requests: { type: 'string', description: 'Optional special requests.' },
        customer_id: { type: 'string', description: 'Staff only: the client account id.' },
      },
      required: ['hotel_id', 'check_in', 'check_out', 'offer_ids', 'guest_name', 'phone'],
    },
    roles: SIGNED_IN,
    kind: 'write',
    summarize: (a) => `طلب حجز فندق ${a.hotel_id} من ${a.check_in} إلى ${a.check_out} باسم ${a.guest_name}${a.customer_id ? ' (لعميل)' : ''}`,
    run: async (ctx, a) => {
      const rooms = roomsArg(a);
      const res = await callRoute(hotelBookPOST as any, ctx, {
        path: '/api/hotels/book',
        method: 'POST',
        body: {
          hotelId: a.hotel_id,
          checkIn: a.check_in,
          checkOut: a.check_out,
          rooms: encodeRooms(rooms),
          offerIds: a.offer_ids,
          guests: [{ name: a.guest_name }],
          phone: a.phone,
          requests: a.requests,
          customerId: a.customer_id,
        },
      });
      if (!res.ok) return fail(res);
      return {
        ok: true,
        data: {
          message: res.data.message,
          number: res.data.reservation?.reservation_number,
          total: money(res.data.reservation?.total_amount),
        },
      };
    },
  },
  {
    name: 'hotel_bookings',
    description: 'Agency staff: all hotel-only bookings with client, hotel, dates, status, total and paid.',
    parameters: { type: 'object', properties: { upcoming_only: { type: 'boolean' } } },
    roles: STAFF,
    kind: 'read',
    run: async (ctx, a) => {
      const res = await callRoute(hotelBookingsGET as any, ctx, { path: '/api/admin/hotel-bookings' });
      if (!res.ok) return fail(res);
      const today = new Date().toISOString().slice(0, 10);
      const list = (res.data.bookings || [])
        .filter((b: any) => !a?.upcoming_only || (b.hotel_stay?.check_out || '') >= today)
        .slice(0, 30)
        .map((b: any) => ({
          number: b.reservation_number,
          client: b.customer_name,
          hotel: b.hotel_stay?.hotel_name || b.package_name,
          dates: b.hotel_stay ? `${b.hotel_stay.check_in} → ${b.hotel_stay.check_out}` : '',
          status: b.status,
          total: money(b.total_amount),
          paid: money(b.paid_amount),
        }));
      return { ok: true, data: { count: list.length, bookings: list } };
    },
  },
  {
    name: 'set_visa_status',
    description: 'Agency staff: move the visa follow-up of a tourist-trip booking (DOCS_NEEDED, DOCS_RECEIVED, SUBMITTED, APPROVED, REFUSED, NOT_REQUIRED) with an optional note shown to the client.',
    parameters: {
      type: 'object',
      properties: {
        reservation_id: { type: 'string' },
        status: { type: 'string', enum: VISA_STATUSES },
        note: { type: 'string' },
      },
      required: ['reservation_id', 'status'],
    },
    roles: VISA_STAFF,
    kind: 'write',
    summarize: (a) => `التأشيرة للحجز ${a.reservation_id}: ${VISA_LABEL[a.status as VisaStatus] || a.status}${a.note ? ` — ${a.note}` : ''}`,
    run: async (ctx, a) => {
      const res = await callRoute(tripDetailsPOST as any, ctx, {
        path: '/api/bookings/trip-details',
        method: 'POST',
        body: { action: 'visa', reservationId: a.reservation_id, status: a.status, note: a.note || '' },
      });
      return res.ok ? { ok: true, data: { status: res.data.reservation?.visa_status } } : fail(res);
    },
  },
];
