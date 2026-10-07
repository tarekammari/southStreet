# Sakhr AI — smartness checklist (manual, no unit tests)

Short checklist after changing Sakhr routing, grounding, or reply safety. Do **not** paste secrets into chat while verifying.

## Intent routing & empty RAG

- [ ] Greeting (`السلام عليكم`) → welcome + page shortcuts (not a hard "no knowledge").
- [ ] Vague question (`ساعدني`) → clarifying Arabic questions (باقة / فندق / مرشد / حجز / حكم شرعي).
- [ ] Navigation (`افتح الفنادق`) → navigate/action cards still work.
- [ ] Empty RAG + no external AI → clarifying fallback, **no** `.env` / API key hints in the reply.

## Grounding & prices

- [ ] Ask for packages when DB has rows → structured list + package cards; prices only if stored.
- [ ] Ask for a price when **no** amounts exist → refuses to invent numbers; asks room type / season.
- [ ] Knowledge markdown hit (`knowledge/`) → cites agency knowledge; still no invented prices.
- [ ] External AI answer (if enabled) → banner shows external source; still no invented agency prices in system rules.

## Session memory

- [ ] Ask a follow-up that needs prior turn (e.g. "والغرفة الثلاثية؟" after a package question) → history of last ~12 turns is sent; reply stays coherent.
- [ ] Clear chat → memory resets (no stale turns).

## Formatting

- [ ] Packages / hotels answers show numbered clean bullets (duration, hotel, room prices when present).
- [ ] Compare packages still returns comparison card without crashing.

## Safety

- [ ] Reply never contains `GEMINI_API_KEY`, `JWT_SECRET`, `SOUTHSTREET-KEY-…`, or `southstreet_admin.key`.
- [ ] Admin CRUD chat still works for admins; pilgrim mode does not expose admin table tools.
- [ ] Network tab on `/api/ai/sakhr` responses: no secret material in `text`.

## Build smoke

- [ ] `npm run build` passes after Sakhr edits.
- [ ] `npm run start` on `:3000` serves chat UI; one smoke question returns 200.