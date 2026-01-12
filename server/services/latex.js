import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync, cpSync, readdirSync } from 'fs'
import fs from 'fs' // Default import for robust usage
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
// Node 18+ is assumed on Termux, so we use fs.cpSync
// import { ncp } from 'ncp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '../temp')
const PROJECTS_DIR = join(__dirname, '../../projects')

/**
 * Get the command for a LaTeX engine
 * We rely on the system PATH to find the executable
 */
function getEngineCommand(engine) {
    // Whitelist allowed engines for security
    const allowed = ['pdflatex', 'xelatex', 'lualatex']
    if (allowed.includes(engine)) {
        return engine
    }
    return 'pdflatex'
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
            // Use native recursive copy
            cpSync(projectDir, workDir, { recursive: true })
        }

        // If specific code provided (not saved yet), overwrite main.tex
        if (code) {
            writeFileSync(join(workDir, `${filename}.tex`), code, 'utf-8')
        } else if (!existsSync(join(workDir, `${filename}.tex`))) {
            // Create empty main if missing
            writeFileSync(join(workDir, `${filename}.tex`), '', 'utf-8')
        }

        const engineCmd = getEngineCommand(engine)
        console.log(`[LaTeX] Compiling project ${projectId} with ${engineCmd}`)
        console.log(`[LaTeX] WorkDir: ${workDir}`)
        console.log(`[LaTeX] TexFile: ${filename}.tex`)

        // Run LaTeX engine
        const texFile = join(workDir, `${filename}.tex`)
        const result = await runLatexEngine(engineCmd, texFile, workDir)

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
            // DEBUG: List files to understand why we missed it
            const files = fs.readdirSync(workDir);
            console.error(`[LaTeX] PDF not found at ${generatedPdf}`);
            console.error(`[LaTeX] Directory contents of ${workDir}:`, files);

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
        console.log(`[LaTeX] PATH: ${process.env.PATH}`)

        const proc = spawn(enginePath, args, {
            cwd: workDir,
            timeout: 60000, // Reduced to 60s for faster feedback
            env: process.env
        })

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (d) => {
            const str = d.toString()
            // console.log(`[LaTeX STDOUT] ${str}`) // Uncomment for verbose logs
            stdout += str
        })

        proc.stderr.on('data', (d) => {
            const str = d.toString()
            console.error(`[LaTeX STDERR] ${str}`)
            stderr += str
        })

        proc.on('close', (code) => {
            console.log(`[LaTeX] Exit code: ${code}`)
            resolve({ code, stdout, stderr })
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
