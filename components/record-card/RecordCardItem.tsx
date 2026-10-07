'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageOff, Phone, Pencil, Save, RotateCcw, Loader2, ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight, Plus, Briefcase, Landmark, Calculator,
  Users, Ban,
} from 'lucide-react';
import { buildRecordCard, RecordCardModel, RecordColumn } from '@/lib/record-card';
import { extractImageUrls, isImageColumnName, isImagesArrayColumn, primaryPhotoColumn } from '@/lib/table-cell-utils';
import { buildDetailLayout, DetailField, parseChips } from '@/lib/record-detail-layout';
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

export const RecordCard = memo(function RecordCard({
  card,
  selected,
  onSelect,
  variant = 'staff',
}: {
  card: RecordCardModel;
  selected: boolean;
  onSelect: (card: RecordCardModel) => void;
  variant?: 'staff' | 'account';
}) {
  const [failed, setFailed] = useState(false);
  const showImage = card.image && !failed;
  const username = String(card.row.username || '');
  const email = String(card.row.email || '');
  const roleName = String(card.row.roleName || card.row.role || '');

  return (
    <button type="button" onClick={() => onSelect(card)} className={`record-card ${variant === 'account' ? 'is-account' : ''} ${selected ? 'is-selected' : ''}`}>
      <div className="record-card-media">
        {isPendingStatus(card.row.status) ? (
          <span className="record-card-pending">بانتظار الموافقة</span>
        ) : isBlockedStatus(card.row.status) ? (
          <span className="record-card-blocked">موقوف أو مرفوض</span>
        ) : null}
        {showImage ? (
          <img
            src={card.image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="record-card-initial">{card.initial}</span>
        )}
      </div>

      <div className="record-card-body">
        <h4 className="record-card-title">{card.title}</h4>

        {variant === 'account' ? (
          <>
            {username ? <p className="record-card-meta" dir="ltr">@{username}</p> : null}
            {email ? <p className="record-card-meta" dir="ltr">{email}</p> : null}
            {roleName ? <p className="record-card-meta">{roleName}</p> : null}
          </>
        ) : (
          <>
            {card.phone && (
              <p className="record-card-meta">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span dir="ltr">{card.phone}</span>
              </p>
            )}
            {card.rating && (
              <div className="record-card-rating">
                <StarRating
                  value={Number(String(card.rating).replace(/[^\d.]/g, '')) || 0}
                  readOnly
                  size="sm"
                  showValue
                />
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
});

