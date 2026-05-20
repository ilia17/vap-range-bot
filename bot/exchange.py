"""
exchange.py — All Bybit interaction lives here.

Keeps pybit calls in one place so you can mock this in tests
and swap exchanges later without touching strategy logic.
"""

import os
import time
import logging
from typing import Optional
import pandas as pd
from pybit.unified_trading import HTTP

import config

logger = logging.getLogger(__name__)


def _get_client() -> HTTP:
    """Build a pybit HTTP client from config or .env."""
    api_key    = config.API_KEY    or os.getenv("BYBIT_API_KEY", "")
    api_secret = config.API_SECRET or os.getenv("BYBIT_SECRET", "")
    return HTTP(
        testnet=config.TESTNET,
        api_key=api_key,
        api_secret=api_secret,
    )


# Module-level client (created once)
_client: Optional[HTTP] = None

def get_client() -> HTTP:
    global _client
    if _client is None:
        _client = _get_client()
    return _client


# ── Market data ───────────────────────────────────────────────────────────────

def fetch_klines(
    symbol: str = config.SYMBOL,
    interval: str = config.TIMEFRAME,
    limit: int = 200,
) -> Optional[pd.DataFrame]:
    """
    Fetch recent OHLCV candles from Bybit.

    Returns a DataFrame with columns:
        timestamp, open, high, low, close, volume
    Sorted oldest → newest.
    """
    try:
        resp = get_client().get_kline(
            category=config.CATEGORY,
            symbol=symbol,
            interval=interval,
            limit=limit,
        )
        raw = resp["result"]["list"]
        if not raw:
            logger.warning("Empty kline response")
            return None

        df = pd.DataFrame(raw, columns=[
            "timestamp", "open", "high", "low", "close", "volume", "turnover"
        ])
        df = df.astype({
            "timestamp": "int64",
            "open":  "float64",
            "high":  "float64",
            "low":   "float64",
            "close": "float64",
            "volume":"float64",
        })
        # Bybit returns newest first — reverse to oldest first
        df = df.iloc[::-1].reset_index(drop=True)
        # Bybit timestamps are milliseconds since Unix epoch (UTC).
        # Store as naive UTC so session_vwap() can compare against
        # pd.Timestamp.utcnow().normalize() without tz mismatch errors.
        df["datetime"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True).dt.tz_localize(None)
        return df

    except Exception as e:
        logger.error(f"fetch_klines error: {e}")
        return None


def fetch_previous_day_candles(
    symbol: str = config.SYMBOL,
    interval: str = "D",
) -> Optional[pd.DataFrame]:
    """
    Fetch yesterday's daily candle (used to build the value area).
    Returns a DataFrame with a single row for the previous day,
    or None on failure.
    """
    try:
        resp = get_client().get_kline(
            category=config.CATEGORY,
            symbol=symbol,
            interval="D",
            limit=2,       # today + yesterday
        )
        raw = resp["result"]["list"]
        if len(raw) < 2:
            return None

        # Index 0 = most recent (today, incomplete), index 1 = yesterday
        # But we want intraday candles for a proper volume profile.
        # Fallback: use the last 96 × 15min candles (1 full day).
        return None  # signals caller to use intraday fallback

    except Exception as e:
        logger.error(f"fetch_previous_day_candles error: {e}")
        return None


def fetch_intraday_for_va(
    symbol: str = config.SYMBOL,
    candles_per_day: int = 96,   # 96 × 15m = 24h
) -> Optional[pd.DataFrame]:
    """
    Fetch the last ~24h of 15m candles for building the previous day's value area.
    96 candles × 15m = exactly 1 day.
    """
    df = fetch_klines(symbol=symbol, interval="15", limit=candles_per_day + 10)
    if df is None or len(df) < candles_per_day:
        return df
    # Take the 96 candles ending just before the current candle
    return df.iloc[-(candles_per_day + 1):-1].reset_index(drop=True)


def fetch_account_balance(coin: str = "USDT") -> float:
    """Return available USDT balance. Returns 0.0 on error."""
    try:
        resp = get_client().get_wallet_balance(accountType="UNIFIED", coin=coin)
        coins = resp["result"]["list"][0]["coin"]
        for c in coins:
            if c["coin"] == coin:
                return float(c["availableToWithdraw"])
        return 0.0
    except Exception as e:
        logger.error(f"fetch_account_balance error: {e}")
        return 0.0


# ── Order execution ───────────────────────────────────────────────────────────

def place_order(
    side: str,          # "Buy" or "Sell"
    qty: float,
    entry_price: float,
    sl_price: float,
    tp_price: float,
    symbol: str = config.SYMBOL,
) -> Optional[dict]:
    """
    Place a limit order with attached SL and TP on Bybit.

    Args:
        side:        "Buy" for long, "Sell" for short
        qty:         Position size in base currency
        entry_price: Limit entry price
        sl_price:    Stop loss price
        tp_price:    Take profit price

    Returns:
        Bybit order response dict, or None on failure.
    """
    if qty <= 0:
        logger.warning("place_order: qty is 0, skipping")
        return None

    try:
        resp = get_client().place_order(
            category=config.CATEGORY,
            symbol=symbol,
            side=side,
            orderType="Limit",
            qty=str(qty),
            price=str(round(entry_price, 2)),
            stopLoss=str(round(sl_price, 2)),
            takeProfit=str(round(tp_price, 2)),
            slTriggerBy="LastPrice",
            tpTriggerBy="LastPrice",
            timeInForce="GTC",
            reduceOnly=False,
            closeOnTrigger=False,
        )
        logger.info(f"Order placed: {side} {qty} {symbol} @ {entry_price} | SL {sl_price} | TP {tp_price}")
        return resp
    except Exception as e:
        logger.error(f"place_order error: {e}")
        return None


def cancel_all_orders(symbol: str = config.SYMBOL) -> bool:
    """Cancel all open orders for a symbol. Returns True on success."""
    try:
        get_client().cancel_all_orders(category=config.CATEGORY, symbol=symbol)
        logger.info(f"All orders cancelled for {symbol}")
        return True
    except Exception as e:
        logger.error(f"cancel_all_orders error: {e}")
        return False


def get_open_positions(symbol: str = config.SYMBOL) -> list:
    """Return list of open positions for a symbol."""
    try:
        resp = get_client().get_positions(category=config.CATEGORY, symbol=symbol)
        return resp["result"]["list"]
    except Exception as e:
        logger.error(f"get_open_positions error: {e}")
        return []
