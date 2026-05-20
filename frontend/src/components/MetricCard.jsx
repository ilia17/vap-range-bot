import React from 'react'

export default function MetricCard({ label, value, sub, valueClass = '', glow }) {
  return (
    <div className={`card p-4 flex flex-col gap-1 ${glow || ''}`}>
      <span className="label">{label}</span>
      <span className={`font-display text-xl font-semibold tracking-tight ${valueClass || 'text-text-primary'}`}>
        {value ?? '—'}
      </span>
      {sub && <span className="text-[11px] text-text-muted font-mono">{sub}</span>}
    </div>
  )
}
