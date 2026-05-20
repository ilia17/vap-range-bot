"""
indicators.py — ATR, session-anchored VWAP, position sizing.
Pure functions — no side effects, no Bybit dependency.
"""

import pandas as pd
import numpy as np
import config


# ── ATR ───────────────────────────────────────────────────────────────────────

def atr(candles: pd.DataFrame, period: int = None) -> pd.Series:
    """Wilder's ATR as a Series aligned to candles index."""
    period = period or config.ATR_PERIOD
    high, low, close = candles["high"], candles["low"], candles["close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low  - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()


def latest_atr(candles: pd.DataFrame, period: int = None) -> float:
    """Single most-recent ATR value."""
    s = atr(candles, period)
    if s.empty or pd.isna(s.iloc[-1]):
        return float((candles["high"] - candles["low"]).mean())
    return float(s.iloc[-1])


# ── VWAP (session-anchored) ───────────────────────────────────────────────────

def _raw_vwap(candles: pd.DataFrame) -> pd.Series:
    """
    Core VWAP math on an arbitrary slice.
    VWAP = cumsum(typical_price × volume) / cumsum(volume)
    Typical price = (high + low + close) / 3
    """
    tp  = (candles["high"] + candles["low"] + candles["close"]) / 3
    vol = candles["volume"]
    cum_tpv = (tp * vol).cumsum()
    cum_vol = vol.cumsum()
    return cum_tpv / cum_vol.replace(0, np.nan)


def session_vwap(candles: pd.DataFrame) -> pd.Series:
    """
    Session-anchored VWAP — resets at 00:00 UTC each day.

    Filters candles to today's UTC session before computing,
    so the number always reflects the current day's fair value.

    Requires candles to have a 'datetime' column (UTC-aware or naive UTC).
    Falls back to full-series VWAP if datetime column is missing.
    """
    if "datetime" not in candles.columns:
        # Fallback: no datetime info, use full series (shouldn't happen in prod)
        return _raw_vwap(candles)

    # Anchor: midnight UTC today
    today_utc = pd.Timestamp.utcnow().normalize().tz_localize(None)  # naive UTC

    # Normalise datetime column to naive UTC for comparison
    dt = candles["datetime"]
    if dt.dt.tz is not None:
        dt = dt.dt.tz_convert("UTC").dt.tz_localize(None)

    session_mask = dt >= today_utc
    session      = candles[session_mask].copy()

    if session.empty:
        # No candles yet for today's session (e.g. bot started at exactly midnight)
        # Fall back to last N candles so the dashboard isn't blank
        session = candles.tail(20).copy()

    result = _raw_vwap(session)

    # Re-index back to full candles index so callers get a consistently-sized Series
    return result.reindex(candles.index)


def latest_session_vwap(candles: pd.DataFrame) -> float:
    """Single most-recent session VWAP value."""
    s = session_vwap(candles)
    # Drop NaN (pre-session candles) and take last valid value
    valid = s.dropna()
    if valid.empty:
        return float(candles["close"].iloc[-1])
    return float(valid.iloc[-1])


def session_vwap_bands(candles: pd.DataFrame, multipliers=(1.0, 2.0)) -> dict:
    """
    Session VWAP ± N standard deviations.
    Returns { "vwap": Series, "upper_1": Series, "lower_1": Series, ... }
    All series are indexed to today's session candles only.
    """
    if "datetime" not in candles.columns:
        session = candles
    else:
        today_utc = pd.Timestamp.utcnow().normalize().tz_localize(None)
        dt = candles["datetime"]
        if dt.dt.tz is not None:
            dt = dt.dt.tz_convert("UTC").dt.tz_localize(None)
        session = candles[dt >= today_utc].copy()
        if session.empty:
            session = candles.tail(20).copy()

    vwap_series = _raw_vwap(session)
    tp  = (session["high"] + session["low"] + session["close"]) / 3
    vol = session["volume"]

    cum_vol  = vol.cumsum()
    cum_tp2v = (tp ** 2 * vol).cumsum()
    variance = (cum_tp2v / cum_vol.replace(0, np.nan)) - vwap_series ** 2
    std      = variance.clip(lower=0) ** 0.5

    result = {"vwap": vwap_series}
    for m in multipliers:
        result[f"upper_{m}"] = vwap_series + m * std
        result[f"lower_{m}"] = vwap_series - m * std
    return result


# ── Position sizing ───────────────────────────────────────────────────────────

def position_size(
    account_balance: float,
    entry_price: float,
    stop_price: float,
    max_risk_pct: float = None,
) -> float:
    """
    Volatility-adjusted position size.
    Risk per trade = balance × max_risk_pct
    Qty = risk_amount / |entry - stop|
    """
    max_risk_pct  = max_risk_pct or config.MAX_RISK_PCT
    risk_amount   = account_balance * max_risk_pct
    risk_per_unit = abs(entry_price - stop_price)
    if risk_per_unit == 0:
        return 0.0
    return round(risk_amount / risk_per_unit, 3)
