'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SectionShellProps {
  id?: string;
  badge?: ReactNode;
  title: string;
  titleHighlight?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  variant?: 'light' | 'dark' | 'gradient';
  className?: string;
}

export default function SectionShell({
  id,
  badge,
  title,
  titleHighlight,
  description,
  action,
  children,
  variant = 'light',
  className = '',
}: SectionShellProps) {
  const variants = {
    light: 'bg-white border-slate-200/80 text-slate-900',
    dark: 'bg-slate-950 border-slate-800 text-white',
    gradient: 'bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/40 border-emerald-100/60 text-slate-900',
  };

  return (
    <section id={id} className={`w-full my-8 sm:my-12 px-3 sm:px-6 font-tajawal ${className}`}>
      <div className={`relative w-full rounded-3xl border shadow-xl overflow-hidden py-10 sm:py-14 px-4 sm:px-8 md:px-12 ${variants[variant]}`}>
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-amber-400/5 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative z-10 max-w-7xl mx-auto mb-8 sm:mb-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-current/10">
            <div className="space-y-3 text-right">
              {badge}
              <h2 className="font-cairo text-2xl sm:text-3xl md:text-4xl font-black leading-tight">
                {titleHighlight ? (
                  <>
                    {title}{' '}
                    <span className="text-emerald-600">{titleHighlight}</span>
                  </>
                ) : (
                  title
                )}
              </h2>
              {description && (
                <p className="text-sm sm:text-base opacity-70 max-w-2xl leading-relaxed">{description}</p>
              )}
            </div>
            {action}
          </div>
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto">{children}</div>
      </div>
    </section>
  );
}
