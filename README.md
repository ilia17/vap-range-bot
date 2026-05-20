# VAP Range Bot v4 — Python + React + Session VWAP

## What changed in v4

**Session-anchored VWAP** — VWAP now resets at 00:00 UTC every day.

Previously VWAP was calculated over a rolling window of recent candles,
which made the number meaningless (averaging prices across multiple sessions).
Now it only uses candles from the current UTC session, so it always reflects
today's fair value — which is what VWAP is actually for.

Files changed:
- `bot/indicators.py` — `session_vwap()`, `latest_session_vwap()`, `session_vwap_bands()`
- `bot/strategy.py`   — calls `latest_session_vwap()` instead of `latest_vwap()`
- `bot/exchange.py`   — `datetime` column is now explicitly naive UTC

## Architecture

```
Python bot (bot/)              WebSocket (ws://localhost:8765)     React (frontend/)
─────────────────              ──────────────────────────────      ─────────────────
bot.py          ←─── broadcasts state JSON ──────────────────→    App.jsx
config.py       ←─── receives config_update ─────────────────←    ConfigPanel.jsx
strategy.py          (live reconfiguration, no restart needed)     SignalPanel.jsx
value_area.py                                                       PriceChart.jsx
indicators.py                                                       TradeLog.jsx
exchange.py                                                         LiveLog.jsx
server.py
```

## Quick start

```bash
# Terminal 1 — Python bot
cd bot
pip install -r requirements.txt
cp .env.example .env    # add Bybit API key + secret
python bot.py

# Terminal 2 — Dashboard
cd frontend
npm install
npm run dev             # http://localhost:5173
```

## Session VWAP logic

VWAP anchors to **00:00 UTC** each day.

| Condition | Meaning |
|-----------|---------|
| price > session VWAP | Price above today's fair value → bullish bias |
| price < session VWAP | Price below today's fair value → bearish bias |

With `USE_VWAP = True` in config:
- **LONG** fires only when: discount zone **AND** price > session VWAP
- **SHORT** fires only when: premium zone **AND** price < session VWAP
- Zone hit but wrong VWAP side → `WAIT` with reason in the log

Toggle VWAP on/off from the dashboard Config tab at any time.

## Live reconfiguration

All settings in the Config tab are pushed live to the Python bot via WebSocket.
No restart needed. Symbol/timeframe changes trigger an automatic VA refresh.

## Debugging Python

```bash
# Test session VWAP in isolation
python -c "
import pandas as pd
from indicators import session_vwap, latest_session_vwap
# candles must have 'datetime' column (naive UTC), 'high', 'low', 'close', 'volume'
df = pd.read_csv('your_candles.csv', parse_dates=['datetime'])
print(latest_session_vwap(df))
"

# Test full signal pipeline
python -c "
from value_area import ValueArea
from strategy import BalancedMarketStrategy
import pandas as pd

va = ValueArea(vah=105000, val=103000, poc=104000)
# minimal candles with datetime
import numpy as np
from datetime import datetime, timezone
now = datetime.now(timezone.utc).replace(tzinfo=None)
df = pd.DataFrame({
    'datetime': pd.date_range(end=now, periods=50, freq='15min'),
    'high':  np.random.uniform(103500, 104500, 50),
    'low':   np.random.uniform(103000, 104000, 50),
    'close': np.random.uniform(103200, 104200, 50),
    'volume':np.random.uniform(100, 500, 50),
})
sig = BalancedMarketStrategy().evaluate(df, va, account_balance=1000)
print(sig)
"
```

## Adding imbalanced market rules

Open `bot/strategy.py`, find `# ── Imbalanced market` and replace
the `NO_TRADE` return with your logic. Nothing else changes.
