import express from 'express'
import { compileLatex } from '../services/latex.js'

const router = express.Router()

// POST /api/compile
router.post('/', async (req, res) => {
    try {
        const { projectId, filename, engine, code } = req.body

        // Basic validation
        if (!projectId) {
            return res.status(400).json({ success: false, error: 'Missing projectId' })
        }

        console.log(`[Compile] Request for project ${projectId} (${engine || 'pdflatex'})`)

        const result = await compileLatex(projectId, engine, filename, code)

        if (result.success) {
            res.json({
                success: true,
                pdf: `/api/files/temp/${result.pdfPath}`, // Adjusted path based on typical structure
                logs: result.logs
            })
        } else {
            res.status(400).json({
                success: false,
                logs: result.logs,
                errors: result.errors
            })
        }

    } catch (error) {
        console.error('[Compile] Error:', error)
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            details: error.message
        })
    }
})

export default router
