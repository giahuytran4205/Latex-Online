import { useState, useCallback } from 'react'
import { compileLatex } from '../services/api'

export function useCompiler(projectId) {
    const [pdfUrl, setPdfUrl] = useState(null)
    const [logs, setLogs] = useState('')
    const [isCompiling, setIsCompiling] = useState(false)
    const [compilationErrors, setCompilationErrors] = useState([])

    const compile = useCallback(async (activeFile, code, engine = 'pdflatex', triggerSaveSync) => {
        setIsCompiling(true)
        setLogs('Compiling...')

        try {
            // Ensure current file is saved before compiling
            if (triggerSaveSync) {
                await triggerSaveSync(code)
            }

            const result = await compileLatex({
                projectId,
                code: '', // backend reads from disk
                engine,
                filename: 'main'
            })

            if (result.success) {
                setPdfUrl(result.pdfUrl + '?t=' + Date.now())
                setLogs(result.logs || 'Compilation successful!')
                setCompilationErrors([])
            } else {
                setLogs(result.logs || 'Compilation failed.')
                setCompilationErrors(result.errors || [])
            }
            return result
        } catch (error) {
            setLogs(`Error: ${error.message}`)
            return { success: false, error: error.message }
        } finally {
            setIsCompiling(false)
        }
    }, [projectId])

    return {
        pdfUrl,
        setPdfUrl,
        logs,
        setLogs,
        isCompiling,
        compilationErrors,
        setCompilationErrors,
        compile
    }
}
