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

// Yjs imports for server-side persistence
import * as Y from 'yjs'
import { LeveldbPersistence } from 'y-leveldb'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)

// ================================================================
// YJS SERVER-SIDE PERSISTENCE
// ================================================================

// Initialize LevelDB persistence for Yjs documents
const PERSISTENCE_DIR = join(__dirname, '../data/yjs-docs')
const persistence = new LeveldbPersistence(PERSISTENCE_DIR)

// Message types for y-websocket protocol
const messageSync = 0
const messageAwareness = 1

// Store for active documents and their connections
const docs = new Map()

/**
 * Get or create a Yjs document with persistence
 */
async function getYDoc(docName) {
    if (docs.has(docName)) {
        return docs.get(docName)
    }

    const doc = new Y.Doc()
    doc.name = docName

    // Load persisted state if exists
    const persistedYdoc = await persistence.getYDoc(docName)
    if (persistedYdoc) {
        const state = Y.encodeStateAsUpdate(persistedYdoc)
        Y.applyUpdate(doc, state)
        console.log(`[Yjs] Loaded persisted doc: ${docName}`)
    }

    // Set up persistence on updates
    doc.on('update', async (update, origin) => {
        // Only persist updates from clients, not from loading
        if (origin !== 'persistence') {
            await persistence.storeUpdate(docName, update)
        }
    })

    // Create awareness for this doc
    doc.awareness = new awarenessProtocol.Awareness(doc)
    doc.awareness.on('update', ({ added, updated, removed }) => {
        const changedClients = added.concat(updated, removed)
        broadcastAwareness(doc, changedClients)
    })

    // Track connected clients
    doc.conns = new Set()

    docs.set(docName, doc)
    return doc
}

/**
 * Broadcast awareness to all connected clients
 */
function broadcastAwareness(doc, changedClients) {
    if (changedClients.length === 0) return

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changedClients))
    const message = encoding.toUint8Array(encoder)

    doc.conns.forEach(conn => {
        if (conn.readyState === 1) {
            conn.send(message)
        }
    })
}

/**
 * Handle incoming Yjs messages
 */
function handleMessage(conn, doc, message) {
    try {
        const messageBuffer = new Uint8Array(message)
        const decoder = decoding.createDecoder(messageBuffer)
        const messageType = decoding.readVarUint(decoder)

        switch (messageType) {
            case messageSync: {
                const encoder = encoding.createEncoder()
                encoding.writeVarUint(encoder, messageSync)
                const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, conn)

                // If there's a response to send back to this client
                if (encoding.length(encoder) > 1) {
                    conn.send(encoding.toUint8Array(encoder))
                }

                // CRITICAL: Broadcast the original message to all OTHER clients
                // This ensures real-time sync between collaborators
                doc.conns.forEach(client => {
                    if (client !== conn && client.readyState === 1) {
                        client.send(messageBuffer)
                    }
                })
                break
            }
            case messageAwareness: {
                awarenessProtocol.applyAwarenessUpdate(
                    doc.awareness,
                    decoding.readVarUint8Array(decoder),
                    conn
                )
                // Awareness is already broadcast via the awareness 'update' event
                // But we should also relay to other clients directly
                doc.conns.forEach(client => {
                    if (client !== conn && client.readyState === 1) {
                        client.send(messageBuffer)
                    }
                })
                break
            }
        }
    } catch (err) {
        console.error('[Yjs] Error handling message:', err.message)
    }
}


/**
 * Send sync step 1 to new client
 */
function sendSyncStep1(conn, doc) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    conn.send(encoding.toUint8Array(encoder))
}

/**
 * Send full awareness state to new client
 */
function sendAwarenessState(conn, doc) {
    const awarenessStates = doc.awareness.getStates()
    if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageAwareness)
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(
            doc.awareness,
            Array.from(awarenessStates.keys())
        ))
        conn.send(encoding.toUint8Array(encoder))
    }
}

/**
 * Cleanup when client disconnects
 */
function closeConn(conn, doc) {
    if (!doc.conns.has(conn)) return

    doc.conns.delete(conn)

    // Remove awareness state for this client
    awarenessProtocol.removeAwarenessStates(
        doc.awareness,
        [doc.awareness.clientID],
        null
    )

    // Cleanup doc if no more connections (optional: keep for persistence)
    if (doc.conns.size === 0) {
        // Keep the doc in memory for quick reconnection
        // You could also remove it to save memory:
        // docs.delete(doc.name)
        console.log(`[Yjs] No more clients for doc: ${doc.name}`)
    }
}

// ================================================================
// EXPRESS MIDDLEWARE
// ================================================================

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ================================================================
// WEBSOCKET SERVER WITH YJS PERSISTENCE
// ================================================================

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', async (request, socket, head) => {
    try {
        if (request.url.startsWith('/ws')) {
            const url = new URL(request.url, `http://${request.headers.host}`)

            // Get projectId from path or query
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

            // Verify User
            const user = await decodeAndVerifyToken(token)
            if (!user && !sid) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
                socket.destroy()
                return
            }

            // Verify Permission
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

wss.on('connection', async (ws, req) => {
    const projectId = req.projectId || 'default'
    const user = req.user
    const userId = user?.uid || 'anonymous'

    console.log(`[WS] User ${userId} (${user?.email}) joined project ${projectId}`)

    // Get or create the Yjs document
    const doc = await getYDoc(projectId)
    doc.conns.add(ws)

    // Send sync step 1 (document state) to new client
    sendSyncStep1(ws, doc)

    // Send current awareness state
    sendAwarenessState(ws, doc)

    // Handle incoming messages
    ws.on('message', (message, isBinary) => {
        // Handle text ping/pong
        if (!isBinary && message.toString() === 'ping') {
            ws.send('pong')
            return
        }

        // Handle Yjs messages
        if (isBinary || Buffer.isBuffer(message)) {
            handleMessage(ws, doc, message)
        }
    })

    ws.on('close', () => {
        closeConn(ws, doc)
        console.log(`[WS] Client ${userId} disconnected from ${projectId}`)
    })

    ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message)
        closeConn(ws, doc)
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
║  Yjs Persist:  ${PERSISTENCE_DIR}    ║
║                                            ║
║  ★ Server-side Yjs persistence enabled     ║
║  Ready for LaTeX collaboration!            ║
╚════════════════════════════════════════════╝
  `)
})
