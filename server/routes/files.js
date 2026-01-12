import express from 'express'
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

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

// Serve temporary files (PDFs)
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

// Helper to get project path
const getProjectPath = (projectId) => {
    const path = join(PROJECTS_DIR, projectId)
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true })
        // Create default files if new project
        writeFileSync(join(path, 'main.tex'), `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\title{New Project}
\\author{You}
\\date{\\today}
\\begin{document}
\\maketitle
\\section{Introduction}
Start typing...
\\end{document}`)
    }
    return path
}

// Get project files (recursive)
router.get('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const projectPath = getProjectPath(projectId)

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
        const decodedFilename = decodeURIComponent(filename)
        const filePath = join(getProjectPath(projectId), decodedFilename)

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
        const decodedFilename = decodeURIComponent(filename)
        const filePath = join(getProjectPath(projectId), decodedFilename)

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Get just the base filename for download
        const baseName = decodedFilename.split('/').pop()
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}"`)
        res.sendFile(filePath)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Save file
router.put('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const { content } = req.body
        const decodedFilename = decodeURIComponent(filename)
        const projectPath = getProjectPath(projectId)
        const filePath = join(projectPath, decodedFilename)

        // Ensure parent directory exists
        const parentDir = dirname(filePath)
        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
        }

        writeFileSync(filePath, content)

        res.json({ success: true, filename: decodedFilename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Create file or folder
router.post('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const { filename, content = '' } = req.body

        if (!filename) return res.status(400).json({ error: 'Filename required' })

        const projectPath = getProjectPath(projectId)
        const filePath = join(projectPath, filename)

        // Check if it's a folder (ends with /)
        const isFolder = filename.endsWith('/')

        if (existsSync(filePath)) {
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
            // Create file
            writeFileSync(filePath, content)
        }

        res.json({ success: true, filename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Delete file or folder
router.delete('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        // Handle URL encoded paths (for nested files)
        const decodedFilename = decodeURIComponent(filename)
        const filePath = join(getProjectPath(projectId), decodedFilename)

        if (existsSync(filePath)) {
            const stats = statSync(filePath)
            if (stats.isDirectory()) {
                // Use rmSync for directories (Node 14.14+)
                const { rmSync } = require('fs')
                rmSync(filePath, { recursive: true, force: true })
            } else {
                unlinkSync(filePath)
            }
        }

        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Rename file
router.post('/:projectId/rename', (req, res) => {
    try {
        const { projectId } = req.params
        const { oldName, newName } = req.body
        const projectPath = getProjectPath(projectId)
        const oldPath = join(projectPath, oldName)
        const newPath = join(projectPath, newName)

        if (!existsSync(oldPath)) {
            return res.status(404).json({ error: 'File not found' })
        }
        if (existsSync(newPath)) {
            return res.status(400).json({ error: 'Destination exists' })
        }

        renameSync(oldPath, newPath)
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

export default router
