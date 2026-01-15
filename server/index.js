import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import compileRouter from './routes/compile.js'
import filesRouter from './routes/files.js'
import projectsRouter from './routes/projects.js'
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
app.use(express.static(join(__dirname, '../client/dist')))

// API Routes
app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)
app.use('/api/projects', projectsRouter)

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
            const projectId = url.searchParams.get('projectId')
            const token = url.searchParams.get('token')
            const sid = url.searchParams.get('sid')

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

            // Attach user info to request for the connection handler
            request.user = user

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
    const url = new URL(req.url, `http://${req.headers.host}`)
    const projectId = url.searchParams.get('projectId') || 'default'
    const user = req.user // Attached during upgrade
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
