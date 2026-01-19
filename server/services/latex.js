import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync, cpSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs'
import fs from 'fs'
import { join, dirname, basename, relative } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { findProjectInfo } from '../utils/project.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '../temp')
const PROJECTS_DIR = join(__dirname, '../../projects')
const CACHE_DIR = join(__dirname, '../cache')

// Ensure directories exist
mkdirSync(TEMP_DIR, { recursive: true })
mkdirSync(CACHE_DIR, { recursive: true })

// Cache for project hashes (incremental compilation)
const projectHashCache = new Map()

/**
 * Get the command for a LaTeX engine
 */
function getEngineCommand(engine) {
    const allowed = ['pdflatex', 'xelatex', 'lualatex']
    if (allowed.includes(engine)) {
        return engine
    }
    return 'pdflatex'
}

/**
 * Calculate hash of project files for cache invalidation
 */
function calculateProjectHash(projectDir) {
    if (!existsSync(projectDir)) return null

    const files = []
    const getFilesRecursive = (dir) => {
        const items = readdirSync(dir)
        for (const item of items) {
            if (item.startsWith('.')) continue
            const fullPath = join(dir, item)
            const stat = statSync(fullPath)
            if (stat.isDirectory()) {
                getFilesRecursive(fullPath)
            } else {
                // Include file path, size and mtime in hash
                files.push(`${fullPath}:${stat.size}:${stat.mtimeMs}`)
            }
        }
    }
    getFilesRecursive(projectDir)

    // Create hash from all file metadata
    return crypto.createHash('md5').update(files.sort().join('|')).digest('hex').substring(0, 12)
}

/**
 * Get or create work directory for a project (enables incremental compilation)
 */
function getProjectWorkDir(projectId) {
    return join(CACHE_DIR, projectId)
}

/**
 * Cleanup old temp files (files older than 1 hour)
 */
export function cleanupOldTempFiles() {
    const maxAge = 60 * 60 * 1000 // 1 hour
    const now = Date.now()

    try {
        const items = readdirSync(TEMP_DIR)
        let cleaned = 0

        for (const item of items) {
            const itemPath = join(TEMP_DIR, item)
            try {
                const stat = statSync(itemPath)
                if (now - stat.mtimeMs > maxAge) {
                    if (stat.isDirectory()) {
                        rmSync(itemPath, { recursive: true, force: true })
                    } else {
                        unlinkSync(itemPath)
                    }
                    cleaned++
                }
            } catch (e) {
                // Ignore errors on individual files
            }
        }

        if (cleaned > 0) {
            console.log(`[Cleanup] Removed ${cleaned} old temp items`)
        }
    } catch (e) {
        console.error('[Cleanup] Error:', e.message)
    }
}

// findProjectInfo is now imported from ../utils/project.js

/**
 * Compile LaTeX code using specified engine with incremental support
 */
