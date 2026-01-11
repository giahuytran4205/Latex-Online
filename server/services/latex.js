import { spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TEMP_DIR = join(__dirname, '../temp')

// Ensure temp directory exists
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
}

/**
 * Compile LaTeX code using specified engine
 * @param {string} code - LaTeX source code
 * @param {string} engine - 'pdflatex' | 'xelatex' | 'lualatex'
 * @param {string} filename - Output filename (without extension)
 * @returns {Promise<{success: boolean, pdfPath: string|null, logs: string, errors: string[]}>}
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

        // Run LaTeX engine
        const result = await runLatexEngine(engine, texFile, workDir)

        // Check if PDF was generated
        const generatedPdf = join(workDir, `${filename}.pdf`)
        if (existsSync(generatedPdf)) {
            // Copy to temp root for serving
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
        return {
            success: false,
            pdfPath: null,
            logs: error.message,
            errors: [error.message],
        }
    } finally {
        // Cleanup work directory (optional - keep for debugging)
        // cleanupDir(workDir)
    }
}

/**
 * Run LaTeX engine as child process
 */
function runLatexEngine(engine, texFile, workDir) {
    return new Promise((resolve, reject) => {
        // Engine-specific arguments
        const args = [
            '-interaction=nonstopmode',
            '-halt-on-error',
            '-file-line-error',
            `-output-directory=${workDir}`,
            texFile,
        ]

        // For xelatex/lualatex, might need additional args
        if (engine === 'xelatex' || engine === 'lualatex') {
            args.unshift('-shell-escape')
        }

        const process = spawn(engine, args, {
            cwd: workDir,
            timeout: 60000, // 60 second timeout
        })

        let stdout = ''
        let stderr = ''

        process.stdout.on('data', (data) => {
            stdout += data.toString()
        })

        process.stderr.on('data', (data) => {
            stderr += data.toString()
        })

        process.on('close', (code) => {
            resolve({ code, stdout, stderr })
        })

        process.on('error', (err) => {
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
        // Match LaTeX error patterns
        if (line.startsWith('!') || line.includes('Error:') || line.includes('Fatal error')) {
            errors.push(line.trim())
        }
        // Match file:line:error pattern
        const match = line.match(/^(.+):(\d+): (.+)$/)
        if (match) {
            errors.push(`Line ${match[2]}: ${match[3]}`)
        }
    }

    return errors
}

/**
 * Cleanup directory
 */
function cleanupDir(dir) {
    try {
        const fs = require('fs')
        fs.rmSync(dir, { recursive: true, force: true })
    } catch (e) {
        console.error('Cleanup failed:', e)
    }
}
