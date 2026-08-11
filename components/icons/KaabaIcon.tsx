import React from 'react';

export default function KaabaIcon({ className = 'w-5 h-5', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8l8-4 8 4v10l-8 4-8-4V8z" fill="currentColor" fillOpacity="0.2" />
      <path d="M12 4v16" />
      <path d="M4 8l8 4 8-4" />
      <path d="M4 11.5l8 4 8-4" stroke="#d4af37" strokeWidth="2" />
    </svg>
  );
}
