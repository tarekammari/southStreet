# Online card pay (Stripe / CIB) — later

Card checkout is **not live**. The pilgrim UI shows a secondary button that stays disabled until you opt in.

## Enable later

1. Set in `.env` (and restart / rebuild):

```env
ONLINE_CARD_PAY_ENABLED=true
```

2. Wire a real provider (Stripe Checkout or CIB e-paiement) behind `/api/payments/...` — do **not** put secret keys in the client.
3. Keep the agency confirm + deposit / receipt flows as the primary path until card capture is tested end-to-end.
4. Default remains `false` (or unset) so production stays safe.

## Related flags

- `REQUIRE_ADMIN_APPROVAL_FOR_NEW_USERS` — default `false` for self-serve Google pilgrim signup; set `true` to restore PENDING_APPROVAL gating.
