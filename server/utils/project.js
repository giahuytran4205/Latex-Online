import { existsSync, readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECTS_DIR = join(__dirname, '../../projects')
const SHARES_DIR = join(PROJECTS_DIR, '.shares')

// Ensure shares directory exists
if (!existsSync(SHARES_DIR)) {
    mkdirSync(SHARES_DIR, { recursive: true })
}

/**
 * Find project directory and owner across all users
 */
export const findProjectInfo = (projectId, currentUserId) => {
    // 1. Check current user directory first
    if (currentUserId) {
        const projectPath = join(PROJECTS_DIR, currentUserId, projectId)
        if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
            return { projectPath, ownerId: currentUserId }
        }
    }

    // 2. Check other user directories
    if (existsSync(PROJECTS_DIR)) {
        try {
            const userDirs = readdirSync(PROJECTS_DIR)
            for (const userId of userDirs) {
                if (userId === currentUserId || userId === '.shares') continue
                const projectPath = join(PROJECTS_DIR, userId, projectId)
                if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
                    return { projectPath, ownerId: userId }
                }
            }
        } catch (e) {
            console.error('[ProjectUtils] Error reading projects dir:', e.message)
        }
    }

    return null
}

/**
 * Find project by shareId
 */
export const findProjectByShareId = (shareId) => {
    if (!shareId) return null
    const sharePath = join(SHARES_DIR, `${shareId}.json`)
    if (existsSync(sharePath)) {
        try {
            const data = JSON.parse(readFileSync(sharePath, 'utf-8'))
            const projectPath = join(PROJECTS_DIR, data.ownerId, data.projectId)
            if (existsSync(projectPath)) {
                return {
                    projectPath,
                    ownerId: data.ownerId,
                    projectId: data.projectId,
                    level: data.level || 'view',
                    isSharedLink: true
                }
            }
        } catch (e) {
            console.error('[ProjectUtils] Error reading share file:', e)
        }
    }
    return null
}

/**
 * Register or update a shareId mapping
 */
export const registerShareMapping = (shareId, projectId, ownerId, level = 'view') => {
    const sharePath = join(SHARES_DIR, `${shareId}.json`)
    writeFileSync(sharePath, JSON.stringify({ projectId, ownerId, level }, null, 2))
}

/**
 * Get project path with permission check
 * @param {Object} user - Authenticated user object (req.user)
 * @param {string} projectIdOrShareId - Either projectId or shareId
 * @param {string} requiredPermission - 'view' or 'edit' or 'owner'
 * @param {string} providedShareId - Optional shareId provided in query/headers
 */
export const getProjectWithAuth = (user, projectId, requiredPermission = 'view', providedShareId = null) => {
    const userId = user?.uid || null
    let info = null
    let usedShareId = false

    // 1. Try finding by shareId if provided or if projectId looks like a shareId
    // Actually, let's stick to explicit providedShareId for clarity
    if (providedShareId) {
        info = findProjectByShareId(providedShareId)
        if (info && info.projectId === projectId) {
            usedShareId = true
        } else if (info && !projectId) {
            // Found by shareId alone (e.g. from /s/:id route)
            usedShareId = true
        }
    }

    // 2. Fallback to normal projectId lookup if not found or no shareId
    if (!info) {
        info = findProjectInfo(projectId, userId)
    }

    if (!info) return { error: 'Project not found', status: 404 }

    const { projectPath, ownerId } = info

    // Read metadata for sharing settings
    const metadataPath = join(projectPath, '.project.json')
    let metadata = { publicAccess: 'private', collaborators: [] }
    if (existsSync(metadataPath)) {
        try {
            metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        } catch (e) { }
    }

    const isOwner = ownerId === userId
    const collaborator = metadata.collaborators?.find(c => c.email === user.email)
    const shareLevel = (info && info.isSharedLink) ? info.level : null

    // Resolve actually granted permission
    let granted = 'none'
    if (isOwner) {
        granted = 'owner'
    } else if (collaborator) {
        granted = collaborator.role || 'view'
    } else if (shareLevel) {
        granted = shareLevel
    }

    // Check if granted meets required
    const canRead = granted !== 'none'
    const canWrite = granted === 'owner' || granted === 'edit'

    if (requiredPermission === 'owner' && granted !== 'owner') {
        return { error: 'Only owner has this permission', status: 403 }
    }
    if (requiredPermission === 'edit' && !canWrite) {
        return { error: 'Write access denied', status: 403 }
    }
    if (requiredPermission === 'view' && !canRead) {
        return { error: 'Access denied', status: 403 }
    }

    return {
        projectPath,
        ownerId,
        projectId: info.projectId || projectId,
        granted,
        metadata
    }
}

export default { findProjectInfo, findProjectByShareId, registerShareMapping, getProjectWithAuth }
