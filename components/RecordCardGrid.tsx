'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff, Phone, Pencil, Save, RotateCcw, Loader2, ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight, Plus, Briefcase, Landmark, Calculator,
  Users, Ban, CalendarOff, Eye, EyeOff,
} from 'lucide-react';
import { buildRecordCard, RecordCardModel, RecordColumn } from '@/lib/record-card';
import { extractImageUrls, isImageColumnName, isImagesArrayColumn, primaryPhotoColumn } from '@/lib/table-cell-utils';
import { buildDetailLayout, DetailField, parseChips } from '@/lib/record-detail-layout';
import { isPackageExpired } from '@/lib/booking-catalog';
import {
  getFieldSelectOptions,
  isMultiSelectField,
  STAFF_VIEW_GROUPS,
  ACCOUNT_VIEW_GROUPS,
  staffViewGroup,
  accountViewGroup,
  isPendingStatus,
  isBlockedStatus,
  type StaffViewGroupId,
  type AccountViewGroupId,
} from '@/lib/record-field-options';
import { LOGIN_ROLE_OPTIONS } from '@/lib/roles';
import ImageUploadField, { uploadImageFile } from '@/components/ImageUploadField';
import LoginCredentialsPanel from '@/components/LoginCredentialsPanel';
import ReviewsModerator from '@/components/ReviewsModerator';
import { StarRating } from '@/components/StarRating';
import { authHeaders, getAuthToken, jsonAuthHeaders } from '@/lib/api-client';

import { RecordCard } from '@/components/record-card/RecordCardItem';
export { RecordBigCard } from '@/components/record-card/RecordBigCardView';

const STAFF_GROUP_ICON = {
  admin: Briefcase,
  guides: Landmark,
  accountant: Calculator,
  blocked: Ban,
} as const;

const ACCOUNT_GROUP_ICON = {
  pilgrims: Users,
  blocked: Ban,
} as const;

const CHUNK = 36;

interface RecordCardGridProps {
  rows: Record<string, unknown>[];
  columns: RecordColumn[];
  search: string;
  selectedKey: string | null;
  onSelect: (card: RecordCardModel) => void;
  tableName?: string;
}

