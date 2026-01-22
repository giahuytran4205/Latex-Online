import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join, relative } from 'path'
import { readdirSync, statSync, readFileSync } from 'fs'
import compileRouter from './routes/compile.js'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import filesRouter from './routes/files.js'
import projectsRouter from './routes/projects.js'
import aiRouter from './routes/ai.js'
import { decodeAndVerifyToken } from './services/auth.js'
import { getProjectWithAuth } from './utils/project.js'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware
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

app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/ai', aiRouter)

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ================================================================
// OVERLEAF-STYLE SERVER AUTHORITY
// Single Source of Truth: In-Memory Yjs Docs initialized from Disk
// ================================================================

// Store for active documents: Map<projectId, Y.Doc>
const docs = new Map()

const messageSync = 0
const messageAwareness = 1

/**
 * Load all project files into Yjs Doc
 */
function loadProjectToYDoc(doc, dir, rootDir) {
    try {
        const files = readdirSync(dir)
        for (const file of files) {
            const path = join(dir, file)
            const stat = statSync(path)

            if (stat.isDirectory()) {
                if (file !== '.git' && file !== 'node_modules') {
                    loadProjectToYDoc(doc, path, rootDir)
                }
            } else {
                // Read text files
                if (/\.(tex|bib|cls|sty|txt|md|json)$/i.test(file)) {
                    const content = readFileSync(path, 'utf-8')
                    const relativePath = relative(rootDir, path).replace(/\\/g, '/')

                    // Initialize Y.Text for this file
                    const ytext = doc.getText(relativePath)
                    if (ytext.length === 0) {
                        doc.transact(() => {
                            ytext.insert(0, content)
                        })
                        // console.log(`[Yjs] Loaded ${relativePath} (${content.length} chars)`)
                    }
                }
            }
        }
    } catch (err) {
        console.error(`[Yjs] Error loading project files: ${err.message}`)
    }
}

/**
 * Get or create Yjs document for project
 */
function getYDoc(projectId, projectPath) {
    if (docs.has(projectId)) {
        return docs.get(projectId)
    }

    // New Doc
    const doc = new Y.Doc()
    doc.name = projectId

    // Initialize awareness
    doc.awareness = new awarenessProtocol.Awareness(doc)
    doc.awareness.on('update', ({ added, updated, removed }) => {
        const changedClients = added.concat(updated, removed)
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageAwareness)
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changedClients))
        const buff = encoding.toUint8Array(encoder)

        doc.conns.forEach(conn => {
            if (conn.readyState === 1) conn.send(buff)
        })
    })

    // Track connections
    doc.conns = new Set()

    // 1. Initial Load from Disk (Server Authority)
    console.log(`[Yjs] Loading project ${projectId} from ${projectPath}`)
    loadProjectToYDoc(doc, projectPath, projectPath)

    docs.set(projectId, doc)

    // Auto cleanup if no connections after 30 mins (optional cache)
    // For now we keep it to support "hot" reload

    return doc
}

/**
 * Handle Yjs Protocol Message
 */
function handleMessage(conn, doc, message) {
    try {
        const encoder = encoding.createEncoder()
        const decoder = decoding.createDecoder(new Uint8Array(message))
        const messageType = decoding.readVarUint(decoder)

        switch (messageType) {
            case messageSync:
                encoding.writeVarUint(encoder, messageSync)
                syncProtocol.readSyncMessage(decoder, encoder, doc, conn)
                if (encoding.length(encoder) > 1) {
                    conn.send(encoding.toUint8Array(encoder))
                }
                break
            case messageAwareness:
                awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(decoder), conn)
                break
        }
    } catch (err) {
        console.error(err)
    }
}

// ================================================================
// WEBSOCKET SERVER
// ================================================================

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', async (request, socket, head) => {
    try {
        if (request.url.startsWith('/ws')) {
            const url = new URL(request.url, `http://${request.headers.host}`)
            let projectId = url.searchParams.get('projectId')
            if (!projectId && url.pathname.match(/^\/ws\/([^\/]+)/)) {
                projectId = url.pathname.match(/^\/ws\/([^\/]+)/)[1]
            }

            const token = url.searchParams.get('token')
            const sid = url.searchParams.get('sid')

            if (!projectId) {
                socket.destroy(); return
            }

            const user = await decodeAndVerifyToken(token)
            if (!user && !sid) {
                socket.destroy(); return
            }

            // Verify auth and get fresh project path
            const authStatus = getProjectWithAuth(user, projectId, 'view', sid)
            if (authStatus.error) {
                socket.write(`HTTP/1.1 403 Forbidden\r\n\r\n${authStatus.error}`)
                socket.destroy()
                return
            }

            request.user = user
            request.projectId = projectId
            request.projectPath = authStatus.projectPath // Important for loading files

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request)
            })
        } else {
            socket.destroy()
        }
    } catch (err) {
        socket.destroy()
    }
})

wss.on('connection', (ws, req) => {
    const { projectId, projectPath, user } = req
    console.log(`[WS] User ${user?.email || 'anon'} joined ${projectId}`)

    // Get Authoritative Doc
    const doc = getYDoc(projectId, projectPath)
    doc.conns.add(ws)

    // Send Sync Step 1 immediately
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    ws.send(encoding.toUint8Array(encoder))

    // Send Awareness states
    if (doc.awareness.getStates().size > 0) {
        const encoderAw = encoding.createEncoder()
        encoding.writeVarUint(encoderAw, messageAwareness)
        encoding.writeVarUint8Array(encoderAw, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(doc.awareness.getStates().keys())))
        ws.send(encoding.toUint8Array(encoderAw))
    }

    ws.on('message', (message, isBinary) => {
        if (!isBinary && message.toString() === 'ping') {
            ws.send('pong'); return
        }
        // Handle sync/awareness
        handleMessage(ws, doc, message)
    })

    ws.on('close', () => {
        doc.conns.delete(ws)
        if (doc.conns.size === 0) {
            // Optional: Persist back to disk here if needed, 
            // currently Yjs memory state is lost on server restart (which is fine for dev)
            // Ideally use y-leveldb for crash recovery
            docs.delete(projectId)
        }
    })
})

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' })
})

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'
server.listen(PORT, HOST, () => {
    console.log(`LaTeX Online Server running on ${HOST}:${PORT}`)
})
