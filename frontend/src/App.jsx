import React, { useState } from 'react'
import { Activity, Settings, List, BarChart2, Wifi, WifiOff } from 'lucide-react'
import { useWebSocket } from './hooks/useWebSocket'
import MetricCard    from './components/MetricCard'
import ValueAreaBar  from './components/ValueAreaBar'
import SignalPanel   from './components/SignalPanel'
import PriceChart    from './components/PriceChart'
import TradeLog      from './components/TradeLog'
import LiveLog       from './components/LiveLog'
import ConfigPanel   from './components/ConfigPanel'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', Icon: BarChart2 },
  { id: 'trades',    label: 'Trades',    Icon: List },
  { id: 'config',    label: 'Config',    Icon: Settings },
]

function fmt(n) {
  if (n == null || isNaN(n)) return '—'
  if (n >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (n >= 100)   return n.toFixed(2)
  if (n >= 1)     return n.toFixed(3)
  return n.toFixed(5)
}

export default function App() {
  const { state, connected, sendConfig, configAck, pending } = useWebSocket()
  const [tab, setTab] = useState('dashboard')

  const {
    running = false, symbol = '—', timeframe = '—',
    price = null, pnl = 0, tradeCount = 0, winRate = 0,
    vah = null, val = null, poc = null, posInRange = null,
    signal = null, bias = null, zone = null,
    entry = null, sl = null, tp = null, qty = null, atr = null,
    vwap = null, vwapAligned = null,
    signalReason = '',
    priceHistory = [], trades = [], logs = [],
    activeConfig = null,
  } = state || {}

  return (
    <div className="noise min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-bg-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-accent-teal/20 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-accent-teal" />
            </div>
            <span className="font-display font-semibold text-sm tracking-tight">VAP Range Bot</span>
            <span className="text-text-muted text-[11px] font-mono hidden sm:block">/ {symbol} · {timeframe}m · Bybit</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {connected ? <Wifi className="w-3.5 h-3.5 text-accent-teal" /> : <WifiOff className="w-3.5 h-3.5 text-text-muted" />}
              <span className="text-[11px] font-mono text-text-secondary">
                {connected ? 'connected' : 'waiting for bot...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${running ? 'bg-accent-green glow-dot' : 'bg-text-muted'}`} />
              <span className="text-[11px] font-mono text-text-secondary">{running ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {!connected && (
          <div className="card p-4 border-accent-amber/20 bg-accent-amber/5 text-accent-amber text-sm font-mono flex items-center gap-3">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>Run: <code className="text-text-primary bg-bg-secondary px-2 py-0.5 rounded text-xs">cd bot && python bot.py</code></span>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Price"
            value={price ? price.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
            sub={bias ? bias.toLowerCase() + ' market' : 'not running'}
            valueClass={bias === 'BALANCED' ? 'text-accent-teal' : bias === 'IMBALANCED' ? 'text-accent-amber' : 'text-text-secondary'}
          />
          <MetricCard
            label="Signal"
            value={signal ?? '—'}
            sub={zone ? zone.replace(/_/g, ' ').toLowerCase() : '—'}
            valueClass={signal === 'LONG' ? 'text-accent-green' : signal === 'SHORT' ? 'text-accent-red' : signal === 'NO_TRADE' ? 'text-accent-amber' : 'text-text-secondary'}
          />
          <MetricCard
            label={`VWAP${activeConfig?.USE_VWAP ? '' : ' (off)'}`}
            value={fmt(vwap)}
            sub={vwapAligned === true ? 'aligned ✓' : vwapAligned === false ? 'not aligned' : activeConfig?.USE_VWAP ? 'checking...' : 'disabled'}
            valueClass={vwapAligned === true ? 'text-accent-green' : vwapAligned === false ? 'text-accent-red' : 'text-text-secondary'}
          />
          <MetricCard
            label="P&L today"
            value={`$${(pnl || 0).toFixed(2)}`}
            sub={`${tradeCount} trades · ${winRate}% WR`}
            valueClass={pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}
            glow={pnl > 0 ? 'card-glow-green' : pnl < 0 ? 'card-glow-red' : ''}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-bg-border">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-medium border-b-2 transition-all -mb-px
                ${tab === id ? 'border-accent-teal text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-slide-up">
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="label">Price · {symbol}</span>
                  <div className="flex items-center gap-3">
                    {vwap && <span className="text-[10px] font-mono text-accent-amber">VWAP {fmt(vwap)}</span>}
                    <span className="text-[10px] font-mono text-text-muted">{timeframe}m</span>
                  </div>
                </div>
                <PriceChart priceHistory={priceHistory} vah={vah} val={val} poc={poc} />
              </div>

              <div className="card p-5">
                <div className="label mb-4">Value area (previous day)</div>
                <ValueAreaBar vah={vah} val={val} poc={poc} price={price} fmt={fmt} />
                <div className="grid grid-cols-4 gap-3 mt-5">
                  {[
                    { label: 'VAH',      value: fmt(vah),  color: 'text-accent-red' },
                    { label: 'POC',      value: fmt(poc),  color: 'text-accent-amber' },
                    { label: 'VAL',      value: fmt(val),  color: 'text-accent-green' },
                    { label: 'Range pos', value: posInRange != null ? `${posInRange}%` : '—', color: 'text-text-primary' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-bg-secondary rounded-lg p-3 border border-bg-border">
                      <div className="label mb-1">{label}</div>
                      <div className={`text-xs font-mono font-medium ${color}`}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <div className="label mb-3">Live log</div>
                <LiveLog logs={logs} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5">
                <div className="label mb-3">Signal</div>
                <SignalPanel signal={signal} zone={zone} bias={bias} entry={entry} sl={sl} tp={tp}
                  vwap={vwap} vwapAligned={vwapAligned} fmt={fmt} running={running} />
                {signalReason && (
                  <p className="text-[10px] text-text-muted font-mono mt-3 pt-3 border-t border-bg-border leading-relaxed">
                    {signalReason}
                  </p>
                )}
              </div>

              <div className="card p-5">
                <div className="label mb-3">Sizing</div>
                {[
                  { label: 'Qty',     value: qty ? `${qty} ${symbol?.replace('USDT','')}` : '—' },
                  { label: 'ATR(14)', value: fmt(atr) },
                  { label: 'SL dist', value: activeConfig ? `${activeConfig.ATR_SL_MULT}× ATR` : '—' },
                  { label: 'TP dist', value: activeConfig ? `${(activeConfig.TP_VA_MULT * 100).toFixed(0)}% VA` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-bg-border last:border-0 text-xs font-mono">
                    <span className="text-text-muted">{label}</span>
                    <span className="text-text-primary">{value}</span>
                  </div>
                ))}
              </div>

              <div className="card p-5">
                <div className="label mb-3">Recent trades</div>
                <TradeLog trades={trades.slice(0, 6)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'trades' && (
          <div className="animate-slide-up card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="label">Trade history</span>
              <span className="text-[11px] font-mono text-text-muted">{trades.length} total</span>
            </div>
            <TradeLog trades={trades} />
          </div>
        )}

        {tab === 'config' && (
          <div className="animate-slide-up">
            <ConfigPanel
              activeConfig={activeConfig}
              sendConfig={sendConfig}
              configAck={configAck}
              pending={pending}
              connected={connected}
            />
          </div>
        )}
      </main>
    </div>
  )
}
