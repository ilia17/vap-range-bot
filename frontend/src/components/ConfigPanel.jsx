/**
 * ConfigPanel.jsx
 *
 * Full config panel. Reads activeConfig from Python state,
 * lets the user edit everything, and sends changes via sendConfig().
 * Python applies changes live — no restart needed (unless symbol changes).
 */

import React, { useState, useEffect } from 'react'
import { Save, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react'

const SYMBOLS    = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT']
const TIMEFRAMES = [{ value: '5', label: '5m' }, { value: '15', label: '15m' }]

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="label">{label}</label>
        {hint && (
          <div className="group relative">
            <Info className="w-3 h-3 text-text-muted cursor-help" />
            <div className="absolute left-0 bottom-6 w-48 bg-bg-card border border-bg-border rounded-lg p-2 text-[10px] text-text-secondary font-mono hidden group-hover:block z-10 leading-relaxed">
              {hint}
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none
        ${value ? 'bg-accent-teal' : 'bg-bg-border'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200
        ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function NumberInput({ value, onChange, min, max, step = 0.01, disabled }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step}
      disabled={disabled}
      className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-xs font-mono
        text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal/50
        disabled:opacity-40 disabled:cursor-not-allowed"
    />
  )
}

export default function ConfigPanel({ activeConfig, sendConfig, configAck, pending, connected }) {
  // Local draft — user edits here before hitting Apply
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)

  // Sync draft when Python pushes a new activeConfig
  useEffect(() => {
    if (activeConfig && !dirty) {
      setDraft({ ...activeConfig })
    }
  }, [activeConfig, dirty])

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-32 text-text-muted text-xs font-mono">
        {connected ? 'Loading config from bot...' : 'Start the Python bot to configure'}
      </div>
    )
  }

  const set = (key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const handleApply = () => {
    sendConfig(draft)
    setDirty(false)
  }

  const handleReset = () => {
    setDraft({ ...activeConfig })
    setDirty(false)
  }

  const symbolChanged = draft.SYMBOL !== activeConfig?.SYMBOL || draft.TIMEFRAME !== activeConfig?.TIMEFRAME

  return (
    <div className="space-y-4">
      {/* Apply bar */}
      <div className={`card p-3 flex items-center justify-between transition-all
        ${dirty ? 'border-accent-amber/30 bg-accent-amber/5' : 'border-bg-border'}`}>
        <div className="flex items-center gap-2 text-xs font-mono">
          {pending ? (
            <><RefreshCw className="w-3.5 h-3.5 text-accent-amber animate-spin" /><span className="text-accent-amber">Applying...</span></>
          ) : configAck?.applied?.length > 0 && !dirty ? (
            <><CheckCircle className="w-3.5 h-3.5 text-accent-green" /><span className="text-accent-green">Applied: {configAck.applied.join(', ')}</span></>
          ) : dirty ? (
            <><AlertCircle className="w-3.5 h-3.5 text-accent-amber" /><span className="text-accent-amber">Unsaved changes</span></>
          ) : (
            <span className="text-text-muted">No pending changes</span>
          )}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button onClick={handleReset} className="btn btn-ghost text-[11px] py-1.5 px-3">
              Reset
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={!dirty || pending || !connected}
            className="btn btn-primary text-[11px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40"
          >
            <Save className="w-3 h-3" />
            Apply to bot
          </button>
        </div>
      </div>

      {symbolChanged && dirty && (
        <div className="card p-3 border-accent-amber/30 bg-accent-amber/5 text-[11px] font-mono text-accent-amber flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Symbol or timeframe changed — the bot will reset the value area on apply.
        </div>
      )}

      {/* Instrument */}
      <div className="card p-5">
        <div className="label mb-4">Instrument</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Symbol">
            <select
              value={draft.SYMBOL}
              onChange={e => set('SYMBOL', e.target.value)}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-teal/50"
            >
              {SYMBOLS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Timeframe">
            <div className="flex gap-2">
              {TIMEFRAMES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set('TIMEFRAME', value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-colors
                    ${draft.TIMEFRAME === value
                      ? 'bg-accent-teal/10 border-accent-teal/30 text-accent-teal'
                      : 'bg-bg-secondary border-bg-border text-text-secondary hover:text-text-primary'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* Value area */}
      <div className="card p-5">
        <div className="label mb-4">Value area</div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="VA percent" hint="% of total day volume defining the value area. Standard = 70%.">
            <NumberInput value={draft.VA_PERCENT} onChange={v => set('VA_PERCENT', v)} min={0.5} max={0.95} step={0.05} />
          </Field>
          <Field label="Discount zone %" hint="VAL + (width × this) = long zone upper boundary.">
            <NumberInput value={draft.DISCOUNT_ZONE_PCT} onChange={v => set('DISCOUNT_ZONE_PCT', v)} min={0.05} max={0.4} step={0.05} />
          </Field>
          <Field label="Premium zone %" hint="VAH − (width × this) = short zone lower boundary.">
            <NumberInput value={draft.PREMIUM_ZONE_PCT} onChange={v => set('PREMIUM_ZONE_PCT', v)} min={0.05} max={0.4} step={0.05} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Breakout confirm candles" hint="Consecutive closes outside VA before treating market as imbalanced.">
            <NumberInput value={draft.BREAKOUT_CONFIRM_CANDLES} onChange={v => set('BREAKOUT_CONFIRM_CANDLES', parseInt(v))} min={1} max={10} step={1} />
          </Field>
        </div>
      </div>

      {/* VWAP */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">VWAP confirmation</div>
            <div className="text-[11px] text-text-muted font-mono mt-0.5">
              Require price to be on the correct side of VWAP before entering
            </div>
          </div>
          <Toggle value={draft.USE_VWAP} onChange={v => set('USE_VWAP', v)} />
        </div>
        <div className={`grid grid-cols-2 gap-3 text-[11px] font-mono transition-opacity ${draft.USE_VWAP ? 'opacity-100' : 'opacity-30'}`}>
          <div className="bg-accent-green/8 border border-accent-green/15 rounded-lg p-3">
            <div className="text-accent-green font-medium mb-1">LONG filter</div>
            <div className="text-text-muted">Discount zone <strong className="text-text-secondary">AND</strong> price &gt; VWAP</div>
          </div>
          <div className="bg-accent-red/8 border border-accent-red/15 rounded-lg p-3">
            <div className="text-accent-red font-medium mb-1">SHORT filter</div>
            <div className="text-text-muted">Premium zone <strong className="text-text-secondary">AND</strong> price &lt; VWAP</div>
          </div>
        </div>
      </div>

      {/* Risk */}
      <div className="card p-5">
        <div className="label mb-4">Risk & sizing</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ATR period" hint="Lookback for Average True Range calculation.">
            <NumberInput value={draft.ATR_PERIOD} onChange={v => set('ATR_PERIOD', parseInt(v))} min={5} max={50} step={1} />
          </Field>
          <Field label="ATR SL multiplier" hint="Stop = entry ± (ATR × this). Higher = wider stop.">
            <NumberInput value={draft.ATR_SL_MULT} onChange={v => set('ATR_SL_MULT', v)} min={0.5} max={5} step={0.1} />
          </Field>
          <Field label="TP VA multiplier" hint="Take profit = entry ± (VA width × this). Keep < 1 for range logic.">
            <NumberInput value={draft.TP_VA_MULT} onChange={v => set('TP_VA_MULT', v)} min={0.2} max={1.5} step={0.05} />
          </Field>
          <Field label="Max risk per trade" hint="Fraction of account balance risked per trade. 0.01 = 1%.">
            <NumberInput value={draft.MAX_RISK_PCT} onChange={v => set('MAX_RISK_PCT', v)} min={0.001} max={0.05} step={0.001} />
          </Field>
        </div>

        {/* Risk preview */}
        <div className="mt-4 bg-bg-secondary rounded-lg p-3 border border-bg-border text-[11px] font-mono space-y-1">
          <div className="text-text-muted mb-2 uppercase tracking-wider text-[10px]">Live preview</div>
          <div className="flex justify-between">
            <span className="text-text-muted">Risk per trade (1000 USDT balance)</span>
            <span className="text-text-primary">${(1000 * draft.MAX_RISK_PCT).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">SL distance (1× ATR example)</span>
            <span className="text-text-primary">{draft.ATR_SL_MULT}× ATR</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">TP target</span>
            <span className="text-text-primary">{(draft.TP_VA_MULT * 100).toFixed(0)}% of VA width</span>
          </div>
        </div>
      </div>

      {/* API / Testnet */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="label">Testnet mode</div>
            <div className="text-[11px] text-text-muted font-mono mt-0.5">
              {draft.TESTNET ? 'Using Bybit testnet — no real money' : '⚠ LIVE TRADING — real funds at risk'}
            </div>
          </div>
          <Toggle value={draft.TESTNET} onChange={v => set('TESTNET', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="API key">
            <input
              type="password"
              placeholder="bybit api key"
              value={draft.API_KEY || ''}
              onChange={e => set('API_KEY', e.target.value)}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal/50"
            />
          </Field>
          <Field label="API secret">
            <input
              type="password"
              placeholder="bybit api secret"
              value={draft.API_SECRET || ''}
              onChange={e => set('API_SECRET', e.target.value)}
              className="w-full bg-bg-secondary border border-bg-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal/50"
            />
          </Field>
        </div>
        <p className="text-[10px] text-text-muted font-mono mt-3">
          Keys sent over local WebSocket only. Use a sub-account with Trade permission — never enable withdrawals on a bot key.
        </p>
      </div>
    </div>
  )
}
