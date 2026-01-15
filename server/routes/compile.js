import express from 'express'
import { compileLatex, resolveSyncTeX } from '../services/latex.js'
import admin from 'firebase-admin'
import { verifyToken } from '../services/auth.js'
import { getProjectWithAuth } from '../utils/project.js'

const router = express.Router()

// verifyToken is imported from services/auth.js

router.use(verifyToken)

// POST /api/compile
router.post('/', async (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId, filename, engine, code } = req.body

        // Check permissions
        const auth = getProjectWithAuth(req.user, projectId, 'edit')
        if (auth.error) {
            return res.status(auth.status).json({ success: false, error: auth.error })
        }

        console.log(`[Compile] Request for project ${projectId} by user ${userId} (${engine || 'pdflatex'})`)

        const result = await compileLatex(projectId, engine, filename, code, userId)

        if (result.success) {
            res.json({
                success: true,
                pdf: `/api/files/temp/${result.pdfPath}`,
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

// GET /api/compile/synctex
router.get('/synctex', async (req, res) => {
    try {
        const { projectId, page, x, y } = req.query
        if (!projectId || !page || !x || !y) {
            return res.status(400).json({ success: false, error: 'Missing parameters' })
        }

        const auth = getProjectWithAuth(req.user, projectId, 'view')
        if (auth.error) return res.status(auth.status).json({ success: false, error: auth.error })

        const result = await resolveSyncTeX(projectId, parseInt(page), parseFloat(x), parseFloat(y))
        res.json({ success: true, ...result })
    } catch (error) {
        console.error('[SyncTeX] Error:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

export default router
