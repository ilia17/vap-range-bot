"""
config.py — All bot settings.

These are the DEFAULT values. The frontend can override any of them
at runtime by sending a "config_update" message over WebSocket.
Changes made from the dashboard persist in memory until the bot restarts.
"""

# ── Bybit credentials ─────────────────────────────────────────────────────────
API_KEY    = ""
API_SECRET = ""
TESTNET    = True

# ── Instrument ────────────────────────────────────────────────────────────────
SYMBOL     = "BTCUSDT"
CATEGORY   = "linear"
TIMEFRAME  = "15"          # "5" or "15"

# ── Value Area ────────────────────────────────────────────────────────────────
VA_PERCENT           = 0.70   # % of volume defining the value area
DISCOUNT_ZONE_PCT    = 0.15   # VAL + this × width → long zone threshold
PREMIUM_ZONE_PCT     = 0.15   # VAH − this × width → short zone threshold
BREAKOUT_CONFIRM_CANDLES = 2  # closes outside VA before treating as imbalanced

# ── VWAP ──────────────────────────────────────────────────────────────────────
USE_VWAP             = True   # require VWAP alignment for entries
# Long  valid only when price > VWAP (price above fair value = bullish)
# Short valid only when price < VWAP (price below fair value = bearish)

# ── Risk & Sizing ─────────────────────────────────────────────────────────────
ATR_PERIOD   = 14
ATR_SL_MULT  = 1.5      # SL = entry ± ATR × this
TP_VA_MULT   = 0.70     # TP = entry ± VA_width × this
MAX_RISK_PCT = 0.01     # max risk per trade as fraction of balance

# ── WebSocket server ──────────────────────────────────────────────────────────
WS_HOST = "localhost"
WS_PORT = 8765
