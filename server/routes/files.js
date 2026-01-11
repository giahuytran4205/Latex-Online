import express from 'express'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = express.Router()

// Serve compiled PDF files
router.get('/output/:filename', (req, res) => {
    const { filename } = req.params
    const filePath = join(__dirname, '../temp', filename)

    if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.sendFile(filePath)
})

// Get project files
router.get('/:projectId', (req, res) => {
    // For demo, return static file list
    res.json({
        files: [
            { name: 'main.tex', type: 'tex', size: 1024 },
            { name: 'references.bib', type: 'bib', size: 256 },
        ],
    })
})

// Get file content
router.get('/:projectId/:filename', (req, res) => {
    const { projectId, filename } = req.params
    // For demo, return placeholder content
    res.json({
        filename,
        content: '% File content would be here',
    })
})

// Save file
router.put('/:projectId/:filename', (req, res) => {
    const { projectId, filename } = req.params
    const { content } = req.body

    // In a real app, save to disk/database
    console.log(`[Files] Saving ${filename} (${content.length} bytes)`)

    res.json({
        success: true,
        filename,
        savedAt: new Date().toISOString(),
    })
})

export default router
