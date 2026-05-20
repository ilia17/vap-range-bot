"""
bot.py — Main bot loop.

Run with:  python bot.py
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import config
import exchange
from value_area import calculate_value_area, ValueArea
from strategy import BalancedMarketStrategy, Signal
from server import broadcast, start_server, register_config_callback

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("bot")


class BotState:
    def __init__(self):
        self.running         = False
        self.va: Optional[ValueArea] = None
        self.signal: Optional[Signal] = None
        self.last_price      = 0.0
        self.price_history   = []      # last 200 closes for chart
        self.balance         = 0.0
        self.trades          = []
        self.logs            = []
        self.pnl             = 0.0
        self.trade_count     = 0
        self.win_count       = 0
        self.needs_va_refresh = False  # set True when symbol changes

    def add_log(self, msg: str, log_type: str = "info"):
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        self.logs.insert(0, {"ts": ts, "msg": msg, "type": log_type})
        self.logs = self.logs[:100]
        logger.info(msg)

    def record_trade(self, signal: Signal, exit_price: float, win: bool):
        ts      = datetime.now(timezone.utc).strftime("%H:%M")
        pnl_usd = abs(exit_price - signal.entry) * (signal.qty or 0) * (1 if win else -1)
        trade   = {
            "ts":     ts,
            "side":   signal.signal,
            "entry":  round(signal.entry, 2),
            "exit":   round(exit_price, 2),
            "pnlUsd": round(pnl_usd, 2),
            "win":    win,
            "zone":   signal.zone,
        }
        self.trades.insert(0, trade)
        self.trades   = self.trades[:50]
        self.pnl     += pnl_usd
        self.trade_count += 1
        if win:
            self.win_count += 1
        return trade

    def to_dict(self) -> dict:
        va  = self.va
        sig = self.signal
        return {
            # Status
            "running":      self.running,
            "symbol":       config.SYMBOL,
            "timeframe":    config.TIMEFRAME,
            "testnet":      config.TESTNET,
            # Price
            "price":        self.last_price,
            "priceHistory": self.price_history[-100:],
            # Account
            "balance":      round(self.balance, 2),
            "pnl":          round(self.pnl, 2),
            "tradeCount":   self.trade_count,
            "winCount":     self.win_count,
            "winRate":      round(self.win_count / self.trade_count * 100, 1) if self.trade_count else 0,
            # Value area
            "vah":          round(va.vah, 2)   if va else None,
            "val":          round(va.val, 2)   if va else None,
            "poc":          round(va.poc, 2)   if va else None,
            "vaWidth":      round(va.width, 2) if va else None,
            "posInRange":   round(va.position_in_range(self.last_price) * 100, 1) if va and self.last_price else None,
            # Signal
            "signal":       sig.signal              if sig else None,
            "bias":         sig.bias                if sig else None,
            "zone":         sig.zone                if sig else None,
            "entry":        round(sig.entry, 2)     if sig and sig.entry     else None,
            "sl":           round(sig.sl,    2)     if sig and sig.sl        else None,
            "tp":           round(sig.tp,    2)     if sig and sig.tp        else None,
            "qty":          sig.qty                 if sig else None,
            "atr":          round(sig.atr_value, 2) if sig and sig.atr_value else None,
            "vwap":         round(sig.vwap, 2)      if sig and sig.vwap      else None,
            "vwapAligned":  sig.vwap_aligned        if sig else None,
            "signalReason": sig.reason              if sig else "",
            # Active config (sent so frontend can show live values)
            "activeConfig": {
                "SYMBOL":                   config.SYMBOL,
                "TIMEFRAME":                config.TIMEFRAME,
                "VA_PERCENT":               config.VA_PERCENT,
                "DISCOUNT_ZONE_PCT":        config.DISCOUNT_ZONE_PCT,
                "PREMIUM_ZONE_PCT":         config.PREMIUM_ZONE_PCT,
                "BREAKOUT_CONFIRM_CANDLES": config.BREAKOUT_CONFIRM_CANDLES,
                "USE_VWAP":                 config.USE_VWAP,
                "ATR_PERIOD":               config.ATR_PERIOD,
                "ATR_SL_MULT":              config.ATR_SL_MULT,
                "TP_VA_MULT":               config.TP_VA_MULT,
                "MAX_RISK_PCT":             config.MAX_RISK_PCT,
                "TESTNET":                  config.TESTNET,
            },
            # History
            "trades":  self.trades,
            "logs":    self.logs[:30],
        }


def refresh_value_area(state: BotState):
    state.add_log("Fetching candles for value area...", "info")
    candles = exchange.fetch_intraday_for_va()
    if candles is None or len(candles) < 20:
        state.add_log("Not enough candles for VA — retrying", "warn")
        return
    va = calculate_value_area(candles)
    if va is None:
        state.add_log("VA calculation failed", "err")
        return
    state.va = va
    state.add_log(f"VA → VAH {va.vah:.2f}  POC {va.poc:.2f}  VAL {va.val:.2f}", "ok")

    # Seed the price history chart from the candles we already have.
    # Without this the chart stays blank until enough ticks accumulate — which
    # at 15m intervals would take 45+ minutes to render 3 points.
    closes = candles["close"].tolist()
    state.price_history = [float(c) for c in closes[-200:]]
    state.add_log(f"Chart seeded with {len(state.price_history)} candles", "info")


async def bot_loop(state: BotState):
    strategy              = BalancedMarketStrategy()
    candle_interval       = int(config.TIMEFRAME) * 60
    va_refresh_interval   = 24 * 60 * 60
    last_va_refresh       = 0
    last_symbol           = config.SYMBOL

    state.running = True
    state.add_log(f"Bot started — {config.SYMBOL} {config.TIMEFRAME}m", "ok")
    state.balance = exchange.fetch_account_balance()
    state.add_log(f"Balance: {state.balance:.2f} USDT  |  Testnet: {config.TESTNET}", "info")

    while state.running:
        now = time.time()

        # Symbol changed from frontend → reset VA immediately
        if config.SYMBOL != last_symbol or state.needs_va_refresh:
            state.add_log(f"Symbol changed → {config.SYMBOL}, refreshing VA", "warn")
            state.va            = None
            last_symbol         = config.SYMBOL
            last_va_refresh     = 0
            state.needs_va_refresh = False
            strategy            = BalancedMarketStrategy()   # reset breakout counter too
            candle_interval     = int(config.TIMEFRAME) * 60

        # Daily VA refresh
        if now - last_va_refresh > va_refresh_interval:
            refresh_value_area(state)
            last_va_refresh = now

        if state.va is None:
            state.add_log("Waiting for value area...", "warn")
            await broadcast(state.to_dict())
            await asyncio.sleep(15)
            continue

        # Fetch candles
        candles = exchange.fetch_klines(limit=200)
        if candles is None or len(candles) < 2:
            state.add_log("Candle fetch failed — retrying", "warn")
            await asyncio.sleep(30)
            continue

        state.last_price = float(candles["close"].iloc[-1])
        state.price_history.append(state.last_price)
        state.price_history = state.price_history[-200:]

        # Run strategy
        signal        = strategy.evaluate(candles=candles, va=state.va, account_balance=state.balance)
        state.signal  = signal

        vwap_str = f" | VWAP {signal.vwap:.2f} {'✓' if signal.vwap_aligned else '✗' if signal.vwap_aligned is False else '-'}" if signal.vwap else ""
        state.add_log(f"[{signal.bias}] {signal.zone} → {signal.signal} @ {state.last_price:.2f}{vwap_str}", "info")

        # Execute
        if signal.is_actionable():
            state.add_log(f"Placing {signal.signal}: entry={signal.entry:.2f} sl={signal.sl:.2f} tp={signal.tp:.2f} qty={signal.qty}", "ok")
            bybit_side = "Buy" if signal.signal == "LONG" else "Sell"
            order = exchange.place_order(
                side=bybit_side, qty=signal.qty,
                entry_price=signal.entry, sl_price=signal.sl, tp_price=signal.tp,
            )
            if order:
                state.add_log(f"Order placed: {order['result'].get('orderId','?')}", "ok")
            else:
                state.add_log("Order failed — check exchange.py logs", "err")

        await broadcast(state.to_dict())
        await asyncio.sleep(candle_interval)


async def main():
    state = BotState()

    async def on_config_update(info: dict):
        state.add_log(f"Config updated: {', '.join(info['applied'])}", "ok")
        if info["rejected"]:
            state.add_log(f"Rejected: {', '.join(info['rejected'])}", "warn")
        # If symbol or timeframe changed, trigger VA refresh on next tick
        raw = info.get("raw", {})
        if "SYMBOL" in raw or "TIMEFRAME" in raw:
            state.needs_va_refresh = True
        await broadcast(state.to_dict())

    register_config_callback(on_config_update)

    await asyncio.gather(
        start_server(),
        bot_loop(state),
    )


if __name__ == "__main__":
    asyncio.run(main())
