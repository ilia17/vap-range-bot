"""
value_area.py — Value Area calculation (Market Profile).

Given a day's OHLCV candles, builds a volume profile and finds:
  - VAH  (Value Area High)
  - VAL  (Value Area Low)
  - POC  (Point of Control — highest volume price)
  - VA width
  - market bias (BALANCED / IMBALANCED)

No Bybit dependency — pure pandas math. Easy to unit test.
"""

from dataclasses import dataclass
from typing import Optional
import numpy as np
import pandas as pd

import config


@dataclass
class ValueArea:
    vah: float
    val: float
    poc: float

    @property
    def width(self) -> float:
        return self.vah - self.val

    def position_in_range(self, price: float) -> float:
        """0.0 = at VAL, 1.0 = at VAH. Can go outside [0,1]."""
        if self.width == 0:
            return 0.5
        return (price - self.val) / self.width

    def classify_zone(self, price: float) -> str:
        """
        Returns one of:
          DISCOUNT   — near VAL, look for longs
          PREMIUM    — near VAH, look for shorts
          MID_RANGE  — inside VA but no edge
          BELOW_VA   — below VAL entirely
          ABOVE_VA   — above VAH entirely
        """
        if price < self.val:
            return "BELOW_VA"
        if price > self.vah:
            return "ABOVE_VA"
        discount_thresh = self.val + self.width * config.DISCOUNT_ZONE_PCT
        premium_thresh  = self.vah - self.width * config.PREMIUM_ZONE_PCT
        if price <= discount_thresh:
            return "DISCOUNT"
        if price >= premium_thresh:
            return "PREMIUM"
        return "MID_RANGE"

    def market_bias(self, price: float) -> str:
        """BALANCED if price is inside the value area, IMBALANCED if outside."""
        if self.val <= price <= self.vah:
            return "BALANCED"
        return "IMBALANCED"


def calculate_value_area(candles: pd.DataFrame, va_pct: float = config.VA_PERCENT) -> Optional[ValueArea]:
    """
    Build a volume-at-price profile from OHLCV candles and extract the value area.

    Args:
        candles:  DataFrame with columns [open, high, low, close, volume]
        va_pct:   Fraction of total volume that defines the value area (default 0.70)

    Returns:
        ValueArea dataclass, or None if data is insufficient.
    """
    if candles is None or len(candles) < 2:
        return None

    candles = candles.copy()
    candles = candles.dropna(subset=["high", "low", "close", "volume"])

    if len(candles) == 0:
        return None

    # ── Build price bins ──────────────────────────────────────────────────────
    price_min = candles["low"].min()
    price_max = candles["high"].max()

    if price_max <= price_min:
        return None

    # Use ~100 price levels — fine enough for intraday crypto
    n_bins = 100
    price_levels = np.linspace(price_min, price_max, n_bins)
    bin_width = price_levels[1] - price_levels[0]
    volume_profile = np.zeros(n_bins)

    # Distribute each candle's volume across the price levels it spans
    for _, row in candles.iterrows():
        low, high, vol = row["low"], row["high"], row["volume"]
        if high == low or vol == 0:
            continue
        # Find which bins this candle covers
        start_idx = int((low  - price_min) / (price_max - price_min) * (n_bins - 1))
        end_idx   = int((high - price_min) / (price_max - price_min) * (n_bins - 1))
        start_idx = max(0, start_idx)
        end_idx   = min(n_bins - 1, end_idx)
        n_levels = end_idx - start_idx + 1
        if n_levels > 0:
            volume_profile[start_idx:end_idx + 1] += vol / n_levels

    # ── Point of Control (POC) ────────────────────────────────────────────────
    poc_idx = int(np.argmax(volume_profile))
    poc = float(price_levels[poc_idx])

    # ── Value Area: expand from POC until we capture va_pct of volume ─────────
    total_volume = volume_profile.sum()
    target_volume = total_volume * va_pct

    va_low_idx  = poc_idx
    va_high_idx = poc_idx
    va_volume   = volume_profile[poc_idx]

    while va_volume < target_volume:
        can_go_lower  = va_low_idx  > 0
        can_go_higher = va_high_idx < n_bins - 1

        if not can_go_lower and not can_go_higher:
            break

        vol_below = volume_profile[va_low_idx  - 1] if can_go_lower  else 0
        vol_above = volume_profile[va_high_idx + 1] if can_go_higher else 0

        # Always absorb the higher volume side first (standard market profile rule)
        if vol_above >= vol_below and can_go_higher:
            va_high_idx += 1
            va_volume += vol_above
        elif can_go_lower:
            va_low_idx -= 1
            va_volume += vol_below
        else:
            va_high_idx += 1
            va_volume += vol_above

    vah = float(price_levels[va_high_idx])
    val = float(price_levels[va_low_idx])

    return ValueArea(vah=vah, val=val, poc=poc)
