import { spawn, execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
// Use ncp for recursive copy if fs.cpSync is not available (Node < 16.7)
// But we assume Node 18+ on Termux
import ncp from 'ncp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '../temp')
const PROJECTS_DIR = join(__dirname, '../../projects')

// Termux pdflatex path (defined later)

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
}

// Add helper to check execution environment
function checkEnvironment() {
    try {
        console.log('[Env] PATH:', process.env.PATH)
        console.log('[Env] Which pdflatex:', execSync('which pdflatex', { cwd: '/' }).toString().trim())
        console.log('[Env] Termux bin ls:', execSync(`ls -l ${TERMUX_BIN}/pdflatex`, { cwd: '/' }).toString().trim())
    } catch (e) {
        console.error('[Env] Check failed:', e.message)
    }
}

// Hardcode Termux Bin Path Base
const TERMUX_BASE = '/data/data/com.termux/files'
const TERMUX_BIN = join(TERMUX_BASE, 'usr/bin')

/**
 * Get the full path to a LaTeX engine
 */
function getEnginePath(engine) {
    // 0. Strongest Force: User confirmed path
    // We do NOT check existsSync because cwd might be broken, causing FS issues
    const userConfirmedPath = join(TERMUX_BIN, engine) // .../usr/bin/pdflatex

    // Check if we are likely on Termux
    if (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) {
        console.log(`[LaTeX] Termux detected. Using PATH for engine: ${engine}`)
        return engine
    }

    // Also check standard structure if PREFIX missing
    if (existsSync(TERMUX_BIN)) {
        console.log(`[LaTeX] Termux bin dir found. Forcing path: ${userConfirmedPath}`)
        return userConfirmedPath
    }

    // 1. List of potential paths to check
    const candidates = [
        join(TERMUX_BIN, engine), // Standard
        `${TERMUX_BASE}/usr/share/texlive/bin/aarch64-linux/${engine}`,
    ]

    // Check candidates
    for (const p of candidates) {
        if (existsSync(p)) return p
    }

    // 2. Deep search fallback
    console.log(`[LaTeX] Path not found in candidates. Deep searching...`)
    try {
        const cmd = `find ${TERMUX_BASE}/usr -name ${engine} -type f -path "*/bin/*" 2>/dev/null | head -n 1`
        // Fix getcwd error by setting cwd to root
        const found = execSync(cmd, { cwd: '/', encoding: 'utf8' }).trim()
        if (found) {
            console.log(`[LaTeX] Discovered path: ${found}`)
            return found
        }
    } catch (e) {
        // Ignore error
    }

    console.warn(`[LaTeX] CRITICAL: Not found ${engine}. Returning default.`)
    return engine
}

/**
 * Compile LaTeX code using specified engine
 * @param {string} projectId - Project ID to verify files from
 * @param {string} engine - 'pdflatex' | 'xelatex' | 'lualatex'
 * @param {string} filename - Main filename (without extension)
 * @param {string} code - Optional override code (legacy support)
 */
export async function compileLatex(projectId = 'default-project', engine = 'pdflatex', filename = 'main', code = null) {
    // Run env check once per compile (for debugging)
    checkEnvironment()

    const jobId = uuidv4().substring(0, 8)
    const workDir = join(TEMP_DIR, jobId)
    const projectDir = join(PROJECTS_DIR, projectId)

    // Output paths
    const pdfFile = `${jobId}-${filename}.pdf`
    const pdfPath = join(TEMP_DIR, pdfFile)

    try {
        // Create work directory
        mkdirSync(workDir, { recursive: true })

        // Copy project files to work directory
        if (existsSync(projectDir)) {
            await new Promise((resolve, reject) => {
                ncp(projectDir, workDir, (err) => err ? reject(err) : resolve())
            })
        }

        // If specific code provided (not saved yet), overwrite main.tex
        if (code) {
            writeFileSync(join(workDir, `${filename}.tex`), code, 'utf-8')
        } else if (!existsSync(join(workDir, `${filename}.tex`))) {
            // Create empty main if missing
            writeFileSync(join(workDir, `${filename}.tex`), '', 'utf-8')
        }

        const enginePath = getEnginePath(engine)
        console.log(`[LaTeX] Compiling project ${projectId} with enginePath: "${enginePath}"`)

        // Run LaTeX engine
        const texFile = join(workDir, `${filename}.tex`)
        const result = await runLatexEngine(enginePath, texFile, workDir)

        // Check PDF
        const generatedPdf = join(workDir, `${filename}.pdf`)

        if (existsSync(generatedPdf)) {
            const pdfContent = readFileSync(generatedPdf)
            writeFileSync(pdfPath, pdfContent)
            return {
                success: true,
                pdfPath: pdfFile,
                logs: result.stdout + '\n' + result.stderr,
                errors: parseErrors(result.stdout + result.stderr),
            }
        } else {
            return {
                success: false,
                pdfPath: null,
                logs: result.stdout + '\n' + result.stderr,
                errors: parseErrors(result.stdout + result.stderr),
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

function runLatexEngine(enginePath, texFile, workDir) {
    return new Promise((resolve, reject) => {
        const args = [
            '-interaction=nonstopmode',
            '-halt-on-error',
            '-file-line-error',
            `-output-directory=${workDir}`,
            texFile,
        ]

        console.log(`[LaTeX] Spawning: ${enginePath} ${args.join(' ')}`)

        // Determine directory to add to PATH
        const engineDir = dirname(enginePath)
        const newPath = `${engineDir}:${TERMUX_BIN}:${process.env.PATH || ''}`
        console.log(`[LaTeX] Using PATH: ${newPath}`)

        const proc = spawn(enginePath, args, {
            cwd: workDir,
            timeout: 120000,
            shell: true, // Enable shell to better resolve PATH
            env: {
                ...process.env,
                PATH: newPath,
                // Critical for Termux: Explicitly set TeX environment variables
                TEXMFROOT: '/data/data/com.termux/files/usr/share/texlive/2025.0',
                TEXMFDIST: '/data/data/com.termux/files/usr/share/texlive/2025.0/texmf-dist',
                TEXMFLOCAL: '/data/data/com.termux/files/usr/share/texlive/texmf-local',
            }
        })

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (d) => stdout += d.toString())
        proc.stderr.on('data', (d) => stderr += d.toString())

        proc.on('close', (code) => {
            console.log(`[LaTeX] Exit code: ${code}`)
            resolve({ code, stdout, stderr })
        })

        proc.on('error', (err) => {
            console.error(`[LaTeX] Spawn error:`, err.message)
            reject(err)
        })
    })
}

function parseErrors(log) {
    const errors = []
    const lines = log.split('\n')
    for (const line of lines) {
        if (line.startsWith('!') || line.includes('Error:') || line.includes('Fatal error')) {
            errors.push(line.trim())
        }
        const match = line.match(/^(.+):(\d+): (.+)$/)
        if (match) {
            errors.push(`Line ${match[2]}: ${match[3]}`)
        }
    }
    return errors
}
