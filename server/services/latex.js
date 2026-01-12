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
        console.log('[Env] Which pdflatex:', execSync('which pdflatex').toString().trim())
        console.log('[Env] Termux bin ls:', execSync(`ls -l ${TERMUX_BIN}/pdflatex`).toString().trim())
    } catch (e) {
        console.error('[Env] Check failed:', e.message)
    }
}

// Hardcode Termux Bin Path
const TERMUX_BIN = '/data/data/com.termux/files/usr/bin'

/**
 * Get the full path to a LaTeX engine
 */
function getEnginePath(engine) {
    // If we are on a system that looks like Termux (has the bin dir), force absolute path
    if (existsSync(TERMUX_BIN)) {
        const absPath = join(TERMUX_BIN, engine)
        console.log(`[LaTeX] Force using absolute path for Termux: ${absPath}`)
        return absPath
    }

    // Fallback for local dev
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
