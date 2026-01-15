import express from 'express'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync, renameSync, rmSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'
import { getProjectWithAuth } from '../utils/project.js'
import admin from 'firebase-admin'
import { verifyToken } from '../services/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = express.Router()

// Project storage directory
const PROJECTS_DIR = join(__dirname, '../../projects')

// Ensure projects directory exists
if (!existsSync(PROJECTS_DIR)) {
    mkdirSync(PROJECTS_DIR, { recursive: true })
}

const TEMP_DIR = join(__dirname, '../temp')
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
}

// verifyToken is imported from services/auth.js

// Serve temporary files (PDFs) - no auth required
router.get('/temp/:filename', (req, res) => {
    try {
        const { filename } = req.params
        const filePath = join(TEMP_DIR, filename)

        console.log(`[Files] Request for temp file: ${filename}`)

        if (!existsSync(filePath)) {
            console.error(`[Files] File not found: ${filePath}`)
            return res.status(404).json({ error: 'File not found' })
        }

        console.log(`[Files] Serving: ${filePath}`)
        res.setHeader('Content-Type', 'application/pdf')
        res.sendFile(filePath)
    } catch (err) {
        console.error(`[Files] Error serving file: ${err.message}`)
        res.status(500).json({ error: err.message })
    }
})

// Apply auth middleware to remaining routes
router.use(verifyToken)

// getProjectWithAuth and findProjectInfo are now imported from ../utils/project.js

