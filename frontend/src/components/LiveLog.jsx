import React from 'react'

const TYPE_STYLES = {
  ok: 'text-accent-green',
  warn: 'text-accent-amber',
  err: 'text-accent-red',
  info: 'text-text-secondary',
}

export default function LiveLog({ logs }) {
  return (
    <div className="h-32 overflow-y-auto space-y-0.5 font-mono text-[11px]">
      {!logs.length && (
        <div className="text-text-muted py-1">Awaiting events<span className="blink">_</span></div>
      )}
      {logs.map((l) => (
        <div key={l.id} className="flex gap-2 py-0.5">
          <span className="text-text-muted flex-shrink-0">{l.ts}</span>
          <span className={TYPE_STYLES[l.type] || 'text-text-secondary'}>{l.msg}</span>
        </div>
      ))}
    </div>
  )
}
