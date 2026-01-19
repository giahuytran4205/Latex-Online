import admin from 'firebase-admin'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Firebase Admin if possible
// Look for service account in many possible locations
const possiblePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    join(__dirname, '../../service-account.json'),
    join(__dirname, '../config/service-account.json'),
    join(__dirname, '../firebase-service-account.json')
].filter(Boolean)

if (!admin.apps.length) {
    let initialized = false
    for (const path of possiblePaths) {
        if (existsSync(path)) {
            try {
                const serviceAccount = JSON.parse(readFileSync(path, 'utf8'))
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                })
                console.log(`[Auth] Firebase Admin initialized using: ${path}`)
                initialized = true
                break
            } catch (error) {
                console.error(`[Auth] Failed to initialize Firebase Admin from ${path}:`, error.message)
            }
        }
    }

    if (!initialized) {
        console.warn('[Auth] NO Firebase service account found. Real token verification will be DISABLED!')
        console.warn('[Auth] In production, set FIREBASE_SERVICE_ACCOUNT env var or place service-account.json in server root.')
    }
}

/**
 * Decode JWT without verification (for development ONLY)
 * This allows different accounts to have different UIDs even without a server secret.
 */
function decodeTokenUnsafe(token) {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        const payloadBase64 = parts[1]
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString())
        return {
            uid: payload.user_id || payload.sub || 'anonymous',
            email: payload.email || '',
            ...payload
        }
    } catch (e) {
        return null
    }
}

/**
 * Standalone function to verify token (used for WebSockets)
 */
export const decodeAndVerifyToken = async (token) => {
    if (!token) return null

    try {
        if (admin.apps.length) {
            return await admin.auth().verifyIdToken(token)
        }

        if (process.env.NODE_ENV !== 'production') {
            return decodeTokenUnsafe(token)
        }
    } catch (e) {
        console.error('[Auth] Token verification failed:', e.message)
    }
    return null
}

/**
 * Middleware to verify Firebase token
 */
export const verifyToken = async (req, res, next) => {
    // Skip auth for health checks
    if (req.path === '/health') return next()

    const authHeader = req.headers.authorization
    const queryToken = req.query.token
    const token = authHeader ? authHeader.split('Bearer ')[1] : queryToken

    if (!token) {
        // For public temp files in files router, we might allow but that's handled there
        return res.status(401).json({ error: 'Unauthorized - No token provided' })
    }

    try {
        // 1. Try real verification if admin is initialized
        if (admin.apps.length) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token)
                req.user = decodedToken
                return next()
            } catch (authError) {
                console.error('[Auth] Token verification failed:', authError.message)
                return res.status(401).json({ error: 'Unauthorized - Invalid token' })
            }
        }

        // 2. Fallback for development: use decoded UID without verification
        // This is INSECURE but necessary for development when service account is missing.
        // It's still better than a single shared 'dev-user' because different users
        // will have different tokens and thus different UIDs.
        if (process.env.NODE_ENV !== 'production') { // allow in production too if no admin apps for now to avoid breaking it
            const decoded = decodeTokenUnsafe(token)
            if (decoded) {
                req.user = decoded
                return next()
            }
        }

        return res.status(500).json({ error: 'Firebase Admin not configured for verification' })
    } catch (error) {
        console.error('[Auth] General auth error:', error)
        return res.status(500).json({ error: 'Internal auth error' })
    }
}

/**
 * Middleware that makes token verification optional
 */
export const verifyTokenOptional = async (req, res, next) => {
    const authHeader = req.headers.authorization
    const queryToken = req.query.token
    const token = authHeader ? authHeader.split('Bearer ')[1] : queryToken

    if (!token) {
        req.user = null
        return next()
    }

    try {
        if (admin.apps.length) {
            try {
                const decodedToken = await admin.auth().verifyIdToken(token)
                req.user = decodedToken
                return next()
            } catch (err) {
                // Token was provided but invalid - we still allow req.user to be null
                req.user = null
                return next()
            }
        }

        const decoded = decodeTokenUnsafe(token)
        req.user = decoded || null
        return next()
    } catch (error) {
        req.user = null
        return next()
    }
}

export default { verifyToken, verifyTokenOptional }
