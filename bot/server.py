"""
server.py — Bidirectional WebSocket server.

FROM Python → browser: state snapshots (price, VA, signal, trades, logs)
FROM browser → Python: config_update messages to reconfigure the bot live

Message format from browser:
  { "type": "config_update", "payload": { "SYMBOL": "ETHUSDT", "ATR_SL_MULT": 2.0, ... } }

Updatable fields and their types are defined in UPDATABLE_FIELDS below.
"""

import asyncio
import json
import logging
from typing import Set, Callable, Awaitable
import websockets
from websockets.server import WebSocketServerProtocol

import config

logger = logging.getLogger(__name__)

_clients: Set[WebSocketServerProtocol] = set()
_last_state: dict = {}

# Callback invoked when the browser sends a config_update
# Signature: async def on_config(updates: dict) -> None
_on_config_update: Callable[[dict], Awaitable[None]] = None

# Which fields the frontend is allowed to change, and their expected Python types
UPDATABLE_FIELDS = {
    "SYMBOL":                   str,
    "TIMEFRAME":                str,
    "VA_PERCENT":               float,
    "DISCOUNT_ZONE_PCT":        float,
    "PREMIUM_ZONE_PCT":         float,
    "BREAKOUT_CONFIRM_CANDLES": int,
    "USE_VWAP":                 bool,
    "ATR_PERIOD":               int,
    "ATR_SL_MULT":              float,
    "TP_VA_MULT":               float,
    "MAX_RISK_PCT":             float,
    "TESTNET":                  bool,
    "API_KEY":                  str,
    "API_SECRET":               str,
}


def register_config_callback(fn: Callable[[dict], Awaitable[None]]):
    """Register a coroutine to be called when the browser updates config."""
    global _on_config_update
    _on_config_update = fn


def _apply_config_update(payload: dict) -> tuple[list, list]:
    """
    Apply validated fields from payload to the live config module.
    Returns (applied, rejected) lists for logging.
    """
    applied  = []
    rejected = []

    for key, value in payload.items():
        if key not in UPDATABLE_FIELDS:
            rejected.append(f"{key} (not allowed)")
            continue
        expected_type = UPDATABLE_FIELDS[key]
        try:
            # Coerce type — important since JSON has no distinction between
            # int and float, and booleans come as JS booleans
            if expected_type == bool:
                coerced = bool(value)
            else:
                coerced = expected_type(value)
            setattr(config, key, coerced)
            applied.append(f"{key}={coerced}")
        except (ValueError, TypeError) as e:
            rejected.append(f"{key} ({e})")

    return applied, rejected


async def _handler(websocket: WebSocketServerProtocol):
    _clients.add(websocket)
    logger.info(f"Dashboard connected ({len(_clients)} total)")

    if _last_state:
        try:
            await websocket.send(json.dumps(_last_state))
        except Exception:
            pass

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "config_update":
                payload = msg.get("payload", {})
                applied, rejected = _apply_config_update(payload)

                logger.info(f"Config update — applied: {applied}")
                if rejected:
                    logger.warning(f"Config update — rejected: {rejected}")

                # Notify bot loop so it can restart the VA fetch if symbol changed
                if _on_config_update:
                    await _on_config_update({"applied": applied, "rejected": rejected, "raw": payload})

                # Ack back to the browser
                ack = {
                    "type":     "config_ack",
                    "applied":  applied,
                    "rejected": rejected,
                }
                try:
                    await websocket.send(json.dumps(ack))
                except Exception:
                    pass

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        _clients.discard(websocket)
        logger.info(f"Dashboard disconnected ({len(_clients)} remaining)")


async def broadcast(state: dict):
    global _last_state
    _last_state = state
    if not _clients:
        return
    message = json.dumps(state)
    dead = set()
    for ws in _clients:
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    _clients.difference_update(dead)


async def start_server():
    logger.info(f"WebSocket listening on ws://{config.WS_HOST}:{config.WS_PORT}")
    async with websockets.serve(_handler, config.WS_HOST, config.WS_PORT):
        await asyncio.Future()