export function RecordCardGrid({ rows, columns, search, selectedKey, onSelect, tableName }: RecordCardGridProps) {
  const [visible, setVisible] = useState(CHUNK);
  const [openStaffGroup, setOpenStaffGroup] = useState<StaffViewGroupId | null>(null);
  const [openAccountGroup, setOpenAccountGroup] = useState<AccountViewGroupId | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const allCards = useMemo(() => rows.map((row, i) => buildRecordCard(row, columns, i)), [rows, columns]);

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allCards.filter((c) => c.search.includes(q)) : allCards;
  }, [allCards, search]);

  useEffect(() => setVisible(CHUNK), [allCards, search]);
  useEffect(() => {
    setOpenStaffGroup(null);
    setOpenAccountGroup(tableName === 'users' ? 'pilgrims' : null);
  }, [tableName, rows]);

  useEffect(() => {
    if (visible >= cards.length) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => Math.min(v + CHUNK, cards.length));
      },
      { rootMargin: '400px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 gap-3">
        <ImageOff className="w-10 h-10 opacity-50" />
        <p className="text-base">لا توجد نتائج</p>
      </div>
    );
  }

  if (tableName === 'morshids') {
    const groups = STAFF_VIEW_GROUPS.map((group) => ({
      ...group,
      cards: cards.filter((card) => staffViewGroup(card.row) === group.id),
    }));

    return (
      <div className="staff-album-board">
        {groups.map((group) => {
          const Icon = STAFF_GROUP_ICON[group.id];
          const open = openStaffGroup === group.id;
          return (
            <section key={group.id} className={`staff-album ${open ? 'is-open' : ''} ${group.id === 'blocked' ? 'is-blocked' : ''}`}>
              <button
                type="button"
                className="staff-album-cover"
                aria-expanded={open}
                onClick={() => setOpenStaffGroup(open ? null : group.id)}
              >
                <span className="staff-album-icon" aria-hidden>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="staff-album-cover-copy">
                  <h4>{group.label}</h4>
                  <p>{group.hint}</p>
                </div>
                <span className="staff-album-count">
                  {group.cards.length} {group.cards.length === 1 ? 'عضو' : 'أعضاء'}
                </span>
                <ChevronDown className="staff-album-chevron" aria-hidden />
              </button>
              <div className="staff-album-panel">
                <div className="staff-album-panel-inner">
                  <div className="staff-album-list">
                    {group.cards.length === 0 ? (
                      <p className="staff-album-empty">لا يوجد أعضاء في هذا التصنيف بعد</p>
                    ) : (
                      group.cards.map((card) => (
                        <RecordCard
                          key={card.key}
                          card={card}
                          selected={card.key === selectedKey}
                          onSelect={onSelect}
                          variant="staff"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  if (tableName === 'users') {
    const groups = ACCOUNT_VIEW_GROUPS.map((group) => ({
      ...group,
      cards: cards.filter((card) => accountViewGroup(card.row) === group.id),
    }));

    return (
      <div className="staff-album-board is-accounts">
        {groups.map((group) => {
          const Icon = ACCOUNT_GROUP_ICON[group.id];
          const open = openAccountGroup === group.id;
          const unit = group.cards.length === 1 ? 'حساب' : 'حسابات';
          return (
            <section key={group.id} className={`staff-album is-account ${open ? 'is-open' : ''} ${group.id === 'blocked' ? 'is-blocked' : ''}`}>
              <button
                type="button"
                className="staff-album-cover"
                aria-expanded={open}
                onClick={() => setOpenAccountGroup(open ? null : group.id)}
              >
                <span className="staff-album-icon" aria-hidden>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="staff-album-cover-copy">
                  <h4>{group.label}</h4>
                  <p>{group.hint}</p>
                </div>
                <span className="staff-album-count">
                  {group.cards.length} {unit}
                </span>
                <ChevronDown className="staff-album-chevron" aria-hidden />
              </button>
              <div className="staff-album-panel">
                <div className="staff-album-panel-inner">
                  <div className="staff-album-list">
                    {group.cards.length === 0 ? (
                      <p className="staff-album-empty">لا توجد حسابات في هذا التصنيف بعد</p>
                    ) : (
                      group.cards.map((card) => (
                        <RecordCard
                          key={card.key}
                          card={card}
                          selected={card.key === selectedKey}
                          onSelect={onSelect}
                          variant="account"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // ── Packages: split active vs expired, deduplicate names with dates ──
  if (tableName === 'packages') {
    const activeCards   = cards.filter((c) => !isPackageExpired(c.row as any));
    const expiredCards  = cards.filter((c) =>  isPackageExpired(c.row as any));

    // Count how many cards share the same title so we can badge duplicates
    const titleCount = new Map<string, number>();
    for (const c of cards) titleCount.set(c.title, (titleCount.get(c.title) ?? 0) + 1);

    function cardLabel(card: RecordCardModel): string {
      if ((titleCount.get(card.title) ?? 0) <= 1) return card.title;
      const startDate = String(card.row.start_date || card.row.end_date || '');
      if (!startDate) return card.title;
      const d = new Date(startDate);
      if (Number.isNaN(d.getTime())) return card.title;
      const label = d.toLocaleDateString('ar-DZ', { month: 'short', year: 'numeric' });
      return `${card.title} — ${label}`;
    }

    return (
      <PackagesGridView
        activeCards={activeCards}
        expiredCards={expiredCards}
        cardLabel={cardLabel}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className="record-card-grid-wrap">
      <div className="record-card-grid">
        {cards.slice(0, visible).map((card) => (
          <RecordCard key={card.key} card={card} selected={card.key === selectedKey} onSelect={onSelect} />
        ))}
      </div>

      {visible < cards.length && (
        <div ref={sentinelRef} className="py-5 text-center text-sm text-slate-400">
          {visible} من {cards.length}
        </div>
      )}
    </div>
  );
}

// ── Packages-specific grid: active first, expired collapsed ──
function PackagesGridView({
  activeCards,
  expiredCards,
  cardLabel,
  selectedKey,
  onSelect,
}: {
  activeCards: RecordCardModel[];
  expiredCards: RecordCardModel[];
  cardLabel: (card: RecordCardModel) => string;
  selectedKey: string | null;
  onSelect: (card: RecordCardModel) => void;
}) {
  const [showExpired, setShowExpired] = useState(false);

  return (
    <div className="record-card-grid-wrap" dir="rtl">
      {/* ── Active programmes ── */}
      {activeCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
          <CalendarOff className="w-9 h-9 opacity-40" />
          <p className="text-sm">لا توجد برامج نشطة حالياً</p>
        </div>
      ) : (
        <div className="record-card-group">
          <p className="record-card-group-title">
            البرامج النشطة
            <span className="record-card-group-count">{activeCards.length}</span>
          </p>
          <div className="record-card-grid">
            {activeCards.map((card) => (
              <RecordCard
                key={card.key}
                card={{ ...card, title: cardLabel(card) }}
                selected={card.key === selectedKey}
                onSelect={() => onSelect(card)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Expired programmes (collapsed by default) ── */}
      {expiredCards.length > 0 && (
        <div className="pkg-expired-section">
          <button
            type="button"
            className="pkg-expired-toggle"
            onClick={() => setShowExpired((v) => !v)}
            aria-expanded={showExpired}
          >
            <CalendarOff className="w-4 h-4" />
            <span>البرامج المنتهية ({expiredCards.length})</span>
            {showExpired ? <EyeOff className="w-4 h-4 mr-auto" /> : <Eye className="w-4 h-4 mr-auto" />}
          </button>

          <div className={`pkg-expired-panel ${showExpired ? 'is-open' : ''}`}>
            <div className="pkg-expired-panel-inner">
              <div className="record-card-grid">
                {expiredCards.map((card) => (
                  <RecordCard
                    key={card.key}
                    card={{ ...card, title: cardLabel(card) }}
                    selected={card.key === selectedKey}
                    onSelect={() => onSelect(card)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Swipeable hero gallery: arrows, dots and a counter, RTL-aware. */
