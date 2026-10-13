'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Loader2, Plane } from 'lucide-react';
import { loadGuidePrograms, saveGuidePrograms, type GuideProgram } from './teamApi';

/**
 * "Programmes he accompanies" in a guide's details: tick the programmes, save.
 * A programme has one guide; ticking one guided by someone else moves it here.
 */
export default function GuidePrograms({
  staffId,
  canEdit,
  onToast,
}: {
  staffId: string;
  canEdit: boolean;
  onToast: (message: string, kind?: 'error') => void;
}) {
  const [programs, setPrograms] = useState<GuideProgram[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // The parent may pass a new callback each render: keep the latest without reloading the list.
  const toast = useRef(onToast);
  toast.current = onToast;

  useEffect(() => {
    let alive = true;
    void loadGuidePrograms(staffId).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setPrograms([]);
        return toast.current(r.error, 'error');
      }
      setPrograms(r.data.programs);
      setPicked(new Set(r.data.programs.filter((p) => p.assigned).map((p) => p.package_id)));
    });
    return () => {
      alive = false;
    };
  }, [staffId]);

  const dirty = useMemo(
    () => Boolean(programs?.some((p) => !p.finished && p.assigned !== picked.has(p.package_id))),
    [programs, picked]
  );
  const moving = programs?.filter((p) => picked.has(p.package_id) && p.other_guide) || [];

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    const r = await saveGuidePrograms(staffId, [...picked]);
    setSaving(false);
    if (!r.ok) return onToast(r.error, 'error');
    setPrograms(r.data.programs);
    setPicked(new Set(r.data.programs.filter((p) => p.assigned).map((p) => p.package_id)));
    onToast(r.data.added || r.data.removed ? 'تم تحديث برامج المرشد' : 'لا تغيير');
  };

  const when = (p: GuideProgram) => [p.start_date, p.end_date].filter(Boolean).join(' ← ') || 'بدون تاريخ';

  return (
    <div className="tm-programs">
      <div className="tm-programs-head">
        <strong><Plane className="w-4 h-4" /> البرامج التي يرافقها</strong>
        <small>يظهر كل برنامج مختار في لوحة المرشد مع قائمة معتمريه. لكل برنامج مرشد واحد.</small>
      </div>

      {programs === null ? (
        <p className="tm-programs-empty"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ التحميل…</p>
      ) : programs.length === 0 ? (
        <p className="tm-programs-empty">لا توجد برامج حالية أو قادمة.</p>
      ) : (
        <ul className="tm-programs-list">
          {programs.map((p) => (
            <li key={p.package_id} className={p.finished ? 'is-finished' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.has(p.package_id)}
                  disabled={!canEdit || p.finished || saving}
                  onChange={() => toggle(p.package_id)}
                />
                <span className="tm-programs-main">
                  <b>{p.name}</b>
                  <small><CalendarDays className="w-3.5 h-3.5" /> <span dir="ltr">{when(p)}</span></small>
                </span>
                {p.finished ? (
                  <em className="tm-programs-tag">منتهٍ</em>
                ) : p.other_guide && !picked.has(p.package_id) ? (
                  <em className="tm-programs-tag is-other">مع: {p.other_guide}</em>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}

      {canEdit && dirty ? (
        <div className="tm-programs-actions">
          {moving.length ? (
            <small className="tm-programs-warn">
              سيُنقل {moving.length === 1 ? `«${moving[0].name}»` : `${moving.length} برامج`} من مرشده الحالي إلى هذا المرشد.
            </small>
          ) : null}
          <button type="button" className="tm-btn is-primary" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} حفظ البرامج
          </button>
        </div>
      ) : null}
    </div>
  );
}
