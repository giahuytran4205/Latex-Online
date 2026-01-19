import { existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PROJECTS_DIR = join(__dirname, '../../projects')
const STORAGE_LIMIT = 100 * 1024 * 1024 // 100 MB

/**
 * Calculate the total size of a directory recursively
 * @param {string} dirPath 
 * @returns {number} size in bytes
 */
export function getDirectorySize(dirPath) {
    let size = 0
    try {
        if (!existsSync(dirPath)) return 0
        const files = readdirSync(dirPath)
        for (const file of files) {
            const filePath = join(dirPath, file)
            const stat = statSync(filePath)
            if (stat.isDirectory()) {
                size += getDirectorySize(filePath)
            } else {
                size += stat.size
            }
        }
    } catch (e) {
        // Ignore errors (e.g. permission issues)
        console.error(`Error calculating size for ${dirPath}:`, e.message)
    }
    return size
}

/**
 * Check if a user has exceeded their storage limit
 * @param {string} userId 
 * @param {number} pendingSize - Approximate size of new data being written (optional)
 * @returns {boolean} true if quota exceeded
 */
export function isStorageQuotaExceeded(userId, pendingSize = 0) {
    if (!userId) return false // Anonymous users? Maybe restrict them too, but for now allow.

    const userDir = join(PROJECTS_DIR, userId)
    const currentUsage = getDirectorySize(userDir)

    if (currentUsage + pendingSize > STORAGE_LIMIT) {
        return true
    }
    return false
}

export { STORAGE_LIMIT }
