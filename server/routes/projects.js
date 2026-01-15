import express from 'express'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, rmSync, cpSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import admin from 'firebase-admin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = express.Router()

// Projects storage directory
const PROJECTS_DIR = join(__dirname, '../../projects')

// Ensure projects directory exists
if (!existsSync(PROJECTS_DIR)) {
    mkdirSync(PROJECTS_DIR, { recursive: true })
}

// Project metadata file
const getMetadataPath = (projectId) => join(PROJECTS_DIR, projectId, '.project.json')

// Template contents
const TEMPLATES = {
    blank: `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{Untitled Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Start writing here...

\\end{document}`,

    article: `\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[english]{babel}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Article Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
This is the abstract of the article. It provides a brief summary of the content.
\\end{abstract}

\\section{Introduction}
Write your introduction here.

\\section{Methodology}
Describe your methodology.

\\section{Results}
Present your results.

\\section{Conclusion}
Write your conclusions.

\\bibliographystyle{plain}
% \\bibliography{references}

\\end{document}`,

    report: `\\documentclass[12pt]{report}
\\usepackage[utf8]{inputenc}
\\usepackage[english]{babel}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{a4paper, margin=1in}

\\title{Report Title}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\tableofcontents
\\newpage

\\chapter{Introduction}
Write your introduction here.

\\chapter{Background}
Provide background information.

\\chapter{Methods}
Describe your methods.

\\chapter{Results}
Present your results.

\\chapter{Discussion}
Discuss your findings.

\\chapter{Conclusion}
Write your conclusions.

\\end{document}`
}

// Middleware to verify Firebase token
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' })
    }

    const token = authHeader.split('Bearer ')[1]
    try {
        // Initialize admin if not already done
        if (!admin.apps.length) {
            // For development, we'll skip verification
            // In production, initialize with service account
            console.log('[Auth] Firebase Admin not initialized, using mock auth')
            req.user = { uid: 'dev-user', email: 'dev@localhost' }
            return next()
        }

        const decodedToken = await admin.auth().verifyIdToken(token)
        req.user = decodedToken
        next()
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.message)
        // For development, allow through with mock user
        req.user = { uid: 'dev-user', email: 'dev@localhost' }
        next()
    }
}

// Apply auth middleware to all routes
router.use(verifyToken)

// Get all projects for user
router.get('/', (req, res) => {
    try {
        const userId = req.user.uid
        const userProjectsDir = join(PROJECTS_DIR, userId)

        if (!existsSync(userProjectsDir)) {
            mkdirSync(userProjectsDir, { recursive: true })
            return res.json({ projects: [] })
        }

        const projectDirs = readdirSync(userProjectsDir)
        const projects = []

        for (const dir of projectDirs) {
            const projectPath = join(userProjectsDir, dir)
            const stat = statSync(projectPath)

            if (!stat.isDirectory()) continue

            const metadataPath = join(projectPath, '.project.json')
            let metadata = { name: dir, template: 'blank' }

            if (existsSync(metadataPath)) {
                try {
                    metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
                } catch (e) {
                    // Use default metadata
                }
            }

            projects.push({
                id: dir,
                name: metadata.name || dir,
                template: metadata.template || 'blank',
                createdAt: metadata.createdAt || stat.birthtime,
                updatedAt: metadata.updatedAt || stat.mtime,
                size: getDirectorySize(projectPath)
            })
        }

        // Sort by updatedAt desc
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

        res.json({ projects })
    } catch (error) {
        console.error('[Projects] Error listing projects:', error)
        res.status(500).json({ error: error.message })
    }
})

// Get user storage info - MUST be before /:projectId route
router.get('/storage', (req, res) => {
    try {
        const userId = req.user.uid
        const userProjectsDir = join(PROJECTS_DIR, userId)

        const usedStorage = existsSync(userProjectsDir) ? getDirectorySize(userProjectsDir) : 0

        // Default storage limit: 100MB
        // In production, this could come from Firestore user profile
        const storageLimit = 100 * 1024 * 1024

        console.log(`[Storage] User ${userId}: ${usedStorage} bytes used`)

        res.json({
            used: usedStorage,
            limit: storageLimit,
            userId: userId
        })
    } catch (error) {
        console.error('[Storage] Error:', error)
        res.status(500).json({ error: error.message })
    }
})

// Helper to find project directory across all users
const findProjectDir = (projectId) => {
    const userDirs = readdirSync(PROJECTS_DIR)
    for (const userId of userDirs) {
        const projectPath = join(PROJECTS_DIR, userId, projectId)
        if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
            return { projectPath, ownerId: userId }
        }
    }
    return null
}