// Get project files (recursive)
router.get('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'view', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { projectPath } = auth

        // Recursively get all files
        const getAllFiles = (dir, basePath = '') => {
            const items = readdirSync(dir)
            let files = []

            for (const item of items) {
                if (item.startsWith('.')) continue

                const fullPath = join(dir, item)
                const relativePath = basePath ? `${basePath}/${item}` : item
                const stats = statSync(fullPath)

                if (stats.isDirectory()) {
                    // Add folder entry
                    files.push({
                        name: relativePath + '/',
                        type: 'folder',
                        size: 0,
                        updatedAt: stats.mtime
                    })
                    // Recursively get files in folder
                    files = files.concat(getAllFiles(fullPath, relativePath))
                } else {
                    files.push({
                        name: relativePath,
                        type: extname(item).substring(1) || 'txt',
                        size: stats.size,
                        updatedAt: stats.mtime
                    })
                }
            }

            return files
        }

        const files = getAllFiles(projectPath)
        res.json({ files })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Get file content
router.get('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'view', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const decodedFilename = decodeURIComponent(filename)
        const filePath = join(auth.projectPath, decodedFilename)

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        const content = readFileSync(filePath, 'utf-8')
        res.json({ filename: decodedFilename, content })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Download file
router.get('/:projectId/:filename/download', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'view', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const decodedFilename = decodeURIComponent(filename)
        const filePath = join(auth.projectPath, decodedFilename)

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Get just the base filename for download
        const baseName = decodedFilename.split('/').pop()
        const isView = req.query.mode === 'view'
        const ext = extname(baseName).toLowerCase()

        if (isView) {
            // Set proper content type for viewing
            if (ext === '.pdf') res.setHeader('Content-Type', 'application/pdf')
            else if (ext === '.png') res.setHeader('Content-Type', 'image/png')
            else if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg')
            else if (ext === '.svg') res.setHeader('Content-Type', 'image/svg+xml')
            else if (ext === '.gif') res.setHeader('Content-Type', 'image/gif')

            res.setHeader('Content-Disposition', 'inline')
        } else {
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`)
        }

        res.sendFile(filePath)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Save file
router.put('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { content } = req.body
        const decodedFilename = decodeURIComponent(filename)
        const { projectPath, ownerId } = auth
        const filePath = join(projectPath, decodedFilename)

        // Ensure parent directory exists
        const parentDir = dirname(filePath)
        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
        }

        // Check if content is base64 encoded binary (starts with data:)
        if (typeof content === 'string' && content.startsWith('data:')) {
            // Extract base64 data after the comma
            const base64Data = content.split(',')[1]
            const buffer = Buffer.from(base64Data, 'base64')
            writeFileSync(filePath, buffer)
        } else {
            // Regular text file
            writeFileSync(filePath, content || '')
        }

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true, filename: decodedFilename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Create file or folder
router.post('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { filename, content = '', overwrite = false } = req.body
        if (!filename) return res.status(400).json({ error: 'Filename required' })

        const { projectPath, ownerId } = auth
        const filePath = join(projectPath, filename)

        // Check if it's a folder (ends with /)
        const isFolder = filename.endsWith('/')

        if (existsSync(filePath) && !overwrite) {
            return res.status(400).json({ error: isFolder ? 'Folder already exists' : 'File already exists' })
        }

        if (isFolder) {
            // Create folder
            mkdirSync(filePath, { recursive: true })
        } else {
            // Create parent directories if needed
            const parentDir = dirname(filePath)
            if (!existsSync(parentDir)) {
                mkdirSync(parentDir, { recursive: true })
            }

            // Check if content is base64 encoded binary
            if (typeof content === 'string' && content.startsWith('data:')) {
                const base64Data = content.split(',')[1]
                const buffer = Buffer.from(base64Data, 'base64')
                writeFileSync(filePath, buffer)
            } else {
                writeFileSync(filePath, content || '')
            }
        }

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true, filename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Delete file or folder
router.delete('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        // Handle URL encoded paths (for nested files)
        const decodedFilename = decodeURIComponent(filename)
        const { projectPath, ownerId } = auth
        const filePath = join(projectPath, decodedFilename)

        if (existsSync(filePath)) {
            const stats = statSync(filePath)
            if (stats.isDirectory()) {
                // Use rmSync for directories (Node 14.14+)
                rmSync(filePath, { recursive: true, force: true })
            } else {
                unlinkSync(filePath)
            }
        }

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Rename file
router.post('/:projectId/rename', (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { oldName, newName } = req.body
        const { projectPath, ownerId } = auth
        const oldPath = join(projectPath, oldName)
        const newPath = join(projectPath, newName)

        if (!existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' })
        }
        if (existsSync(newPath)) {
            return res.status(400).json({ error: 'Destination exists' })
        }

        // Create parent directory if needed
        const parentDir = dirname(newPath)
        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
        }

        renameSync(oldPath, newPath)

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Duplicate file
router.post('/:projectId/duplicate', (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { filename } = req.body
        const { projectPath, ownerId } = auth
        const srcPath = join(projectPath, filename)

        if (!existsSync(srcPath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Generate new name with -copy suffix
        const ext = extname(filename)
        const base = filename.slice(0, -ext.length || undefined)
        let newName = `${base}-copy${ext}`
        let counter = 1

        while (existsSync(join(projectPath, newName))) {
            counter++
            newName = `${base}-copy${counter}${ext}`
        }

        const destPath = join(projectPath, newName)

        // Copy file content
        const content = readFileSync(srcPath)
        writeFileSync(destPath, content)

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true, newFilename: newName })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Move file (change path)
router.post('/:projectId/move', (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { oldPath: oldName, newPath: newName } = req.body
        const { projectPath, ownerId } = auth
        const oldPath = join(projectPath, oldName)
        const newPath = join(projectPath, newName)

        if (!existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' })
        }
        if (existsSync(newPath)) {
            return res.status(400).json({ error: 'Destination exists' })
        }

        // Create parent directory if needed
        const parentDir = dirname(newPath)
        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
        }

        renameSync(oldPath, newPath)

        // Update project metadata
        updateProjectTimestamp(ownerId, projectId)

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Helper to update project timestamp
function updateProjectTimestamp(userId, projectId) {
    try {
        const metadataPath = join(PROJECTS_DIR, userId, projectId, '.project.json')
        if (existsSync(metadataPath)) {
            const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
            metadata.updatedAt = new Date().toISOString()
            writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
        }
    } catch (e) {
        // Ignore errors
    }
}

export default router
