'use client';

import { useState } from 'react';
import {
  Ban,
  Bath,
  BedDouble,
  BellRing,
  Car,
  Check,
  CircleParking,
  ConciergeBell,
  Coffee,
  Croissant,
  Dumbbell,
  Lock,
  Maximize2,
  Mountain,
  Plane,
  Refrigerator,
  Snowflake,
  Sofa,
  Soup,
  Sparkles,
  Tv,
  Users,
  UtensilsCrossed,
  Waves,
  Wifi,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { lightPhoto } from '@/lib/destination-photos';
import { BOARD_LABEL, arDate, formatDzd, roomsLeftText, type BoardType, type RoomOffer } from '@/lib/hotels/types';

const ICONS: [RegExp, LucideIcon][] = [
  [/واي ?فاي|wifi|إنترنت/i, Wifi],
  [/تكييف|مكيف/i, Snowflake],
  [/تلفاز|شاشة|tv/i, Tv],
  [/خزنة/i, Lock],
  [/ميني ?بار|ثلاجة/i, Refrigerator],
  [/مجفف/i, Wind],
  [/صالون|جلوس/i, Sofa],
  [/حوض|استحمام|حمام خاص/i, Bath],
  [/إطلالة|شرفة/i, Mountain],
  [/قهوة|مقهى/i, Coffee],
  [/إفطار|فطور/i, Croissant],
  [/مطعم/i, UtensilsCrossed],
  [/مسبح/i, Waves],
  [/سبا|حمّام/i, Sparkles],
  [/رياض|لياقة/i, Dumbbell],
  [/خدمة الغرف|كونسيرج/i, ConciergeBell],
  [/استقبال/i, BellRing],
  [/موقف/i, CircleParking],
  [/نقل|مطار/i, Plane],
  [/سيار/i, Car],
];

/** An icon for an amenity label (wifi, pool, breakfast…). */
export function amenityIcon(label: string): LucideIcon {
  return ICONS.find(([re]) => re.test(label))?.[1] || Check;
}

const BOARD_ICON: Record<BoardType, LucideIcon> = { RO: BedDouble, BB: Croissant, HB: Soup, FB: UtensilsCrossed, AI: Sparkles };
const BOARD_HINT: Record<BoardType, string> = {
  RO: 'بدون وجبات',
  BB: 'فطور صباحي بوفيه',
  HB: 'فطور + عشاء',
  FB: 'فطور + غداء + عشاء',
  AI: 'كل الوجبات والمشروبات',
};

type Props = {
  offers: RoomOffer[];
  picked: string;
  onPick: (offerId: string) => void;
  fallbackPhoto?: string;
};

/** The room types of a hotel as photo cards; each meal plan is an option with its price. */
export default function RoomOptions({ offers, picked, onPick, fallbackPhoto }: Props) {
  const rooms = new Map<string, RoomOffer[]>();
  for (const o of offers) rooms.set(o.room_id, [...(rooms.get(o.room_id) || []), o]);
  const list = [...rooms.values()].map((opts) => opts.sort((a, b) => a.total - b.total)).sort((a, b) => a[0].total - b[0].total);

  return (
    <div className="hrm-grid" role="radiogroup">
      {list.map((opts) => (
        <RoomCard key={opts[0].room_id} options={opts} picked={picked} onPick={onPick} fallbackPhoto={fallbackPhoto} />
      ))}
    </div>
  );
}

function RoomCard({ options, picked, onPick, fallbackPhoto }: { options: RoomOffer[] } & Omit<Props, 'offers'>) {
  const room = options[0];
  const photos = room.photos.length ? room.photos : fallbackPhoto ? [fallbackPhoto] : [];
  const [shown, setShown] = useState(0);
  const on = options.some((o) => o.offer_id === picked);
  const left = Math.min(...options.map((o) => o.left));

  return (
    <article className={`hrm-card${on ? ' is-on' : ''}`}>
      <div className="hrm-media">
        {photos.length ? (
          <img src={lightPhoto(photos[shown], 'sm')} alt={room.room_name} loading="lazy" decoding="async" />
        ) : (
          <BedDouble aria-hidden />
        )}
        {left <= 3 ? <span className="hrm-left">{roomsLeftText(left)}</span> : null}
        {on ? <span className="hrm-chosen"><Check aria-hidden /> اخترتها</span> : null}
        {photos.length > 1 ? (
          <span className="hrm-dots">
            {photos.map((p, i) => (
              <button key={p} type="button" aria-label={`صورة ${i + 1}`} aria-pressed={i === shown} onClick={() => setShown(i)} />
            ))}
          </span>
        ) : null}
      </div>

      <div className="hrm-body">
        <h3>{room.room_name}</h3>
        <ul className="hrm-facts">
          {room.beds ? <li><BedDouble aria-hidden /> {room.beds}</li> : null}
          <li><Users aria-hidden /> حتى {room.max_adults} بالغ{room.max_children ? ` + ${room.max_children} طفل` : ''}</li>
          {room.size_m2 ? <li><Maximize2 aria-hidden /> {room.size_m2} م²</li> : null}
        </ul>
        {room.amenities.length ? (
          <ul className="hrm-amen">
            {room.amenities.slice(0, 6).map((a) => {
              const Icon = amenityIcon(a);
              return <li key={a} title={a}><Icon aria-hidden /> <span>{a}</span></li>;
            })}
          </ul>
        ) : null}

        <div className="hrm-options">
          {options.map((o) => {
            const sel = o.offer_id === picked;
            const Icon = BOARD_ICON[o.board];
            return (
              <button key={o.offer_id} type="button" role="radio" aria-checked={sel} className={`hrm-opt${sel ? ' is-on' : ''}`} onClick={() => onPick(o.offer_id)}>
                <span className="hrm-opt-ico"><Icon aria-hidden /></span>
                <span className="hrm-opt-text">
                  <b>{BOARD_LABEL[o.board]}</b>
                  <small>{BOARD_HINT[o.board]}</small>
                  <small className={o.free_cancel_until ? 'is-free' : 'is-nonref'}>
                    {o.free_cancel_until ? <><Check aria-hidden /> إلغاء مجاني حتى {arDate(o.free_cancel_until, { day: 'numeric', month: 'short' })}</> : <><Ban aria-hidden /> غير قابل للاسترداد</>}
                  </small>
                </span>
                <span className="hrm-opt-price">
                  <strong>{formatDzd(o.total)}</strong>
                  <small>{formatDzd(o.per_night)} / ليلة</small>
                </span>
                <span className="hrm-opt-radio" aria-hidden>{sel ? <Check /> : null}</span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
