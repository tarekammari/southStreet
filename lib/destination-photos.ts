const unsplash = (id: string, w: number) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=70`;

const IDS: Record<string, string> = {
  MAKKAH: 'photo-1565552645632-d725f8bfc19a',
  MADINAH: 'photo-1591604129939-f1efa4d9f7fa',
  TR: 'photo-1524231757912-21f4fe3a7200',
  MY: 'photo-1596422846543-75c6fc197f07',
  EG: 'photo-1539650116574-8efeb43e2750',
  ES: 'photo-1583422409516-2895a77efded',
  GB: 'photo-1513635269975-59663e0ac1ad',
};

/** Stock cover photo of a destination (TR, MY…, MAKKAH, MADINAH); '' when there is none. */
export function destinationPhoto(id: string, width = 640): string {
  return IDS[id] ? unsplash(IDS[id], width) : '';
}
