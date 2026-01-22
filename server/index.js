import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import compileRouter from './routes/compile.js'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import filesRouter from './routes/files.js'
import projectsRouter from './routes/projects.js'
import aiRouter from './routes/ai.js'
import { decodeAndVerifyToken } from './services/auth.js'
import { getProjectWithAuth } from './utils/project.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}))

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
})
app.use('/api', limiter)

// API Routes
app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/ai', aiRouter)

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Simple WebSocket relay for Yjs collaboration
// Relays all messages between clients in the same room
const rooms = new Map()
const wss = new WebSocketServer({ noServer: true })

// Handle upgrade requests
server.on('upgrade', async (request, socket, head) => {
    try {
        if (request.url.startsWith('/ws')) {
            const url = new URL(request.url, `http://${request.headers.host}`)

            let projectId = url.searchParams.get('projectId')
            if (!projectId) {
                const match = url.pathname.match(/^\/ws\/([^\/]+)/)
                if (match) projectId = match[1]
            }

            const token = url.searchParams.get('token')
            const sid = url.searchParams.get('sid')

            if (!projectId) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing projectId')
                socket.destroy()
                return
            }

            const user = await decodeAndVerifyToken(token)
            if (!user && !sid) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
                socket.destroy()
                return
            }

            const authStatus = getProjectWithAuth(user, projectId, 'view', sid)
            if (authStatus.error) {
                socket.write(`HTTP/1.1 403 Forbidden\r\n\r\n${authStatus.error}`)
                socket.destroy()
                return
            }

            request.user = user
            request.projectId = projectId

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request)
            })
        } else {
            socket.destroy()
        }
    } catch (err) {
        console.error('[WS Upgrade] Error:', err.message)
        socket.destroy()
    }
})

wss.on('connection', (ws, req) => {
    const projectId = req.projectId || 'default'
    const user = req.user
    const userId = user?.uid || 'anonymous'

    console.log(`[WS] User ${userId} (${user?.email}) joined project ${projectId}`)

    // Get or create room
    if (!rooms.has(projectId)) {
        rooms.set(projectId, new Set())
    }
    const room = rooms.get(projectId)
    room.add(ws)

    // Relay ALL messages to all other clients in room
    // This includes both sync messages and awareness messages
    ws.on('message', (message, isBinary) => {
        // Handle text ping/pong
        if (!isBinary && message.toString() === 'ping') {
            ws.send('pong')
            return
        }

        // Relay to all other clients
        room.forEach(client => {
            if (client !== ws && client.readyState === 1) {
                client.send(message)
            }
        })
    })

    ws.on('close', () => {
        room.delete(ws)
        console.log(`[WS] Client ${userId} disconnected from ${projectId}`)

        if (room.size === 0) {
            rooms.delete(projectId)
        }
    })

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message)
    })
})

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'
server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     LaTeX Online Editor Server             ║
╠════════════════════════════════════════════╣
║  HTTP Server:  http://${HOST}:${PORT}            ║
║  WebSocket:    ws://${HOST}:${PORT}/ws           ║
║                                            ║
║  Ready for LaTeX compilation!              ║
╚════════════════════════════════════════════╝
  `)
})
