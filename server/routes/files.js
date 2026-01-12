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

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        res.sendFile(filePath)
    } catch (err) {
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

// Get project files
router.get('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const projectPath = getProjectPath(projectId)

        const files = readdirSync(projectPath)
            .filter(file => !file.startsWith('.'))
            .map(file => {
                const stats = statSync(join(projectPath, file))
                return {
                    name: file,
                    type: extname(file).substring(1) || 'txt',
                    size: stats.size,
                    updatedAt: stats.mtime
                }
            })

        res.json({ files })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Get file content
router.get('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const filePath = join(getProjectPath(projectId), filename)

        if (!existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        const content = readFileSync(filePath, 'utf-8')
        res.json({ filename, content })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Save file
router.put('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const { content } = req.body
        const projectPath = getProjectPath(projectId)

        writeFileSync(join(projectPath, filename), content)

        res.json({ success: true, filename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Create file
router.post('/:projectId', (req, res) => {
    try {
        const { projectId } = req.params
        const { filename, content = '' } = req.body

        if (!filename) return res.status(400).json({ error: 'Filename required' })

        const filePath = join(getProjectPath(projectId), filename)

        if (existsSync(filePath)) {
            return res.status(400).json({ error: 'File already exists' })
        }

        writeFileSync(filePath, content)
        res.json({ success: true, filename })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// Delete file
router.delete('/:projectId/:filename', (req, res) => {
    try {
        const { projectId, filename } = req.params
        const filePath = join(getProjectPath(projectId), filename)

        if (existsSync(filePath)) {
            unlinkSync(filePath)
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
