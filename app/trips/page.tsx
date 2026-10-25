import { redirect } from 'next/navigation';

/** Old link: tourist trips now live on the programs page. */
export default function TripsPage() {
  redirect('/packages?kind=tourism');
}
