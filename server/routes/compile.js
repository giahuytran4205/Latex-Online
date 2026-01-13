import express from 'express'
import { compileLatex } from '../services/latex.js'
import admin from 'firebase-admin'

const router = express.Router()

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // For development, use mock user
        req.user = { uid: 'dev-user', email: 'dev@localhost' }
        return next()
    }

    const token = authHeader.split('Bearer ')[1]
    try {
        if (!admin.apps.length) {
            req.user = { uid: 'dev-user', email: 'dev@localhost' }
            return next()
        }

        const decodedToken = await admin.auth().verifyIdToken(token)
        req.user = decodedToken
        next()
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.message)
        req.user = { uid: 'dev-user', email: 'dev@localhost' }
        next()
    }
}

router.use(verifyToken)

// POST /api/compile
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.uid || 'dev-user'
        const { projectId, filename, engine, code } = req.body

        // Basic validation
        if (!projectId) {
            return res.status(400).json({ success: false, error: 'Missing projectId' })
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

export default router
