import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import compileRouter from './routes/compile.js'
import filesRouter from './routes/files.js'
import projectsRouter from './routes/projects.js'

import { existsSync, readdirSync, statSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECTS_DIR = join(__dirname, '../projects')

// Helper to calculate directory size recursively
function getDirectorySize(dirPath) {
    let size = 0
    try {
        if (!existsSync(dirPath)) return 0
        const files = readdirSync(dirPath)
        for (const file of files) {
            const filePath = join(dirPath, file)
            const stat = statSync(filePath)
            if (stat.isDirectory()) {
                size += getDirectorySize(filePath)
            } else {
                size += stat.size
            }
        }
    } catch (e) {
        // Ignore errors
    }
    return size
}

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(express.static(join(__dirname, '../client/dist')))

// API Routes
app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)
app.use('/api/projects', projectsRouter)

// User storage info endpoint
app.get('/api/user/storage', async (req, res) => {
    try {
        // Get user ID from auth header
        const authHeader = req.headers.authorization
        let userId = 'dev-user'

        if (authHeader && authHeader.startsWith('Bearer ')) {
            // In production, verify token and get user ID
            // For now, we'll try to decode it or use dev-user
            try {
                const token = authHeader.split('Bearer ')[1]
                // Simple base64 decode to peek at payload (not secure, just for dev)
                const payload = JSON.parse(atob(token.split('.')[1]))
                userId = payload.user_id || payload.uid || 'dev-user'
            } catch {
                userId = 'dev-user'
            }
        }

        const userProjectsDir = join(PROJECTS_DIR, userId)
        const usedStorage = existsSync(userProjectsDir) ? getDirectorySize(userProjectsDir) : 0

        // Default storage limit: 100MB
        // In production, this would come from Firestore user profile
        const storageLimit = 100 * 1024 * 1024

        res.json({
            used: usedStorage,
            limit: storageLimit,
            userId: userId
        })
    } catch (error) {
        console.error('[Storage] Error calculating storage:', error)
        res.status(500).json({ error: error.message })
    }
})

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Simple WebSocket relay for Yjs collaboration
// Just relays binary messages between clients in the same room
const rooms = new Map()
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

    // Get or create room
    if (!rooms.has(roomName)) {
        rooms.set(roomName, new Set())
    }
    const room = rooms.get(roomName)
    room.add(ws)

    // Relay messages to all other clients in room
    ws.on('message', (message, isBinary) => {
        // Only relay binary messages (Yjs updates)
        if (isBinary || Buffer.isBuffer(message)) {
            room.forEach(client => {
                if (client !== ws && client.readyState === 1) { // WebSocket.OPEN = 1
                    client.send(message)
                }
            })
        }
    })

    ws.on('close', () => {
        room.delete(ws)
        console.log(`[WS] Client disconnected from ${roomName}`)

        // Cleanup empty rooms
        if (room.size === 0) {
            rooms.delete(roomName)
        }
    })

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message)
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
