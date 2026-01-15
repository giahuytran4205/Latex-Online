import express from 'express'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync, rmSync, cpSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import admin from 'firebase-admin'
import { verifyToken, verifyTokenOptional } from '../services/auth.js'
import { findProjectInfo, getProjectWithAuth, registerShareMapping, findProjectByShareId } from '../utils/project.js'

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

// Resolve shareId to projectId - PUBLIC
router.get('/resolve/:shareId', (req, res) => {
    try {
        const { shareId } = req.params
        const info = findProjectByShareId(shareId)

        if (!info) {
            return res.status(404).json({ error: 'Share link invalid or expired' })
        }

        // We return the projectId so the frontend can navigate
        res.json({
            projectId: info.projectId,
            ownerId: info.ownerId
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// Apply auth middleware to all routes below
// Routes that strictly require authentication
router.get('/', verifyToken, (req, res) => {
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
router.get('/storage', verifyToken, (req, res) => {
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
const findProjectDir = (projectId, userId) => {
    // 1. Check current user's directory first (most common case)
    if (userId) {
        const personalPath = join(PROJECTS_DIR, userId, projectId)
        if (existsSync(personalPath) && statSync(personalPath).isDirectory()) {
            return { projectPath: personalPath, ownerId: userId }
        }
    }

    // 2. Search other users (for shared projects)
    if (!existsSync(PROJECTS_DIR)) return null

    const userDirs = readdirSync(PROJECTS_DIR)
    for (const uId of userDirs) {
        if (uId === userId) continue // Already checked
        const projectPath = join(PROJECTS_DIR, uId, projectId)
        if (existsSync(projectPath) && statSync(projectPath).isDirectory()) {
            return { projectPath, ownerId: uId }
        }
    }
    return null
}

// Get single project info
router.get('/:projectId', verifyTokenOptional, (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'view', shareId)

        if (auth.error) {
            return res.status(auth.status).json({ error: auth.error })
        }

        const { projectPath, ownerId, granted, metadata } = auth
        const stat = statSync(projectPath)

        // Ensure shares exist in metadata and mapping
        let metadataUpdated = false
        if (!metadata.shares) {
            metadata.shares = {
                view: metadata.shareId || uuidv4(),
                edit: uuidv4()
            }
            delete metadata.shareId
            metadataUpdated = true
        }

        if (metadataUpdated) {
            const metadataPath = join(projectPath, '.project.json')
            writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
        }

        // Always ensure mappings are registered
        registerShareMapping(metadata.shares.view, projectId, ownerId, 'view')
        registerShareMapping(metadata.shares.edit, projectId, ownerId, 'edit')

        res.json({
            id: projectId,
            name: metadata.name || projectId,
            template: metadata.template || 'blank',
            createdAt: metadata.createdAt || stat.birthtime,
            updatedAt: metadata.updatedAt || stat.mtime,
            size: getDirectorySize(projectPath),
            owner: ownerId,
            shares: metadata.shares,
            publicAccess: metadata.publicAccess,
            collaborators: metadata.collaborators,
            permission: granted
        })
    } catch (error) {
        console.error('[Projects] Error getting project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Create new project
router.post('/', verifyToken, (req, res) => {
    try {
        const userId = req.user.uid
        const { name, template = 'blank' } = req.body

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Project name is required' })
        }

        const projectId = uuidv4().substring(0, 12)
        const shares = {
            view: uuidv4(),
            edit: uuidv4()
        }
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
            owner: userId,
            shares,
            publicAccess: 'private',
            collaborators: []
        }
        writeFileSync(join(projectPath, '.project.json'), JSON.stringify(metadata, null, 2))

        // Register share mappings
        registerShareMapping(shares.view, projectId, userId, 'view')
        registerShareMapping(shares.edit, projectId, userId, 'edit')

        console.log(`[Projects] Created project ${projectId} for user ${userId}`)

        res.json({
            success: true,
            projectId,
            shares,
            name: metadata.name
        })
    } catch (error) {
        console.error('[Projects] Error creating project:', error)
        res.status(500).json({ error: error.message })
    }
})

// Delete project
router.delete('/:projectId', verifyTokenOptional, (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'owner', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { projectPath, ownerId } = auth

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
router.post('/:projectId/duplicate', verifyTokenOptional, (req, res) => {
    try {
        const { projectId } = req.params
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'view', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { projectPath: srcPath, ownerId } = auth

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
router.patch('/:projectId', verifyTokenOptional, (req, res) => {
    try {
        const { projectId } = req.params
        const { name } = req.body
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { projectPath, ownerId } = auth

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
router.post('/:projectId/share', verifyTokenOptional, (req, res) => {
    try {
        const { projectId } = req.params
        const { publicAccess, collaborators } = req.body
        const shareId = req.query.sid || req.headers['x-share-id']
        const auth = getProjectWithAuth(req.user, projectId, 'owner', shareId)
        if (auth.error) {
            // Check if it's just 'edit' vs 'owner' (collaborators might have edit but not owner)
            const viewAuth = getProjectWithAuth(req.user, projectId, 'edit', shareId)
            const userId = req.user?.uid
            if (!viewAuth.error && viewAuth.ownerId !== userId && userId) {
                return res.status(403).json({ error: 'Only project owner can change sharing settings' })
            }
            return res.status(auth.status || 403).json({ error: auth.error })
        }

        const { projectPath, ownerId } = auth

        const metadataPath = join(projectPath, '.project.json')
        let metadata = {}

        if (existsSync(metadataPath)) {
            metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
        }

        // Update settings
        if (publicAccess !== undefined) metadata.publicAccess = publicAccess
        if (collaborators !== undefined) metadata.collaborators = collaborators

        // Ensure shares exist
        if (!metadata.shares) {
            metadata.shares = {
                view: metadata.shareId || uuidv4(),
                edit: uuidv4()
            }
            delete metadata.shareId
            registerShareMapping(metadata.shares.view, projectId, ownerId, 'view')
            registerShareMapping(metadata.shares.edit, projectId, ownerId, 'edit')
        }

        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

        console.log(`[Projects] Updated sharing for ${projectId}: Access=${metadata.publicAccess}, Collabs=${metadata.collaborators?.length}`)

        res.json({
            success: true,
            publicAccess: metadata.publicAccess,
            collaborators: metadata.collaborators,
            shares: metadata.shares
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

