/**
 * useWebSocket.js
 *
 * Bidirectional connection to the Python bot.
 * - Receives state broadcasts → exposes as `state`
 * - Sends config_update messages via `sendConfig(payload)`
 * - Tracks pending/ack status per update
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8765'
const RECONNECT_DELAY_MS = 3000

export function useWebSocket() {
  const [state, setState]         = useState(null)
  const [connected, setConnected] = useState(false)
  const [configAck, setConfigAck] = useState(null)   // last ack from Python
  const [pending, setPending]     = useState(false)  // waiting for ack
  const wsRef           = useRef(null)
  const reconnectTimer  = useRef(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen  = () => setConnected(true)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'config_ack') {
          setConfigAck(msg)
          setPending(false)
        } else {
          // Regular state broadcast
          setState(msg)
        }
      } catch (e) {
        console.error('WS parse error', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      setPending(false)
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendConfig = useCallback((payload) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return
    setPending(true)
    setConfigAck(null)
    wsRef.current.send(JSON.stringify({ type: 'config_update', payload }))
  }, [])

  return { state, connected, sendConfig, configAck, pending }
}