export async function compileLatex(projectId = 'default-project', engine = 'pdflatex', filename = 'main', code = null, userId) {
    // Correctly locate the project directory
    const info = findProjectInfo(projectId, userId)
    let projectDir = info ? info.projectPath : null

    // If project doesn't exist yet, it's either a new project or an error
    if (!projectDir) {
        projectDir = join(PROJECTS_DIR, userId, projectId)
        mkdirSync(projectDir, { recursive: true })
        // Create initial file if it doesn't exist
        const mainPath = join(projectDir, 'main.tex')
        if (!existsSync(mainPath)) {
            writeFileSync(mainPath, '% New Project\n\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}')
        }
    }
    const workDir = getProjectWorkDir(projectId)

    // Calculate current project hash
    const currentHash = calculateProjectHash(projectDir)
    const cachedHash = projectHashCache.get(projectId)
    const needsSync = currentHash !== cachedHash

    // Output paths  
    const jobId = uuidv4().substring(0, 8)
    const pdfFile = `${jobId}.pdf`
    const pdfPath = join(TEMP_DIR, pdfFile)

    // Security check for filename
    const targetTexPath = join(workDir, `${filename}.tex`)
    if (!targetTexPath.startsWith(workDir)) {
        throw new Error('Security Error: Invalid filename')
    }

    try {
        // Create/update work directory
        mkdirSync(workDir, { recursive: true })

        // Sync project files only if changed (incremental)
        if (needsSync && existsSync(projectDir)) {
            console.log(`[LaTeX] Syncing project files (hash changed: ${cachedHash} -> ${currentHash})`)

            // Sync files: copy new/modified, keep aux files
            syncProjectFiles(projectDir, workDir)
            projectHashCache.set(projectId, currentHash)
        } else {
            console.log(`[LaTeX] Using cached work directory (hash: ${currentHash})`)
        }

        // If specific code provided, overwrite main.tex
        if (code) {
            writeFileSync(join(workDir, `${filename}.tex`), code, 'utf-8')
        } else if (!existsSync(join(workDir, `${filename}.tex`))) {
            writeFileSync(join(workDir, `${filename}.tex`), '', 'utf-8')
        }

        const engineCmd = getEngineCommand(engine)
        console.log(`[LaTeX] Compiling ${projectId}/${filename}.tex with ${engineCmd}`)

        // Run LaTeX engine
        const texFile = join(workDir, `${filename}.tex`)
        const result = await runLatexEngine(engineCmd, texFile, workDir)

        // Read log file
        const logFile = join(workDir, `${filename}.log`)
        let logContent = result.stdout + '\n' + result.stderr
        if (existsSync(logFile)) {
            try {
                logContent = readFileSync(logFile, 'utf-8')
            } catch (e) {
                console.error('[LaTeX] Failed to read log:', e.message)
            }
        }

        // Check for PDF
        const generatedPdf = join(workDir, `${filename}.pdf`)

        if (existsSync(generatedPdf)) {
            // Copy PDF to temp with unique name
            const pdfContent = readFileSync(generatedPdf)
            writeFileSync(pdfPath, pdfContent)

            console.log(`[LaTeX] Success! PDF: ${pdfFile}`)

            // Schedule cleanup of old temp files
            setTimeout(() => cleanupOldTempFiles(), 5000)

            return {
                success: true,
                pdfPath: pdfFile,
                logs: logContent,
                errors: parseErrors(logContent),
            }
        } else {
            const errors = parseErrors(logContent)
            if (result.signal === 'SIGTERM' || result.signal === 'SIGKILL') {
                errors.push('Compilation timed out. Your project might be too large or has an infinite loop.')
            } else if (errors.length === 0) {
                errors.push('LaTeX compilation failed - no PDF generated')
            }

            return {
                success: false,
                pdfPath: null,
                logs: logContent,
                errors: errors,
            }
        }
    } catch (error) {
        console.error(`[LaTeX] Error:`, error)
        return {
            success: false,
            pdfPath: null,
            logs: error.message,
            errors: [error.message],
        }
    }
}

/**
 * Sync project files to work directory (preserves aux files)
 */
function syncProjectFiles(srcDir, destDir) {
    const srcFiles = new Set()

    // Get all source files
    const getSrcFiles = (dir, base = '') => {
        const items = readdirSync(dir)
        for (const item of items) {
            if (item.startsWith('.')) continue
            const fullPath = join(dir, item)
            const relPath = base ? `${base}/${item}` : item
            const stat = statSync(fullPath)

            if (stat.isDirectory()) {
                getSrcFiles(fullPath, relPath)
            } else {
                srcFiles.add(relPath)
            }
        }
    }
    getSrcFiles(srcDir)

    // Copy source files
    for (const relPath of srcFiles) {
        const srcPath = join(srcDir, relPath)
        const destPath = join(destDir, relPath)

        // Create parent directory if needed
        const parentDir = dirname(destPath)
        if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
        }

        // Check if file needs copying (modified)
        let needsCopy = true
        if (existsSync(destPath)) {
            const srcStat = statSync(srcPath)
            const destStat = statSync(destPath)
            if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
                needsCopy = false
            }
        }

        if (needsCopy) {
            cpSync(srcPath, destPath)
        }
    }
}

