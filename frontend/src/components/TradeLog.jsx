import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function TradeLog({ trades }) {
  if (!trades.length) {
    return (
      <div className="flex items-center justify-center h-24 text-text-muted text-xs">
        No trades yet
      </div>
    )
  }

  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-text-muted border-b border-bg-border">
            <th className="text-left pb-2 pr-3 font-medium uppercase tracking-wider text-[10px]">Time</th>
            <th className="text-left pb-2 pr-3 font-medium uppercase tracking-wider text-[10px]">Side</th>
            <th className="text-right pb-2 pr-3 font-medium uppercase tracking-wider text-[10px]">Entry</th>
            <th className="text-right pb-2 pr-3 font-medium uppercase tracking-wider text-[10px]">Exit</th>
            <th className="text-right pb-2 font-medium uppercase tracking-wider text-[10px]">P&L</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={t.id} className="border-b border-bg-border/50 hover:bg-bg-hover/30 transition-colors">
              <td className="py-2 pr-3 text-text-muted">{t.ts}</td>
              <td className="py-2 pr-3">
                <span className={`flex items-center gap-1 ${t.side === 'LONG' ? 'text-accent-green' : 'text-accent-red'}`}>
                  {t.side === 'LONG' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {t.side}
                </span>
              </td>
              <td className="py-2 pr-3 text-right text-text-secondary">{t.entry}</td>
              <td className="py-2 pr-3 text-right text-text-secondary">{t.exit}</td>
              <td className={`py-2 text-right font-medium ${parseFloat(t.pnlUsd) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                {parseFloat(t.pnlUsd) >= 0 ? '+' : ''}${t.pnlUsd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
