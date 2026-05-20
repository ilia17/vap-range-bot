import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts'

export default function PriceChart({ priceHistory, vah, val, poc }) {
  const data = useMemo(() => priceHistory.map((p, i) => ({ i, price: +p.toFixed(2) })), [priceHistory])

  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-36 text-text-muted text-xs">
        Waiting for price data...
      </div>
    )
  }

  const prices = data.map(d => d.price)
  const minP = Math.min(...prices, val * 0.998)
  const maxP = Math.max(...prices, vah * 1.002)
  const pad = (maxP - minP) * 0.1

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1de9b6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1de9b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis domain={[minP - pad, maxP + pad]} hide />
        <Tooltip
          contentStyle={{ background: '#13161a', border: '1px solid #1e2228', borderRadius: 8, fontSize: 11, fontFamily: 'JetBrains Mono' }}
          labelStyle={{ display: 'none' }}
          formatter={(v) => [v.toLocaleString(), 'Price']}
        />
        {vah && <ReferenceLine y={vah} stroke="#ff3d57" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />}
        {poc && <ReferenceLine y={poc} stroke="#ffab00" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />}
        {val && <ReferenceLine y={val} stroke="#00e676" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5} />}
        <Area type="monotone" dataKey="price" stroke="#1de9b6" strokeWidth={1.5} fill="url(#priceGrad)" dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