function runLatexEngine(enginePath, texFile, workDir) {
    return new Promise((resolve, reject) => {
        const args = [
            '-interaction=nonstopmode',
            '-file-line-error',
            '-synctex=1',
            `-output-directory=${workDir}`,
            texFile,
        ]

        console.log(`[LaTeX] Running: ${enginePath} ${basename(texFile)}`)

        const proc = spawn(enginePath, args, {
            cwd: workDir,
            timeout: 300000, // Increase to 5 minutes for large projects
            env: process.env
        })

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (d) => {
            stdout += d.toString()
        })

        proc.stderr.on('data', (d) => {
            stderr += d.toString()
        })

        proc.on('close', (code, signal) => {
            console.log(`[LaTeX] Exit code: ${code}, Signal: ${signal}`)
            resolve({ code, signal, stdout, stderr })
        })

        proc.on('error', (err) => {
            console.error(`[LaTeX] Spawn error:`, err)
            reject(err)
        })
    })
}

function parseErrors(log) {
    const errors = []
    const lines = log.split('\n')
    let currentFile = 'main.tex'

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // LaTeX errors start with !
        if (line.startsWith('!')) {
            const message = line.substring(1).trim()
            let lineNumber = 1
            let file = currentFile

            // Check next line for l.LINE_NUMBER
            if (i + 1 < lines.length && lines[i + 1].match(/^l\.(\d+)/)) {
                const match = lines[i + 1].match(/^l\.(\d+)/)
                lineNumber = parseInt(match[1])
            }

            errors.push({
                line: lineNumber,
                message: message,
                file: file,
                type: 'error'
            })
        }

        // File:line: error format (from -file-line-error)
        const fileLineMatch = line.match(/^(.+\.tex):(\d+): (.+)$/)
        if (fileLineMatch) {
            errors.push({
                line: parseInt(fileLineMatch[2]),
                message: fileLineMatch[3],
                file: basename(fileLineMatch[1]),
                type: 'error'
            })
        }
    }

    return errors
}

/**
 * Resolve PDF coordinates to source line using SyncTeX
 */
export async function resolveSyncTeX(projectId, page, x, y) {
    const workDir = getProjectWorkDir(projectId)
    const synctexFile = join(workDir, 'main.synctex.gz')

    if (!existsSync(synctexFile)) {
        throw new Error('SyncTeX data not found. Please compile the project first.')
    }

    return new Promise((resolve, reject) => {
        // synctex edit -o page:x:y:main.pdf
        const args = ['edit', '-o', `${page}:${x}:${y}:main.pdf`]
        console.log(`[SyncTeX] Executing: synctex ${args.join(' ')} (CWD: ${workDir})`)

        const proc = spawn('synctex', args, { cwd: workDir })

        let output = ''
        proc.stdout.on('data', (d) => {
            output += d.toString()
            // console.log('[SyncTeX] Raw Output:', d.toString())
        })
        proc.stderr.on('data', (d) => console.error('[SyncTeX] Error:', d.toString()))

        proc.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error('SyncTeX resolution failed'))
            }

            const result = {
                file: 'main.tex',
                line: 1,
                column: 0
            }

            const lines = output.split('\n')
            for (const line of lines) {
                if (line.startsWith('Input:')) {
                    const filePath = line.substring(line.indexOf(':') + 1).trim()
                    // Resolve path correctly relative to workDir
                    const absolutePath = fs.existsSync(filePath) ? filePath : join(workDir, filePath)
                    result.file = relative(workDir, absolutePath).replace(/\\/g, '/')
                }
                if (line.startsWith('Line:')) result.line = parseInt(line.split(':')[1].trim())
                if (line.startsWith('Column:')) result.column = parseInt(line.split(':')[1].trim())
            }

            resolve(result)
        })
    })
}

// Run cleanup on startup
setTimeout(() => cleanupOldTempFiles(), 10000)
