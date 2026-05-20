"""
strategy.py — Balanced market range trading strategy with session VWAP confirmation.

Signal rules (BALANCED market — price inside VA):
  ┌─────────────────┬──────────────────────────────────────────────────────────┐
  │ Zone            │ Signal                                                   │
  ├─────────────────┼──────────────────────────────────────────────────────────┤
  │ DISCOUNT        │ LONG  — if USE_VWAP=False OR price > session VWAP       │
  │ PREMIUM         │ SHORT — if USE_VWAP=False OR price < session VWAP       │
  │ MID_RANGE       │ WAIT  — no edge                                          │
  │ outside VA      │ NO_TRADE (after BREAKOUT_CONFIRM_CANDLES closes outside) │
  └─────────────────┴──────────────────────────────────────────────────────────┘

Session VWAP resets at 00:00 UTC every day.
LONG  valid only when price > session VWAP  → price above today's fair value
SHORT valid only when price < session VWAP  → price below today's fair value
"""

from dataclasses import dataclass
from typing import Optional, Literal
import pandas as pd

from value_area import ValueArea
from indicators import latest_atr, latest_session_vwap, position_size
import config

SignalType = Literal["LONG", "SHORT", "WAIT", "NO_TRADE"]


@dataclass
class Signal:
    signal:       SignalType
    bias:         str
    zone:         str
    price:        float
    vwap:         Optional[float] = None   # today's session VWAP
    vwap_aligned: Optional[bool]  = None   # True/False/None (None = VWAP disabled)
    entry:        Optional[float] = None
    sl:           Optional[float] = None
    tp:           Optional[float] = None
    qty:          Optional[float] = None
    atr_value:    Optional[float] = None
    reason:       str = ""

    def is_actionable(self) -> bool:
        return self.signal in ("LONG", "SHORT")

    def as_dict(self) -> dict:
        return {
            "signal":      self.signal,
            "bias":        self.bias,
            "zone":        self.zone,
            "price":       self.price,
            "vwap":        self.vwap,
            "vwapAligned": self.vwap_aligned,
            "entry":       self.entry,
            "sl":          self.sl,
            "tp":          self.tp,
            "qty":         self.qty,
            "atr_value":   self.atr_value,
            "reason":      self.reason,
        }


class BalancedMarketStrategy:
    """
    Call evaluate() once per closed candle.
    All parameters are read from config at call time —
    frontend config updates take effect on the very next candle.
    """

    def __init__(self):
        self._outside_va_count = 0

    def evaluate(
        self,
        candles: pd.DataFrame,
        va: ValueArea,
        account_balance: float = 1000.0,
    ) -> Signal:
        if candles is None or len(candles) == 0 or va is None:
            return Signal(signal="WAIT", bias="UNKNOWN", zone="UNKNOWN",
                          price=0.0, reason="No data")

        price    = float(candles["close"].iloc[-1])
        zone     = va.classify_zone(price)
        bias     = va.market_bias(price)
        atr_val  = latest_atr(candles)

        # Session VWAP — anchored to 00:00 UTC today
        vwap_val = latest_session_vwap(candles)

        # ── Breakout confirmation counter ─────────────────────────────────────
        if zone in ("BELOW_VA", "ABOVE_VA"):
            self._outside_va_count += 1
        else:
            self._outside_va_count = 0

        confirmed_imbalanced = (
            self._outside_va_count >= config.BREAKOUT_CONFIRM_CANDLES
        )

        # ── Imbalanced market — no range trade ────────────────────────────────
        if bias == "IMBALANCED" and confirmed_imbalanced:
            return Signal(
                signal="NO_TRADE", bias="IMBALANCED", zone=zone,
                price=price, vwap=vwap_val, atr_value=atr_val,
                reason=(
                    f"Price outside VA for {self._outside_va_count} candles "
                    f"— imbalanced, skipping range logic"
                ),
            )

        use_vwap = config.USE_VWAP

        # ── DISCOUNT zone → look for LONG ─────────────────────────────────────
        if zone == "DISCOUNT":
            vwap_aligned = (price > vwap_val) if use_vwap else None

            if use_vwap and not vwap_aligned:
                return Signal(
                    signal="WAIT", bias=bias, zone=zone,
                    price=price, vwap=vwap_val, vwap_aligned=False,
                    atr_value=atr_val,
                    reason=(
                        f"Discount zone but price {price:.2f} < session VWAP {vwap_val:.2f} "
                        f"— waiting for VWAP reclaim before going long"
                    ),
                )

            entry = price
            sl    = entry - atr_val * config.ATR_SL_MULT
            tp    = entry + va.width * config.TP_VA_MULT
            qty   = position_size(account_balance, entry, sl)
            reason = f"Discount zone — price {price:.2f} near VAL {va.val:.2f}"
            if use_vwap:
                reason += f" · session VWAP {vwap_val:.2f} ✓ (price above)"
            return Signal(
                signal="LONG", bias=bias, zone=zone,
                price=price, vwap=vwap_val, vwap_aligned=vwap_aligned,
                entry=entry, sl=sl, tp=tp, qty=qty,
                atr_value=atr_val, reason=reason,
            )

        # ── PREMIUM zone → look for SHORT ─────────────────────────────────────
        if zone == "PREMIUM":
            vwap_aligned = (price < vwap_val) if use_vwap else None

            if use_vwap and not vwap_aligned:
                return Signal(
                    signal="WAIT", bias=bias, zone=zone,
                    price=price, vwap=vwap_val, vwap_aligned=False,
                    atr_value=atr_val,
                    reason=(
                        f"Premium zone but price {price:.2f} > session VWAP {vwap_val:.2f} "
                        f"— waiting for VWAP rejection before going short"
                    ),
                )

            entry = price
            sl    = entry + atr_val * config.ATR_SL_MULT
            tp    = entry - va.width * config.TP_VA_MULT
            qty   = position_size(account_balance, entry, sl)
            reason = f"Premium zone — price {price:.2f} near VAH {va.vah:.2f}"
            if use_vwap:
                reason += f" · session VWAP {vwap_val:.2f} ✓ (price below)"
            return Signal(
                signal="SHORT", bias=bias, zone=zone,
                price=price, vwap=vwap_val, vwap_aligned=vwap_aligned,
                entry=entry, sl=sl, tp=tp, qty=qty,
                atr_value=atr_val, reason=reason,
            )

        # ── Mid-range — no edge ───────────────────────────────────────────────
        return Signal(
            signal="WAIT", bias=bias, zone=zone,
            price=price, vwap=vwap_val, vwap_aligned=None,
            atr_value=atr_val,
            reason="Mid-range — waiting for price to reach discount or premium zone",
        )
