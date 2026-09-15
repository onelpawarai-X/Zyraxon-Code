import { WebSocketServer, WebSocket } from 'ws'
import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const CONNECTION_PORT = 34567
const CONNECTION_HOST = '127.0.0.1'

interface ConnectionMessage {
  type: string
  payload?: any
  id?: string
}

interface ConnectionResponse {
  id: string
  success: boolean
  data?: any
  error?: string
}

let wss: WebSocketServer | null = null
let connectionClients = new Set<WebSocket>()

function sendResponse(ws: WebSocket, id: string | undefined, success: boolean, data?: any, error?: string) {
  if (ws.readyState === WebSocket.OPEN && id) {
    const response: ConnectionResponse = { id, success, data, error }
    ws.send(JSON.stringify(response))
  }
}

function broadcast(event: string, data: any) {
  const message = JSON.stringify({ type: 'event', event, data })
  connectionClients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  })
}

function handleMessage(ws: WebSocket, message: ConnectionMessage) {
  const { type, payload, id } = message

  switch (type) {
    case 'ping': {
      sendResponse(ws, id, true, { pong: true })
      break
    }

    case 'getStatus': {
      const windows = BrowserWindow.getAllWindows()
      sendResponse(ws, id, true, {
        running: true,
        windows: windows.length,
        pid: process.pid,
        version: app.getVersion(),
      })
      break
    }

    case 'openFolder': {
      const folderPath = payload?.folderPath
      if (!folderPath) {
        sendResponse(ws, id, false, undefined, 'folderPath is required')
        break
      }

      try {
        const { app: electronApp } = require('electron')
        electronApp.focus()
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('open-folder', folderPath)
        }
        sendResponse(ws, id, true, { opened: true })
      } catch (error) {
        sendResponse(ws, id, false, undefined, error instanceof Error ? error.message : String(error))
      }
      break
    }

    case 'openFile': {
      const filePath = payload?.filePath
      if (!filePath) {
        sendResponse(ws, id, false, undefined, 'filePath is required')
        break
      }

      try {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('open-file', filePath)
        }
        sendResponse(ws, id, true, { opened: true })
      } catch (error) {
        sendResponse(ws, id, false, undefined, error instanceof Error ? error.message : String(error))
      }
      break
    }

    case 'executeCommand': {
      const command = payload?.command
      const args = payload?.args || []
      if (!command) {
        sendResponse(ws, id, false, undefined, 'command is required')
        break
      }

      try {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          win.webContents.send('execute-command', { command, args })
        }
        sendResponse(ws, id, true, { executed: true })
      } catch (error) {
        sendResponse(ws, id, false, undefined, error instanceof Error ? error.message : String(error))
      }
      break
    }

    case 'getProviders': {
      sendResponse(ws, id, true, {
        providers: [
          { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
          { id: 'anthropic', name: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
          { id: 'google', name: 'Google', models: ['gemini-1.5-pro', 'gemini-1.5-flash'] },
        ],
      })
      break
    }

    default: {
      sendResponse(ws, id, false, undefined, `Unknown message type: ${type}`)
    }
  }
}

export function startConnectionServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      wss = new WebSocketServer({ host: CONNECTION_HOST, port: CONNECTION_PORT })

      wss.on('listening', () => {
        console.log(`[ZYRAXON Connection] Server listening on ${CONNECTION_HOST}:${CONNECTION_PORT}`)

        const portFile = path.join(os.tmpdir(), 'zyraxon-code-connection-port')
        fs.writeFileSync(portFile, String(CONNECTION_PORT))

        resolve()
      })

      wss.on('connection', (ws: WebSocket) => {
        connectionClients.add(ws)
        console.log('[ZYRAXON Connection] Client connected')

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString()) as ConnectionMessage
            handleMessage(ws, message)
          } catch (error) {
            console.error('[ZYRAXON Connection] Failed to parse message:', error)
          }
        })

        ws.on('close', () => {
          connectionClients.delete(ws)
          console.log('[ZYRAXON Connection] Client disconnected')
        })

        ws.on('error', (error) => {
          console.error('[ZYRAXON Connection] WebSocket error:', error)
          connectionClients.delete(ws)
        })

        sendResponse(ws, undefined, true, { connected: true, pid: process.pid })
      })

      wss.on('error', (error) => {
        console.error('[ZYRAXON Connection] Server error:', error)
        reject(error)
      })
    } catch (error) {
      reject(error)
    }
  })
}

export function stopConnectionServer(): Promise<void> {
  return new Promise((resolve) => {
    connectionClients.forEach((ws) => ws.close())
    connectionClients.clear()

    if (wss) {
      wss.close(() => {
        wss = null
        console.log('[ZYRAXON Connection] Server stopped')
        resolve()
      })
    } else {
      resolve()
    }
  })
}

export function isConnectionServerRunning(): boolean {
  return wss !== null
}

app.on('will-quit', () => {
  stopConnectionServer()
})