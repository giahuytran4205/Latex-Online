import { spawn } from 'child_process'
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

// Termux pdflatex path
const TERMUX_BIN = '/data/data/com.termux/files/usr/bin'

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
}

/**
 * Get the full path to a LaTeX engine
 */
function getEnginePath(engine) {
    const termuxPath = join(TERMUX_BIN, engine)
    const exists = existsSync(termuxPath)
    console.log(`[LaTeX] Checking path: ${termuxPath} (Exists: ${exists})`)

    if (exists) {
        return termuxPath
    }

    // Debug: list directory if not found (to see what is there)
    if (existsSync(TERMUX_BIN)) {
        try {
            const files = readdirSync(TERMUX_BIN)
            const pdfFiles = files.filter(f => f.includes('latex'))
            console.log(`[LaTeX] Contents of ${TERMUX_BIN} (matching *latex*):`, pdfFiles.join(', '))
        } catch (e) { console.error('Error listing bin:', e) }
    }

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
        console.log(`[LaTeX] Compiling project ${projectId} with ${enginePath}`)

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

        const proc = spawn(enginePath, args, {
            cwd: workDir,
            timeout: 120000,
            shell: true, // Enable shell to better resolve PATH
            env: {
                ...process.env,
                PATH: `${TERMUX_BIN}:${process.env.PATH || ''}`
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
