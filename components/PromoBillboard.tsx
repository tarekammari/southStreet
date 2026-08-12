'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function PromoBillboard() {
  return (
    <motion.section
      id="direct-flight-section"
      initial={{ opacity: 0, y: 35 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="w-full my-4 md:my-6 px-3 sm:px-6 font-tajawal"
    >
      {/* ── FULL WIDTH CONTAINER WITH RAW AIR ALGÉRIE BACKGROUND ── */}
      <div className="relative w-full h-[500px] sm:h-[600px] md:h-[700px] rounded-2xl md:rounded-3xl overflow-hidden flex items-end justify-center pb-8 sm:pb-12 text-center group">

        {/* RAW BACKGROUND IMAGE — FULL BLEED WITH SMOOTH ENTRANCE ZOOM EFFECT */}
        <motion.img
          src="/images/AIR_ALGERIA.jpg"
          alt="Air Algérie Plane Direct Flight to Saudi Arabia"
          initial={{ scale: 1.08 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* BIGGER TEXT INSIDE A MORE TRANSPARENT LABEL WITH 12PX CORNER RADIUS */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="relative z-10 bg-black/25 backdrop-blur-sm px-8 py-3.5 sm:px-10 sm:py-4 rounded-[12px] border border-white/20 text-white shadow-2xl max-w-fit mx-4"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-cairo tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            رحلة طيران مباشرة إلى البقاع المقدسة
          </h2>
        </motion.div>

      </div>
    </motion.section>
  );
}
