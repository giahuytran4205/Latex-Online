import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '../temp')

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
    // Try Termux path first
    const termuxPath = join(TERMUX_BIN, engine)
    if (existsSync(termuxPath)) {
        return termuxPath
    }
    // Fall back to just the engine name (rely on PATH)
    return engine
}

/**
 * Compile LaTeX code using specified engine
 */
export async function compileLatex(code, engine = 'pdflatex', filename = 'main') {
    const jobId = uuidv4().substring(0, 8)
    const workDir = join(TEMP_DIR, jobId)
    const texFile = join(workDir, `${filename}.tex`)
    const pdfFile = `${jobId}-${filename}.pdf`
    const pdfPath = join(TEMP_DIR, pdfFile)

    try {
        // Create work directory
        mkdirSync(workDir, { recursive: true })

        // Write LaTeX source
        writeFileSync(texFile, code, 'utf-8')
        console.log(`[LaTeX] Wrote ${code.length} bytes to ${texFile}`)

        // Get engine path
        const enginePath = getEnginePath(engine)
        console.log(`[LaTeX] Using engine: ${enginePath}`)

        // Run LaTeX engine
        const result = await runLatexEngine(enginePath, texFile, workDir)

        // Check if PDF was generated
        const generatedPdf = join(workDir, `${filename}.pdf`)
        console.log(`[LaTeX] Checking for PDF at: ${generatedPdf}`)

        if (existsSync(generatedPdf)) {
            // Copy to temp root for serving
            const pdfContent = readFileSync(generatedPdf)
            writeFileSync(pdfPath, pdfContent)
            console.log(`[LaTeX] PDF generated: ${pdfFile} (${pdfContent.length} bytes)`)

            return {
                success: true,
                pdfPath: pdfFile,
                logs: result.stdout + '\n' + result.stderr,
                errors: parseErrors(result.stdout + result.stderr),
            }
        } else {
            console.log(`[LaTeX] No PDF generated. Exit code: ${result.code}`)
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

/**
 * Run LaTeX engine as child process
 */
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
            env: {
                ...process.env,
                PATH: `${TERMUX_BIN}:${process.env.PATH || ''}`
            }
        })

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (data) => {
            stdout += data.toString()
        })

        proc.stderr.on('data', (data) => {
            stderr += data.toString()
        })

        proc.on('close', (code) => {
            console.log(`[LaTeX] Exit code: ${code}, stdout: ${stdout.length} bytes`)
            resolve({ code, stdout, stderr })
        })

        proc.on('error', (err) => {
            console.error(`[LaTeX] Spawn error:`, err.message)
            reject(err)
        })
    })
}

/**
 * Parse LaTeX log for errors
 */
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
