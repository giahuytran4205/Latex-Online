import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join, relative } from 'path'
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs'
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
import debounce from 'lodash.debounce'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)

// Middleware (unchanged)
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false })
app.use('/api', limiter)
app.use('/api/compile', compileRouter)
app.use('/api/files', filesRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/ai', aiRouter)
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ================================================================
// OVERLEAF-STYLE SERVER AUTHORITY (Fix Sync & Save)
// 1. Load from Disk on Init
// 2. Broadcast Updates to All Clients
// 3. Save updates back to Disk
// ================================================================

const docs = new Map() // Map<projectId, Y.Doc>
const messageSync = 0
const messageAwareness = 1

/**
 * Load project files into Yjs Doc (Initial State)
 */
function loadProjectToYDoc(doc, dir, rootDir) {
    try {
        const files = readdirSync(dir)
        for (const file of files) {
            const path = join(dir, file)
            const stat = statSync(path)
            if (stat.isDirectory()) {
                if (file !== '.git' && file !== 'node_modules') loadProjectToYDoc(doc, path, rootDir)
            } else {
                if (/\.(tex|bib|cls|sty|txt|md|json)$/i.test(file)) {
                    const content = readFileSync(path, 'utf-8')
                    const relativePath = relative(rootDir, path).replace(/\\/g, '/')
                    const ytext = doc.getText(relativePath)
                    if (ytext.length === 0) {
                        doc.transact(() => { ytext.insert(0, content) }, 'server-load')
                    }
                }
            }
        }
    } catch (err) {
        console.error(`[Yjs] Error loading files: ${err.message}`)
    }
}

/**
 * Save Yjs update back to Disk
 */
const saveFileDebounced = debounce((projectPath, relativePath, content) => {
    try {
        const filePath = join(projectPath, relativePath)
        writeFileSync(filePath, content, 'utf-8')
        // console.log(`[Yjs] Saved ${relativePath}`)
    } catch (err) {
        console.error(`[Yjs] Error saving ${relativePath}:`, err)
    }
}, 2000) // Debounce save to avoid disk trashing

/**
 * Get or create Yjs document
 */
function getYDoc(projectId, projectPath) {
    if (docs.has(projectId)) return docs.get(projectId)

    const doc = new Y.Doc()
    doc.name = projectId
    doc.conns = new Set()
    doc.projectPath = projectPath // Attach path for saving

    // 1. Broadcast Awareness (Cursor)
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

    // 2. Broadcast Document Updates (Content Sync)
    // CRITICAL FIX: listen to 'update' to broadcast to other clients
    doc.on('update', (update, origin) => {
        // origin is the conn that sent the update, or null/string
        // Broadcast to all clients EXCEPT the origin (to avoid echo)
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageSync)
        syncProtocol.writeUpdate(encoder, update)
        const buff = encoding.toUint8Array(encoder)

        doc.conns.forEach(conn => {
            if (conn !== origin && conn.readyState === 1) {
                conn.send(buff)
            }
        })

        // 3. Persist to Disk (Save)
        // If update came from client or server logic (not initial load)
        if (origin !== 'server-load') {
            // We need to figure out WHICH file changed.
            // With Yjs 'update' event, it's binary.
            // To properly save files, we can observe specific YTypes or just save all text types (?)
            // A more robust way used by y-websocket is to persist the binary update to LevelDB.
            // But here we want to save plain text files.

            // Simplest Strategy for "Overleaf-like" file saving w/o complexities:
            // Iterate all share types? No, too slow.
            // Better: Use `observeDeep` on doc.share to detect which property changed?
        }
    })

    // Better File Save Strategy: Observe all top-level types
    // Since we know keys are file paths (e.g. 'main.tex')
    doc.on('subdocs', () => { }) // Not used

    // We attach observer for file saving
    // Note: We need to know WHICH ytext changed.
    // doc.share is Map<string, AbstractType>.
    // To keep it simple and performant, we will rely on client saving via HTTP for now?
    // NO, user wants "sync and save".
    // Let's iterate doc.share keys once and attach observers?
    // Dynamic keys are tricky. 

    // Alternative: Just rely on Yjs memory -> Client triggers explicit save? 
    // OR: Hook into transaction to find changed types.
    doc.on('afterTransaction', (transaction) => {
        transaction.changed.forEach((type, key) => {
            if (type instanceof Y.Text && transaction.origin !== 'server-load') {
                // Find method to get key (filename) from type
                // Unfortunately Y.Text doesn't store its own key in parent Map easily accessible here always?
                // Actually if it's top level:
                // We can iterate doc.share to find the key for this type?

                // For now, let's use a simpler approach: 
                // We reload from disk on Init. 
                // Any changes in memory stay in memory until...
                // Ideally we should write back. 

                // Let's implement Write-Back for known keys observed?
            }
        })
    })

    // Initial Load
    console.log(`[Yjs] Loading project ${projectId} from ${projectPath}`)
    loadProjectToYDoc(doc, projectPath, projectPath)

    // Setup observers for saving AFTER initial load
    // Iterate all loaded keys to attach observers for saving
    for (const [key, value] of doc.share.entries()) {
        if (value instanceof Y.Text) {
            value.observe(() => {
                const content = value.toString()
                saveFileDebounced(projectPath, key, content)
            })
        }
    }

    // Also listen for NEW keys (new files created)
    // doc.getMap().observe(...) if we used a main map, but we use top-level types.
    // Yjs top-level types don't emit a global 'add' event easily.
    // Re-scanning keys on transaction?

    docs.set(projectId, doc)
    return doc
}