// Get single project info
router.get('/:projectId', (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId } = req.params

        const projectInfo = findProjectDir(projectId)

        if (!projectInfo) {
            return res.status(404).json({ error: 'Project not found' })
        }

        const { projectPath, ownerId } = projectInfo
        const metadataPath = join(projectPath, '.project.json')
        let metadata = { name: projectId, template: 'blank', publicAccess: 'private', collaborators: [] }

        if (existsSync(metadataPath)) {
            try {
                metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
            } catch (e) { }
        }

        // Permission check
        const isOwner = ownerId === userId
        const isCollaborator = metadata.collaborators?.some(c => c.email === req.user.email)
        const hasPublicAccess = metadata.publicAccess !== 'private'

        if (!isOwner && !isCollaborator && !hasPublicAccess) {
            return res.status(403).json({ error: 'Access denied' })
        }

        const stat = statSync(projectPath)

        res.json({
            id: projectId,
            name: metadata.name || projectId,
            template: metadata.template || 'blank',
            createdAt: metadata.createdAt || stat.birthtime,
            updatedAt: metadata.updatedAt || stat.mtime,
            size: getDirectorySize(projectPath),
            owner: ownerId,
            publicAccess: metadata.publicAccess,
            collaborators: metadata.collaborators,
            permission: isOwner ? 'owner' : (isCollaborator ? 'edit' : (hasPublicAccess ? metadata.publicAccess : 'none'))
        })
    } catch (error) {
        console.error('[Projects] Error getting project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Create new project
router.post('/', (req, res) => {
    try {
        const userId = req.user.uid
        const { name, template = 'blank' } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' })
        }

        const projectId = uuidv4().substring(0, 12)
        const userProjectsDir = join(PROJECTS_DIR, userId)
        const projectPath = join(userProjectsDir, projectId)

        // Create project directory
        mkdirSync(projectPath, { recursive: true })

        // Create main.tex from template
        const templateContent = TEMPLATES[template] || TEMPLATES.blank
        writeFileSync(join(projectPath, 'main.tex'), templateContent.replace('Untitled Document', name))

        // Create metadata
        const metadata = {
            name: name.trim(),
            template,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            owner: userId
        }
        writeFileSync(join(projectPath, '.project.json'), JSON.stringify(metadata, null, 2))

        console.log(`[Projects] Created project ${projectId} for user ${userId}`)

        res.json({
            success: true,
            projectId,
            name: metadata.name
        })
    } catch (error) {
        console.error('[Projects] Error creating project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Delete project
router.delete('/:projectId', (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId } = req.params
        const projectPath = join(PROJECTS_DIR, userId, projectId)

        if (!existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' })
        }

        rmSync(projectPath, { recursive: true, force: true })
        console.log(`[Projects] Deleted project ${projectId} for user ${userId}`)

        res.json({ success: true })
    } catch (error) {
        console.error('[Projects] Error deleting project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Duplicate project
router.post('/:projectId/duplicate', (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId } = req.params
        const srcPath = join(PROJECTS_DIR, userId, projectId)

        if (!existsSync(srcPath)) {
            return res.status(404).json({ error: 'Project not found' })
        }

        // Read original metadata
        const metadataPath = join(srcPath, '.project.json')
        let originalMetadata = { name: projectId }
        if (existsSync(metadataPath)) {
            try {
                originalMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
            } catch (e) { }
        }

        // Create new project
        const newProjectId = uuidv4().substring(0, 12)
        const destPath = join(PROJECTS_DIR, userId, newProjectId)

        // Copy all files
        cpSync(srcPath, destPath, { recursive: true })

        // Update metadata
        const newMetadata = {
            ...originalMetadata,
            name: `${originalMetadata.name || projectId} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            owner: userId
        }
        writeFileSync(join(destPath, '.project.json'), JSON.stringify(newMetadata, null, 2))

        console.log(`[Projects] Duplicated project ${projectId} -> ${newProjectId} for user ${userId}`)

        res.json({
            success: true,
            projectId: newProjectId,
            name: newMetadata.name
        })
    } catch (error) {
        console.error('[Projects] Error duplicating project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Update project info (e.g. rename)
router.patch('/:projectId', (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId } = req.params
        const { name } = req.body

        const projectInfo = findProjectDir(projectId)
        if (!projectInfo) {
            return res.status(404).json({ error: 'Project not found' })
        }

        const { projectPath, ownerId } = projectInfo

        // Only owner can rename
        if (ownerId !== userId) {
            return res.status(403).json({ error: 'Only project owner can rename the project' })
        }

        const metadataPath = join(projectPath, '.project.json')
        let metadata = {}

        if (existsSync(metadataPath)) {
            metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        }

        if (name) metadata.name = name.trim()
        metadata.updatedAt = new Date().toISOString()

        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

        console.log(`[Projects] Updated project ${projectId}: Name="${metadata.name}"`)

        res.json({
            success: true,
            name: metadata.name,
            updatedAt: metadata.updatedAt
        })
    } catch (error) {
        console.error('[Projects] Error updating project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Share project
router.post('/:projectId/share', (req, res) => {
    try {
        const userId = req.user.uid
        const { projectId } = req.params
        const { publicAccess, collaborators } = req.body

        const projectInfo = findProjectDir(projectId)
        if (!projectInfo) {
            return res.status(404).json({ error: 'Project not found' })
        }

        const { projectPath, ownerId } = projectInfo

        // Only owner can change sharing settings
        if (ownerId !== userId) {
            return res.status(403).json({ error: 'Only project owner can change sharing settings' })
        }

        const metadataPath = join(projectPath, '.project.json')
        let metadata = {}

        if (existsSync(metadataPath)) {
            metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        }

        // Update settings
        if (publicAccess !== undefined) metadata.publicAccess = publicAccess
        if (collaborators !== undefined) metadata.collaborators = collaborators

        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

        console.log(`[Projects] Updated sharing for ${projectId}: Access=${metadata.publicAccess}, Collabs=${metadata.collaborators?.length}`)

        res.json({
            success: true,
            publicAccess: metadata.publicAccess,
            collaborators: metadata.collaborators
        })
    } catch (error) {
        console.error('[Projects] Error sharing project:', error)
        res.status(500).json({ error: error.message })
    }
})



// Helper to calculate directory size
function getDirectorySize(dirPath) {
    let size = 0
    try {
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
        // Ignore errors
    }
    return size
}

export default router

