import React from 'react'

export default function ValueAreaBar({ vah, val, poc, price, fmt }) {
  if (!vah || !val || !price) {
    return (
      <div className="flex items-center justify-center h-16 text-text-muted text-xs">
        No data — start bot
      </div>
    )
  }

  const lo = val * 0.9975
  const hi = vah * 1.0025
  const range = hi - lo

  const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / range) * 100))

  const valPct = pct(val)
  const vahPct = pct(vah)
  const pocPct = pct(poc)
  const pricePct = pct(price)

  const inZone = price >= val && price <= vah
  const isDiscount = price < val + (vah - val) * 0.15
  const isPremium = price > vah - (vah - val) * 0.15

  let priceColor = '#8b949e'
  if (inZone && isDiscount) priceColor = '#00e676'
  else if (inZone && isPremium) priceColor = '#ff3d57'
  else if (!inZone) priceColor = '#ffab00'

  return (
    <div className="space-y-2">
      <div className="relative h-10 w-full">
        {/* track */}
        <div className="absolute inset-y-0 left-0 right-0 top-1/2 -translate-y-1/2 h-3 bg-bg-secondary rounded-full overflow-hidden border border-bg-border">
          {/* VA fill */}
          <div
            className="absolute top-0 bottom-0 bg-accent-teal/10 border-l border-r border-accent-teal/30"
            style={{ left: `${valPct}%`, width: `${vahPct - valPct}%` }}
          />
          {/* Discount zone */}
          <div
            className="absolute top-0 bottom-0 bg-accent-green/15"
            style={{ left: `${valPct}%`, width: `${(vahPct - valPct) * 0.15}%` }}
          />
          {/* Premium zone */}
          <div
            className="absolute top-0 bottom-0 bg-accent-red/15"
            style={{ left: `${vahPct - (vahPct - valPct) * 0.15}%`, width: `${(vahPct - valPct) * 0.15}%` }}
          />
        </div>

        {/* POC line */}
        <div
          className="absolute top-1 bottom-1 w-px bg-accent-amber/60"
          style={{ left: `${pocPct}%` }}
        />

        {/* Price line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full transition-all duration-500"
          style={{ left: `${pricePct}%`, backgroundColor: priceColor, boxShadow: `0 0 6px ${priceColor}` }}
        />

        {/* VAH label */}
        <div className="absolute -top-4 text-[9px] font-mono text-accent-red/70" style={{ left: `${vahPct}%`, transform: 'translateX(-100%)' }}>
          VAH
        </div>
        {/* VAL label */}
        <div className="absolute -top-4 text-[9px] font-mono text-accent-green/70" style={{ left: `${valPct}%` }}>
          VAL
        </div>
        {/* POC label */}
        <div className="absolute -bottom-4 text-[9px] font-mono text-accent-amber/70" style={{ left: `${pocPct}%`, transform: 'translateX(-50%)' }}>
          POC
        </div>
      </div>

      <div className="mt-5 flex justify-between text-[10px] font-mono">
        <span className="text-accent-green/70">{fmt(val)}</span>
        <span className="text-accent-amber/70">{fmt(poc)}</span>
        <span className="text-accent-red/70">{fmt(vah)}</span>
      </div>
    </div>
  )
}
