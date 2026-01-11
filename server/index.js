import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import * as Y from 'yjs'
import compileRouter from './routes/compile.js'
import filesRouter from './routes/files.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(join(__dirname, '../client/dist')))

// API Routes
app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Simple Yjs WebSocket Server
// Stores documents and syncs between connected clients
const docs = new Map()
const wss = new WebSocketServer({ noServer: true })

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
    if (request.url.startsWith('/ws')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request)
        })
    } else {
        socket.destroy()
    }
})

wss.on('connection', (ws, req) => {
    const roomName = 'latex-room'
    console.log(`[WS] Client connected to ${roomName}`)

    // Get or create document
    if (!docs.has(roomName)) {
        docs.set(roomName, {
            doc: new Y.Doc(),
            clients: new Set()
        })
    }
    const room = docs.get(roomName)
    room.clients.add(ws)

    // Send initial state
    const state = Y.encodeStateAsUpdate(room.doc)
    ws.send(state)

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const update = new Uint8Array(message)
            Y.applyUpdate(room.doc, update)

            // Broadcast to other clients
            room.clients.forEach(client => {
                if (client !== ws && client.readyState === 1) {
                    client.send(update)
                }
            })
        } catch (e) {
            console.error('[WS] Error processing message:', e)
        }
    })

    ws.on('close', () => {
        room.clients.delete(ws)
        console.log(`[WS] Client disconnected from ${roomName}`)
    })
})

// Serve frontend for all other routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '../client/dist/index.html'))
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     LaTeX Online Editor Server             ║
╠════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}       ║
║  WebSocket:    ws://localhost:${PORT}/ws      ║
║                                            ║
║  Ready for LaTeX compilation!              ║
╚════════════════════════════════════════════╝
  `)
})
