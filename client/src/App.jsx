import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor/Editor'
import Preview from './components/Preview/Preview'
import Toolbar from './components/Toolbar/Toolbar'
import FileTree from './components/FileTree/FileTree'
import Console from './components/Console/Console'
import { compileLatex, getFiles, getFileContent, saveFile, createFile, deleteFile, renameFile } from './services/api'

// Debounce helper
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

function App() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('latex-theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })
    const [engine, setEngine] = useState('pdflatex')

    // File state
    const [files, setFiles] = useState([])
    const [activeFileName, setActiveFileName] = useState('main.tex')
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    const [pdfUrl, setPdfUrl] = useState(null)
    const [logs, setLogs] = useState('')
    const [isCompiling, setIsCompiling] = useState(false)
    const [consoleOpen, setConsoleOpen] = useState(false)
    const [collaborators, setCollaborators] = useState([])

    // Auto-save logic
    const debouncedCode = useDebounce(code, 1000)

    // Resizable panels state
    const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('latex-sidebar-width') || '200'))
    const [editorWidth, setEditorWidth] = useState(() => parseInt(localStorage.getItem('latex-editor-width') || '50'))
    const [consoleHeight, setConsoleHeight] = useState(() => parseInt(localStorage.getItem('latex-console-height') || '200'))
    const [isResizing, setIsResizing] = useState(null)
    const appRef = useRef(null)
    const contentAreaRef = useRef(null)

    // Initial load
    useEffect(() => {
        loadFiles()
    }, [])

    // Load file content when active file changes
    useEffect(() => {
        if (!activeFileName) return

        const fetchContent = async () => {
            try {
                const data = await getFileContent('default-project', activeFileName)
                setCode(data.content)
            } catch (err) {
                console.error('Failed to load file content:', err)
            }
        }
        fetchContent()
    }, [activeFileName])

    // Auto-save effect
    useEffect(() => {
        if (!activeFileName || isLoading) return

        const save = async () => {
            try {
                await saveFile('default-project', activeFileName, debouncedCode)
            } catch (err) {
                console.error('Auto-save failed:', err)
            }
        }
        if (debouncedCode) save()
    }, [debouncedCode, activeFileName])

    const loadFiles = async () => {
        try {
            setIsLoading(true)
            const data = await getFiles('default-project')
            setFiles(data.files)

            // If main.tex exists and no active file, select it
            if (!activeFileName && data.files.find(f => f.name === 'main.tex')) {
                setActiveFileName('main.tex')
            }
        } catch (err) {
            console.error('Failed to load files:', err)
            setLogs('Error: Failed to connect to server')
            setConsoleOpen(true)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddFile = async (filename) => {
        try {
            await createFile('default-project', filename)
            await loadFiles()
            // Only select if it's a file, not a folder
            if (!filename.endsWith('/')) {
                setActiveFileName(filename)
            }
            return true
        } catch (err) {
            alert('Failed to create file: ' + err.message)
            return false
        }
    }

    const handleDeleteFile = async (filename) => {
        if (filename === 'main.tex') return false
        if (!confirm(`Delete ${filename}?`)) return false

        try {
            await deleteFile('default-project', filename)
            await loadFiles()
            if (activeFileName === filename) setActiveFileName('main.tex')
            return true
        } catch (err) {
            alert('Failed to delete file')
            return false
        }
    }

    const handleRenameFile = async (oldName, newName) => {
        if (oldName === 'main.tex') return false
        try {
            await renameFile('default-project', oldName, newName)
            await loadFiles()
            if (activeFileName === oldName) setActiveFileName(newName)
            return true
        } catch (err) {
            alert('Failed to rename file')
            return false
        }
    }

    const handleUploadFile = async (filename, content) => {
        try {
            // First try to create the file
            await createFile('default-project', filename, content)
            await loadFiles()
            return true
        } catch (err) {
            // If file exists, try to save/overwrite
            try {
                await saveFile('default-project', filename, content)
                await loadFiles()
                return true
            } catch (saveErr) {
                alert('Failed to upload file: ' + saveErr.message)
                return false
            }
        }
    }

    const handleCompile = useCallback(async () => {
        setIsCompiling(true)
        setLogs('')
        setConsoleOpen(true)

        // Save current file first
        try {
            if (activeFileName) {
                await saveFile('default-project', activeFileName, code)
            }

            const result = await compileLatex({
                code: '',
                engine,
                filename: 'main'
            })

            if (result.success) {
                setPdfUrl(result.pdfUrl + '?t=' + Date.now())
                setLogs(result.logs || 'Compilation successful!')
            } else {
                setLogs(result.logs || 'Compilation failed.')
            }
        } catch (error) {
            setLogs(`Error: ${error.message}`)
        } finally {
            setIsCompiling(false)
        }
    }, [code, engine, activeFileName])

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme
        )
        localStorage.setItem('latex-theme', theme)
    }, [theme])

    // Resize handlers
    const mainContentRef = useRef(null)

    const handleMouseDown = useCallback((type) => (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(type)
    }, [])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e) => {
            if (isResizing === 'sidebar') {
                const newWidth = Math.max(150, Math.min(400, e.clientX))
                setSidebarWidth(newWidth)
            } else if (isResizing === 'editor' && mainContentRef.current) {
                const rect = mainContentRef.current.getBoundingClientRect()
                const x = e.clientX - rect.left
                const percent = Math.max(25, Math.min(75, (x / rect.width) * 100))
                setEditorWidth(percent)
            } else if (isResizing === 'console' && contentAreaRef.current) {
                const rect = contentAreaRef.current.getBoundingClientRect()
                const newHeight = Math.max(100, Math.min(500, rect.bottom - e.clientY))
                setConsoleHeight(newHeight)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(null)
            localStorage.setItem('latex-sidebar-width', String(sidebarWidth))
            localStorage.setItem('latex-editor-width', String(editorWidth))
            localStorage.setItem('latex-console-height', String(consoleHeight))
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, sidebarWidth, editorWidth])

    return (
        <div
            className={`app ${isResizing ? 'resizing' : ''}`}
            ref={appRef}
            style={{
                '--sidebar-width': `${sidebarWidth}px`,
                '--editor-width': editorWidth,
                '--console-height': `${consoleHeight}px`
            }}
        >
            <Toolbar
                engine={engine}
                onEngineChange={setEngine}
                onCompile={handleCompile}
                isCompiling={isCompiling}
                theme={theme}
                onThemeChange={setTheme}
                collaborators={collaborators}
                pdfUrl={pdfUrl}
            />

            <FileTree
                files={files}
                activeFile={activeFileName}
                onFileSelect={setActiveFileName}
                onAddFile={handleAddFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onUploadFile={handleUploadFile}
            />

            <div className="resize-handle resize-handle--sidebar" onMouseDown={handleMouseDown('sidebar')} />

            <div className="content-area" ref={contentAreaRef}>
                <div className="main-content" ref={mainContentRef}>
                    <Editor
                        code={code}
                        onChange={setCode}
                        onCollaboratorsChange={setCollaborators}
                    />

                    <div className="resize-handle resize-handle--editor" onMouseDown={handleMouseDown('editor')} />

                    <Preview pdfUrl={pdfUrl} />
                </div>

                {/* Console Toggle when closed */}
                {!consoleOpen && (
                    <div className="console-toggle" onClick={() => setConsoleOpen(true)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="4,17 10,11 4,5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <span>Compilation Log</span>
                        {logs && logs.includes('Error') && (
                            <span style={{ color: 'var(--error)', fontWeight: 600 }}>• Errors</span>
                        )}
                    </div>
                )}

                {/* Console Panel when open */}
                <div className={`console-wrapper ${consoleOpen ? 'console-wrapper--open' : ''}`}>
                    <div
                        className="resize-handle resize-handle--console"
                        onMouseDown={handleMouseDown('console')}
                    />
                    <Console
                        logs={logs}
                        isOpen={consoleOpen}
                        onToggle={() => setConsoleOpen(!consoleOpen)}
                    />
                </div>
            </div>
        </div>
    )
}

export default App