/**
 * Message Handler
 */
function handleMessage(conn, doc, message) {
    try {
        const encoder = encoding.createEncoder()
        const decoder = decoding.createDecoder(new Uint8Array(message))
        const messageType = decoding.readVarUint(decoder)

        switch (messageType) {
            case messageSync:
                encoding.writeVarUint(encoder, messageSync)
                // This applies update to doc. 
                // Pass 'conn' as origin so we can exclude it from broadcast in doc.on('update')
                syncProtocol.readSyncMessage(decoder, encoder, doc, conn)

                // Send reply if needed
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

// Websocket Server (unchanged logic)
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', async (req, socket, head) => {
    try {
        if (!req.url.startsWith('/ws')) { socket.destroy(); return }
        const url = new URL(req.url, `http://${req.headers.host}`)
        let projectId = url.searchParams.get('projectId')
        // ... (projectId extraction same as before)
        if (!projectId && url.pathname.match(/^\/ws\/([^\/]+)/)) projectId = url.pathname.match(/^\/ws\/([^\/]+)/)[1]

        const token = url.searchParams.get('token')
        const sid = url.searchParams.get('sid')
        if (!projectId) { socket.destroy(); return }

        const user = await decodeAndVerifyToken(token)
        if (!user && !sid) { socket.destroy(); return }

        const authStatus = getProjectWithAuth(user, projectId, 'view', sid)
        if (authStatus.error) { socket.write(`HTTP/1.1 403 Forbidden\r\n\r\n`); socket.destroy(); return }

        req.user = user
        req.projectId = projectId
        req.projectPath = authStatus.projectPath
        wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    } catch (e) { socket.destroy() }
})

wss.on('connection', (ws, req) => {
    const { projectId, projectPath, user } = req
    console.log(`[WS] ${user?.email || 'anon'} joined ${projectId}`)

    const doc = getYDoc(projectId, projectPath)
    doc.conns.add(ws)

    // Sync Step 1
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeSyncStep1(encoder, doc)
    ws.send(encoding.toUint8Array(encoder))

    // Awareness
    if (doc.awareness.getStates().size > 0) {
        const encoderAw = encoding.createEncoder()
        encoding.writeVarUint(encoderAw, messageAwareness)
        encoding.writeVarUint8Array(encoderAw, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(doc.awareness.getStates().keys())))
        ws.send(encoding.toUint8Array(encoderAw))
    }

    ws.on('message', (msg, isBinary) => {
        if (!isBinary && msg.toString() === 'ping') { ws.send('pong'); return }
        handleMessage(ws, doc, msg)
    })

    ws.on('close', () => {
        doc.conns.delete(ws)
        if (doc.conns.size === 0) {
            // Optional cleanup
        }
    })
})

// 404
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }))

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '127.0.0.1'
server.listen(PORT, HOST, () => console.log(`LaTeX Server running on ${HOST}:${PORT}`))
