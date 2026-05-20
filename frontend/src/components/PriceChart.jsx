import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts'

export default function PriceChart({ priceHistory, vah, val, poc }) {
  const data = useMemo(() =>
    (priceHistory || []).map((p, i) => ({ i, price: +parseFloat(p).toFixed(2) }))
  , [priceHistory])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-36 text-text-muted text-xs font-mono">
        Waiting for price data...
      </div>
    )
  }

  const prices = data.map(d => d.price)
  const minP = Math.min(...prices, val ? val * 0.998 : prices[0] * 0.998)
  const maxP = Math.max(...prices, vah ? vah * 1.002 : prices[0] * 1.002)
  const pad  = (maxP - minP) * 0.15 || maxP * 0.002

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#1de9b6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#1de9b6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis
          domain={[minP - pad, maxP + pad]}
          hide={false}
          width={60}
          tick={{ fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#484f58' }}
          tickFormatter={v => v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2)}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#13161a',
            border: '1px solid #1e2228',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'JetBrains Mono',
          }}
          labelStyle={{ display: 'none' }}
          formatter={v => [v.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Price']}
        />
        {vah && (
          <ReferenceLine y={vah} stroke="#ff3d57" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
            label={{ value: 'VAH', position: 'insideTopRight', fontSize: 9, fill: '#ff3d57', fontFamily: 'JetBrains Mono' }}
          />
        )}
        {poc && (
          <ReferenceLine y={poc} stroke="#ffab00" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
            label={{ value: 'POC', position: 'insideTopRight', fontSize: 9, fill: '#ffab00', fontFamily: 'JetBrains Mono' }}
          />
        )}
        {val && (
          <ReferenceLine y={val} stroke="#00e676" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
            label={{ value: 'VAL', position: 'insideBottomRight', fontSize: 9, fill: '#00e676', fontFamily: 'JetBrains Mono' }}
          />
        )}
        <Area
          type="monotone"
          dataKey="price"
          stroke="#1de9b6"
          strokeWidth={1.5}
          fill="url(#priceGrad)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
