import { redirect } from 'next/navigation';

/** Old address of the phone side of the QR sign-in (menu links, bookmarks): now /link-device. */
export default function OldQrLoginPage() {
  redirect('/link-device');
}
