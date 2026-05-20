# VAP Range Bot

A crypto trading bot built on **Market Profile** (Value Area) and **session-anchored VWAP**.
Python handles all strategy logic. React displays it. They talk over a local WebSocket.

---

## Table of contents

1. [How the strategy works](#how-the-strategy-works)
2. [Project structure](#project-structure)
3. [Setup & running](#setup--running)
4. [Configuration](#configuration)
5. [Live reconfiguration from the dashboard](#live-reconfiguration-from-the-dashboard)
6. [How the code is organised](#how-the-code-is-organised)
7. [Debugging & testing](#debugging--testing)
8. [Adding imbalanced market rules](#adding-imbalanced-market-rules)
9. [Bybit API key setup](#bybit-api-key-setup)

---

## How the strategy works

### Step 1 — Build the value area from the previous day

Every day at startup, the bot fetches the last 96 × 15m candles (= 24 hours) and builds a **volume profile** — a histogram of how much volume traded at each price level.

From that it extracts three numbers:

| Level | Meaning |
|-------|---------|
| **POC** (Point of Control) | Price with the highest traded volume — the fairest price of the day |
| **VAH** (Value Area High) | Upper boundary of the zone where 70% of volume traded |
| **VAL** (Value Area Low) | Lower boundary of that same zone |

The space between VAL and VAH is the **value area** — where the market spent most of its time and accepted price. These levels carry forward into the next day as reference.

### Step 2 — Classify the market

At the start of each candle, the bot checks where price is relative to the previous day's value area:

| Price location | Market bias | Action |
|----------------|-------------|--------|
| Inside VA (VAL → VAH) | **BALANCED** | Trade the range |
| Outside VA for < 2 candles | Transitional | Wait — not yet confirmed |
| Outside VA for ≥ 2 candles | **IMBALANCED** | No trade — range logic doesn't apply |

A balanced market means price is being accepted inside the prior day's range. Buyers and sellers are in equilibrium. The edge is to fade the extremes and take profit quickly — not to chase breakouts.

### Step 3 — Identify the zone

Inside a balanced market, the value area is divided into three zones:

```
  VAH ──────────────────────────────────  ← short zone starts here
       ████ PREMIUM ZONE (top 15%)  ████
  ─────────────────────────────────────
       ░░░░ MID-RANGE (no edge) ░░░░░░░
  ─────────────────────────────────────
       ████ DISCOUNT ZONE (bot 15%) ████
  VAL ──────────────────────────────────  ← long zone ends here
```

- **Discount zone**: price ≤ VAL + 15% of VA width → look for longs
- **Premium zone**: price ≥ VAH − 15% of VA width → look for shorts
- **Mid-range**: no trade — price has no structural reason to reverse here

### Step 4 — VWAP confirmation (optional, on by default)

Before taking a signal, the bot checks the **session VWAP** (Volume Weighted Average Price, anchored to 00:00 UTC and reset every day). This is the average price weighted by volume — a dynamic measure of today's fair value.

| Signal | VWAP requirement |
|--------|-----------------|
| LONG (discount zone) | Price must be **above** session VWAP |
| SHORT (premium zone) | Price must be **below** session VWAP |

If the zone is right but price is on the wrong side of VWAP, the bot waits. This filters out situations where, for example, price dips to the discount zone but the whole session is bearish — the VWAP tells you that.

VWAP can be toggled on/off from the dashboard at any time.

### Step 5 — Calculate entry, stop, and target

When a signal fires:

```
LONG
  Entry  = current price
  Stop   = entry − (ATR × ATR_SL_MULT)         default: 1× ATR below
  Target = entry + (VA_width × TP_VA_MULT)      default: 70% of VA width above

SHORT
  Entry  = current price
  Stop   = entry + (ATR × ATR_SL_MULT)
  Target = entry − (VA_width × TP_VA_MULT)
```

**ATR** (Average True Range over 14 periods) measures recent volatility. Using it for the stop means the stop automatically widens in choppy markets and tightens in calm ones.

**Target = 70% of VA width** keeps the take profit realistic for range logic. You are not expecting a trend — you are fading an extreme and taking profit before the other side of the range. Do not set this above 1.0.

### Step 6 — Position sizing

The bot never risks more than `MAX_RISK_PCT` (default 1%) of the account balance per trade.

```
risk_per_trade = account_balance × MAX_RISK_PCT
qty            = risk_per_trade / |entry − stop|
```

A wider stop (high ATR) means a smaller position. A tighter stop means a larger one. The dollar risk stays constant regardless of volatility.

---

## Project structure

```
vap-bot-v4/
│
├── bot/                        ← All strategy logic (Python)
│   ├── bot.py                  ← Main loop — this is what you run
│   ├── config.py               ← All settings in one place
│   ├── strategy.py             ← Signal generation (LONG / SHORT / WAIT / NO_TRADE)
│   ├── value_area.py           ← VAH / VAL / POC calculation from volume profile
│   ├── indicators.py           ← ATR, session VWAP, position sizing
│   ├── exchange.py             ← All Bybit API calls (data fetching + order placement)
│   ├── server.py               ← WebSocket server — feeds dashboard, receives config
│   ├── requirements.txt        ← Python dependencies
│   └── .env.example            ← Template for API keys
│
└── frontend/                   ← Dashboard (React — display only, zero logic)
    ├── src/
    │   ├── App.jsx             ← Main layout, tabs, metric cards
    │   ├── hooks/
    │   │   └── useWebSocket.js ← Connects to Python, receives state, sends config
    │   └── components/
    │       ├── ConfigPanel.jsx ← Full settings UI — sends config_update to Python
    │       ├── SignalPanel.jsx ← Current signal, VWAP status, entry/SL/TP levels
    │       ├── PriceChart.jsx  ← Price chart with VAH/VAL/POC reference lines
    │       ├── ValueAreaBar.jsx← Visual range bar showing where price is in the VA
    │       ├── TradeLog.jsx    ← Trade history table
    │       ├── LiveLog.jsx     ← Real-time event log from the bot
    │       └── MetricCard.jsx  ← Reusable stat card component
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```

---

## Setup & running

### Requirements

- Python 3.10+
- Node.js 18+

### 1. Set up the Python bot

```bash
cd bot

# Install dependencies
pip install -r requirements.txt

# Set up your API keys
cp .env.example .env
# Edit .env and add your Bybit API key and secret
```

### 2. Start the bot

```bash
python bot.py
```

You will see output like:

```
08:14:22  INFO      bot     Bot started — BTCUSDT 15m
08:14:22  INFO      bot     Balance: 1250.00 USDT  |  Testnet: True
08:14:23  INFO      bot     VA → VAH 104820.00  POC 104210.00  VAL 103540.00
08:14:23  INFO      server  WebSocket listening on ws://localhost:8765
```

### 3. Start the dashboard (separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The dashboard connects automatically to the bot.
If the bot isn't running, you'll see a "waiting for bot..." banner.

---

## Configuration

All default settings are in `bot/config.py`. You can edit this file before starting the bot, or change everything live from the dashboard.

| Setting | Default | Description |
|---------|---------|-------------|
| `SYMBOL` | `BTCUSDT` | Bybit USDT perpetual symbol |
| `TIMEFRAME` | `15` | Candle timeframe in minutes (`5` or `15`) |
| `TESTNET` | `True` | Set `False` for live trading |
| `VA_PERCENT` | `0.70` | Fraction of volume defining the value area (70% is the Market Profile standard) |
| `DISCOUNT_ZONE_PCT` | `0.15` | Long zone upper boundary = VAL + (width × this) |
| `PREMIUM_ZONE_PCT` | `0.15` | Short zone lower boundary = VAH − (width × this) |
| `BREAKOUT_CONFIRM_CANDLES` | `2` | Consecutive closes outside VA before treating as imbalanced |
| `USE_VWAP` | `True` | Require VWAP alignment for entries |
| `ATR_PERIOD` | `14` | ATR lookback period |
| `ATR_SL_MULT` | `1.5` | Stop loss = entry ± (ATR × this) |
| `TP_VA_MULT` | `0.70` | Take profit = entry ± (VA width × this) — keep below 1.0 for range logic |
| `MAX_RISK_PCT` | `0.01` | Maximum fraction of account balance risked per trade (1%) |
| `WS_HOST` | `localhost` | WebSocket server host |
| `WS_PORT` | `8765` | WebSocket server port |

---

## Live reconfiguration from the dashboard

Every setting listed above can be changed from the **Config tab** in the dashboard — no restart needed.

The flow works like this:

1. You change a value in the Config tab and click **Apply to bot**
2. The frontend sends a JSON message over the WebSocket:
   `{ "type": "config_update", "payload": { "ATR_SL_MULT": 2.0, "USE_VWAP": false } }`
3. Python validates and type-coerces each field, then applies them directly to the live `config` module
4. Python sends back an acknowledgement with what was applied and what was rejected
5. The dashboard shows "Applied: ATR_SL_MULT=2.0, USE_VWAP=False"

**Special cases:**
- If you change `SYMBOL` or `TIMEFRAME`, the bot detects this and resets the value area calculation on the next tick. You will see a log entry: `Symbol changed → ETHUSDT, refreshing VA`
- Config changes persist in memory until the bot restarts. To make them permanent, update `config.py` as well.
- Fields not in the allowed list are rejected silently. API keys are accepted but only used for the next order placement.

---

## How the code is organised

The Python side is split into single-responsibility files with no circular dependencies:

```
config.py       ← read by everyone, written to by server.py on config updates
value_area.py   ← pure math, no imports except config + numpy/pandas
indicators.py   ← pure math, no imports except config + numpy/pandas
strategy.py     ← imports value_area + indicators + config. No Bybit.
exchange.py     ← all Bybit calls. No strategy logic.
server.py       ← WebSocket I/O. Imports config. No strategy logic.
bot.py          ← imports everything and wires it together.
```

This means you can test `value_area.py`, `indicators.py`, and `strategy.py` in complete isolation without a Bybit connection, a running server, or a dashboard.

The React frontend has zero business logic. `useWebSocket.js` connects to Python and exposes `state` (everything Python broadcasts) and `sendConfig()` (sends a config update). Every component just renders what it receives.

---

## Debugging & testing

### Test the value area calculation

```python
from value_area import calculate_value_area
import pandas as pd

# Load your own candle data — needs columns: high, low, close, volume
df = pd.read_csv("candles.csv")
va = calculate_value_area(df)

print(f"VAH: {va.vah}")
print(f"POC: {va.poc}")
print(f"VAL: {va.val}")
print(f"Width: {va.width}")
print(f"Zone for price 104000: {va.classify_zone(104000)}")
print(f"Bias for price 104000: {va.market_bias(104000)}")
```

### Test the session VWAP

```python
from indicators import latest_session_vwap, session_vwap_bands
import pandas as pd

# candles must have: datetime (naive UTC), high, low, close, volume
df = pd.read_csv("candles.csv", parse_dates=["datetime"])
print(f"Session VWAP: {latest_session_vwap(df)}")

bands = session_vwap_bands(df)
print(f"VWAP:    {bands['vwap'].iloc[-1]:.2f}")
print(f"+1σ:     {bands['upper_1.0'].iloc[-1]:.2f}")
print(f"-1σ:     {bands['lower_1.0'].iloc[-1]:.2f}")
```

### Test the full signal pipeline

```python
from value_area import ValueArea
from strategy import BalancedMarketStrategy
import pandas as pd, numpy as np
from datetime import datetime, timezone

# Build a minimal candle DataFrame for today's session
now = datetime.now(timezone.utc).replace(tzinfo=None)
df = pd.DataFrame({
    "datetime": pd.date_range(end=now, periods=50, freq="15min"),
    "high":     np.random.uniform(103500, 105000, 50),
    "low":      np.random.uniform(103000, 104500, 50),
    "close":    np.random.uniform(103200, 104800, 50),
    "volume":   np.random.uniform(100, 500, 50),
})

va      = ValueArea(vah=105000, val=103000, poc=104000)
signal  = BalancedMarketStrategy().evaluate(df, va, account_balance=1000.0)

print(f"Signal:  {signal.signal}")
print(f"Bias:    {signal.bias}")
print(f"Zone:    {signal.zone}")
print(f"VWAP:    {signal.vwap:.2f}")
print(f"Aligned: {signal.vwap_aligned}")
print(f"Reason:  {signal.reason}")
if signal.is_actionable():
    print(f"Entry: {signal.entry:.2f}  SL: {signal.sl:.2f}  TP: {signal.tp:.2f}  Qty: {signal.qty}")
```

### Reading the live log

The bot prints a structured log line for every candle:

```
08:14:30  INFO  bot  [BALANCED] DISCOUNT → LONG @ 103420.50 | VWAP 104100.00 ✓
08:14:30  INFO  bot  Placing LONG: entry=103420.50 sl=102850.30 tp=104076.50 qty=0.019
08:14:30  INFO  bot  Order placed: 1234567890abcdef
```

The bracket shows market bias, then zone, then the signal and price. VWAP status is shown as ✓ (aligned), ✗ (not aligned), or − (VWAP disabled).

---

## Adding imbalanced market rules

The imbalanced market path is clearly marked in `bot/strategy.py`:

```python
# ── Imbalanced market — no range trade ────────────────────────────────
if bias == "IMBALANCED" and confirmed_imbalanced:
    return Signal(
        signal="NO_TRADE", bias="IMBALANCED", zone=zone,
        ...
    )
```

Replace that `return` with your imbalanced logic (e.g. trend-following entries, breakout continuation, momentum signals). The rest of the bot — position sizing, order placement, dashboard display — does not need to change.

The `zone` variable tells you which side the breakout is on:
- `ABOVE_VA` — price broke above VAH → potential long continuation
- `BELOW_VA` — price broke below VAL → potential short continuation

---

## Bybit API key setup

### Creating the key

1. Log in to Bybit → **Account & Security** → **API Management**
2. Create a new API key with **only** the `Trade` permission enabled
3. **Never enable withdrawals** on a bot key
4. Use a **sub-account** if possible — this limits blast radius if the key is compromised

### Storing the key

Create `bot/.env`:

```
BYBIT_API_KEY=your_api_key_here
BYBIT_SECRET=your_api_secret_here
```

The bot loads this automatically via `python-dotenv`. The key is never written to disk beyond this file and never sent anywhere except Bybit's API.

Alternatively set `API_KEY` and `API_SECRET` directly in `config.py`, but do not commit that file to git.

### Testnet first

`TESTNET = True` in `config.py` by default. The Bybit testnet is a fully functional sandbox with fake money. Test everything there before switching to live. To get testnet funds, visit [testnet.bybit.com](https://testnet.bybit.com) and use the faucet.

Switch to live trading by setting `TESTNET = False` in the Config tab or in `config.py`.