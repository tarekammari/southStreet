import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '@/app/legal.css';

/** Plain reading page for the privacy policy and the account deletion request (Google Play needs both). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="page-shell min-h-screen lg-page">
      <Navbar variant="light" />
      <main className="lg-main">
        <article className="lg-card">
          <h1>{title}</h1>
          <p className="lg-updated">آخر تحديث / Last updated: <bdi dir="ltr">{updated}</bdi></p>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
