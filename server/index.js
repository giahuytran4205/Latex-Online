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
// Static files are served by Nginx on port 8080
// Node.js only handles API and WebSocket

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}))

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
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
// Just relays binary messages between clients in the same room
const rooms = new Map()
const wss = new WebSocketServer({ noServer: true })

// Handle upgrade requests
server.on('upgrade', async (request, socket, head) => {
    try {
        if (request.url.startsWith('/ws')) {
            const url = new URL(request.url, `http://${request.headers.host}`)

            // Try to get projectId from path first (standard y-websocket), then query
            let projectId = url.searchParams.get('projectId')
            if (!projectId) {
                const match = url.pathname.match(/^\/ws\/([^\/]+)/)
                if (match) projectId = match[1]
            }

            const token = url.searchParams.get('token')
            const sid = url.searchParams.get('sid')

            // console.log(`[WS Upgrade] Project: ${projectId}, SID: ${sid ? sid.substring(0, 8) + '...' : 'None'}`)

            if (!projectId) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing projectId')
                socket.destroy()
                return
            }

            // Verify User (optional if sid is provided)
            const user = await decodeAndVerifyToken(token)
            if (!user && !sid) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
                socket.destroy()
                return
            }

            // Verify Permission (need at least 'view' to collaborate, but usually 'edit')
            const authStatus = getProjectWithAuth(user, projectId, 'view', sid)
            if (authStatus.error) {
                socket.write(`HTTP/1.1 403 Forbidden\r\n\r\n${authStatus.error}`)
                socket.destroy()
                return
            }

            // Attach user info and projectId to request for the connection handler
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
    // projectId is attached during upgrade
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

    // Relay messages to all other clients in room
    ws.on('message', (message, isBinary) => {
        // Handle Keep-Alive (Ping/Pong)
        // Some clients (like y-websocket) might send a text 'ping'
        if (!isBinary && message.toString() === 'ping') {
            ws.send('pong')
            return
        }

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
        console.log(`[WS] Client ${userId} disconnected from ${projectId}`)

        // Cleanup empty rooms
        if (room.size === 0) {
            rooms.delete(projectId)
        }
    })

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message)
    })
})

// 404 for unknown API routes (frontend is served by Nginx)
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1' // Only accessible from localhost (Nginx proxy)
server.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     LaTeX Online Editor Server             ║
╠════════════════════════════════════════════╣
║  HTTP Server:  http://${HOST}:${PORT}            ║
║  WebSocket:    ws://${HOST}:${PORT}/ws           ║
║  Access via:   Nginx proxy (port 8080)       ║
║                                            ║
║  Ready for LaTeX compilation!              ║
╚════════════════════════════════════════════╝
  `)
})
