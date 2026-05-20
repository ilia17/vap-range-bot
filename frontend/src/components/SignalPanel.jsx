import React from 'react'
import { TrendingUp, TrendingDown, Clock, AlertTriangle, Activity } from 'lucide-react'

const ZONE_META = {
  DISCOUNT:  { label: 'Discount zone', color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/20' },
  PREMIUM:   { label: 'Premium zone',  color: 'text-accent-red',   bg: 'bg-accent-red/10 border-accent-red/20' },
  MID_RANGE: { label: 'Mid-range',     color: 'text-text-secondary', bg: 'bg-bg-secondary border-bg-border' },
  BELOW_VA:  { label: 'Below VA',      color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/20' },
  ABOVE_VA:  { label: 'Above VA',      color: 'text-accent-amber', bg: 'bg-accent-amber/10 border-accent-amber/20' },
}

export default function SignalPanel({ signal, zone, bias, entry, sl, tp, vwap, vwapAligned, fmt, running }) {
  if (!running) {
    return (
      <div className="flex flex-col items-center justify-center h-28 gap-2">
        <Clock className="w-5 h-5 text-text-muted" />
        <span className="text-text-muted text-xs font-mono">Start bot to generate signals</span>
      </div>
    )
  }

  const zMeta = ZONE_META[zone] || ZONE_META['MID_RANGE']

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill border ${bias === 'BALANCED' ? 'bg-accent-teal/10 text-accent-teal border-accent-teal/20' : 'bg-accent-amber/10 text-accent-amber border-accent-amber/20'}`}>
          {bias ?? '—'}
        </span>
        <span className={`pill border ${zMeta.bg} ${zMeta.color}`}>{zMeta.label}</span>
        {vwap != null && (
          <span className={`pill border ${vwapAligned === true ? 'bg-accent-green/10 text-accent-green border-accent-green/20' : vwapAligned === false ? 'bg-accent-red/10 text-accent-red border-accent-red/20' : 'bg-bg-secondary text-text-muted border-bg-border'}`}>
            VWAP {vwapAligned === true ? '✓' : vwapAligned === false ? '✗' : '—'} {fmt(vwap)}
          </span>
        )}
      </div>

      {/* Signal card */}
      {signal === 'LONG' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-green/8 border border-accent-green/20">
          <TrendingUp className="w-5 h-5 text-accent-green flex-shrink-0" />
          <div><div className="text-accent-green text-sm font-semibold font-display">LONG</div><div className="text-text-muted text-[11px]">Discount zone · VWAP aligned</div></div>
        </div>
      )}
      {signal === 'SHORT' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-red/8 border border-accent-red/20">
          <TrendingDown className="w-5 h-5 text-accent-red flex-shrink-0" />
          <div><div className="text-accent-red text-sm font-semibold font-display">SHORT</div><div className="text-text-muted text-[11px]">Premium zone · VWAP aligned</div></div>
        </div>
      )}
      {signal === 'WAIT' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary border border-bg-border">
          <Clock className="w-5 h-5 text-text-muted flex-shrink-0" />
          <div><div className="text-text-secondary text-sm font-display">Waiting</div><div className="text-text-muted text-[11px]">{vwapAligned === false ? 'Zone hit but VWAP not aligned' : 'No edge — mid-range'}</div></div>
        </div>
      )}
      {signal === 'NO_TRADE' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent-amber/8 border border-accent-amber/20">
          <AlertTriangle className="w-5 h-5 text-accent-amber flex-shrink-0" />
          <div><div className="text-accent-amber text-sm font-display">No trade</div><div className="text-text-muted text-[11px]">Imbalanced market</div></div>
        </div>
      )}

      {/* Levels */}
      {entry != null && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Entry',  value: fmt(entry), color: 'text-text-primary' },
            { label: 'Stop',   value: fmt(sl),    color: 'text-accent-red' },
            { label: 'Target', value: fmt(tp),    color: 'text-accent-green' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-bg-secondary rounded-lg p-2.5 text-center border border-bg-border">
              <div className="label mb-1">{label}</div>
              <div className={`text-xs font-mono font-medium ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
