import express from 'express'
import { compileLatex } from '../services/latex.js'

const router = express.Router()

router.post('/', async (req, res) => {
    const { code, engine = 'pdflatex', filename = 'main.tex' } = req.body

    if (!code) {
        return res.status(400).json({
            success: false,
            error: 'No LaTeX code provided',
        })
    }

    // Validate engine
    const validEngines = ['pdflatex', 'xelatex', 'lualatex']
    if (!validEngines.includes(engine)) {
        return res.status(400).json({
            success: false,
            error: `Invalid engine. Must be one of: ${validEngines.join(', ')}`,
        })
    }

    try {
        console.log(`[Compile] Starting compilation with ${engine}...`)
        const startTime = Date.now()

        const result = await compileLatex(code, engine, filename)

        const compilationTime = Date.now() - startTime
        console.log(`[Compile] Completed in ${compilationTime}ms`)

        res.json({
            success: result.success,
            pdfUrl: result.pdfPath ? `/api/files/output/${result.pdfPath}` : null,
            logs: result.logs,
            errors: result.errors,
            compilationTime,
        })
    } catch (error) {
        console.error('[Compile] Error:', error)
        res.status(500).json({
            success: false,
            error: error.message,
            logs: error.logs || '',
        })
    }
})

export default router
