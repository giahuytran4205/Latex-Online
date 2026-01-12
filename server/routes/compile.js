import express from 'express'
import { compileLatex } from '../services/latex.js'

const router = express.Router()

router.post('/', async (req, res) => {
    try {
        const { code, engine, filename } = req.body
        // Use default project ID for now, in future retrieve from auth/session
        const projectId = 'default-project'

        // Note: We ignore 'code' param in favor of persisted files for multi-file support
        // unless 'code' is provided explicitly for single-file compile without save

        const result = await compileLatex(projectId, engine || 'pdflatex', filename || 'main', code)

        if (result.success) {
            // Return URL to PDF
            res.json({
                success: true,
                pdfUrl: `/api/files/output/${result.pdfPath}`,
                logs: result.logs
            })
        } else {
            res.json({
                success: false,
                logs: result.logs,
                errors: result.errors
            })
        }
    } catch (error) {
        console.error('Compilation error:', error)
        res.status(500).json({
            success: false,
            logs: error.message,
            errors: [error.message]
        })
    }
})

export default router
