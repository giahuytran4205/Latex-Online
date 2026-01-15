import { existsSync, readdirSync, statSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECTS_DIR = join(__dirname, '../../projects')

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
                if (userId === currentUserId) continue
                const projectPath = join(PROJECTS_DIR, userId, projectId)
                if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
                    return { projectPath, ownerId: userId }
                }
            }
        } catch (e) {
            console.error('[ProjectUtils] Error reading projects dir:', e.message)
        }
    }

    // 3. Check legacy path (root of PROJECTS_DIR)
    const legacyPath = join(PROJECTS_DIR, projectId)
    if (existsSync(legacyPath) && statSync(legacyPath).isDirectory()) {
        return { projectPath: legacyPath, ownerId: 'legacy' }
    }

    return null
}

/**
 * Get project path with permission check
 */
export const getProjectWithAuth = (user, projectId, requiredPermission = 'view') => {
    if (!user || !user.uid) return { error: 'Unauthorized', status: 401 }

    const userId = user.uid
    const info = findProjectInfo(projectId, userId)
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
    const isCollaborator = metadata.collaborators?.some(c => c.email === user.email)
    const publicLevel = metadata.publicAccess // 'private', 'view', 'edit'

    // Resolve actually granted permission
    let granted = 'none'
    if (isOwner) granted = 'owner'
    else if (isCollaborator) granted = 'edit'
    else if (publicLevel !== 'private') {
        granted = publicLevel // 'view' or 'edit'
    } else if (ownerId === 'legacy') {
        granted = 'view' // Legacy projects are read-only for others
    }

    // Check if granted meets required
    const canRead = granted !== 'none'
    const canWrite = granted === 'owner' || granted === 'edit'

    if (requiredPermission === 'view' && !canRead) {
        return { error: 'Access denied', status: 403 }
    }
    if (requiredPermission === 'edit' && !canWrite) {
        return { error: 'Write access denied', status: 403 }
    }

    return { projectPath, ownerId, granted }
}

export default { findProjectInfo, getProjectWithAuth }
