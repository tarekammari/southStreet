'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ArrowUp, Phone } from 'lucide-react';
import KaabaIcon from '@/components/icons/KaabaIcon';

/** Thin brand-coloured bar under the navbar showing how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  return <motion.div className="home-progress" style={{ scaleX }} aria-hidden />;
}

/** Appears after the first screen; returns to the top smoothly. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.button
      type="button"
      className="home-top"
      aria-label="العودة إلى الأعلى"
      initial={false}
      animate={show ? { opacity: 1, y: 0, pointerEvents: 'auto' } : { opacity: 0, y: 16, pointerEvents: 'none' }}
      transition={{ duration: 0.25 }}
      tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
    >
      <ArrowUp className="w-5 h-5" aria-hidden />
    </motion.button>
  );
}

/** Closing call to action before the footer. */
export function HomeCta() {
  return (
    <section className="home-cta-wrap" aria-labelledby="home-cta-title">
      <motion.div
        className="home-cta"
        initial={{ opacity: 0, y: 32, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="home-cta-glow" aria-hidden />
        <span className="home-cta-icon" aria-hidden><KaabaIcon className="w-7 h-7" /></span>
        <h2 id="home-cta-title">رحلتك إلى الحرمين تبدأ من هنا</h2>
        <p>اختر موعدك، وأرسل طلبك في دقائق — وفريق الوكالة يتكفّل بالباقي.</p>
        <div className="home-cta-actions">
          <Link href="/packages" className="home-cta-btn is-primary">
            تصفّح البرامج
            <ArrowLeft className="w-4 h-4" aria-hidden />
          </Link>
          <a href="tel:+21321554433" className="home-cta-btn">
            <Phone className="w-4 h-4" aria-hidden />
            <span dir="ltr">+213 21 55 44 33</span>
          </a>
        </div>
      </motion.div>
    </section>
  );
}
