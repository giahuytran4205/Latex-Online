import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Editor from '../../components/Editor/Editor'
import Preview from '../../components/Preview/Preview'
import Toolbar from '../../components/Toolbar/Toolbar'
import FileTree from '../../components/FileTree/FileTree'
import Console from '../../components/Console/Console'
import ShareModal from '../../components/ShareModal/ShareModal'
import { useToast } from '../../components/Toast/Toast'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialog'
import {
    compileLatex,
    getFiles,
    getFileContent,
    saveFile,
    createFile,
    deleteFile,
    renameFile,
    duplicateFile,
    getProjectInfo,
    resolveSyncTeX
} from '../../services/api'
import './EditorPage.css'

// Debounce helper
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

function EditorPage() {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const toast = useToast()
    const { confirm } = useConfirm()

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('latex-theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })
    const [engine, setEngine] = useState('pdflatex')

    // Project info
    const [projectInfo, setProjectInfo] = useState(null)

    // File state
    const [files, setFiles] = useState([])
    const [activeFileName, setActiveFileName] = useState('main.tex')
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isCodeLoading, setIsCodeLoading] = useState(false)

    const [pdfUrl, setPdfUrl] = useState(null)
    const [logs, setLogs] = useState('')
    const [isCompiling, setIsCompiling] = useState(false)
    const [consoleOpen, setConsoleOpen] = useState(false)
    const [compilationErrors, setCompilationErrors] = useState([])
    const [collaborators, setCollaborators] = useState([])
    const [jumpToLine, setJumpToLine] = useState(null)

    // Auto-save logic: Debounce name and code together to prevent race conditions
    const [debouncedData, setDebouncedData] = useState({ filename: activeFileName, code: code })

    useEffect(() => {
        // Don't update debounce while a file is loading to prevent race conditions
        if (isCodeLoading) return

        const handler = setTimeout(() => {
            setDebouncedData({ filename: activeFileName, code: code })
        }, 1000)
        return () => clearTimeout(handler)
    }, [code, activeFileName, isCodeLoading])

    // Resizable panels state
    const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('latex-sidebar-width') || '200'))
    const [editorWidth, setEditorWidth] = useState(() => parseInt(localStorage.getItem('latex-editor-width') || '50'))
    const [consoleHeight, setConsoleHeight] = useState(() => parseInt(localStorage.getItem('latex-console-height') || '200'))
    const [isResizing, setIsResizing] = useState(null)
    const appRef = useRef(null)
    const contentAreaRef = useRef(null)

    // Initial load
    useEffect(() => {
        if (projectId) {
            loadProjectInfo()
            loadFiles()
        }
    }, [projectId])

    // File content cache - avoid refetching
    const fileCacheRef = useRef(new Map())
    const lastSavedFileRef = useRef(activeFileName)
    const loadingFileRef = useRef(false)
    const prevActiveFileRef = useRef(null)

    // Save current content to cache before switching files
    const saveToCache = useCallback((filename, content) => {
        if (filename && content !== undefined) {
            fileCacheRef.current.set(filename, content)
        }
    }, [])

    // Load project info
    const loadProjectInfo = async () => {
        try {
            const info = await getProjectInfo(projectId)
            setProjectInfo(info)
        } catch (error) {
            console.error('Failed to load project info:', error)
            // Maybe redirect to home if project doesn't exist
            navigate('/')
        }
    }

    // Load file content when active file changes
    useEffect(() => {
        if (!activeFileName) return
        // Don't try to load folder content
        if (activeFileName.endsWith('/')) return

        // Save current file to cache before switching
        if (prevActiveFileRef.current && prevActiveFileRef.current !== activeFileName) {
            saveToCache(prevActiveFileRef.current, code)
        }
        prevActiveFileRef.current = activeFileName

        // Check cache first
        if (fileCacheRef.current.has(activeFileName)) {
            const cachedContent = fileCacheRef.current.get(activeFileName)
            setCode(cachedContent)
            lastSavedFileRef.current = activeFileName
            return
        }

        // Fetch from server
        setIsCodeLoading(true)
        loadingFileRef.current = true
        const fetchContent = async () => {
            try {
                const data = await getFileContent(projectId, activeFileName)
                setCode(data.content)
                saveToCache(activeFileName, data.content)
                lastSavedFileRef.current = activeFileName
            } catch (err) {
                console.error('Failed to load file content:', err)
                // If file doesn't exist yet (new file), set empty content
                setCode('')
                saveToCache(activeFileName, '')
                lastSavedFileRef.current = activeFileName
            } finally {
                loadingFileRef.current = false
                setIsCodeLoading(false)
            }
        }
        fetchContent()
    }, [activeFileName, saveToCache, projectId])

    // Update cache when code changes
    useEffect(() => {
        if (activeFileName && !activeFileName.endsWith('/')) {
            saveToCache(activeFileName, code)
        }
    }, [code, activeFileName, saveToCache])

    // Auto-save effect
    useEffect(() => {
        const { filename: debouncedFile, code: debouncedCode } = debouncedData

        // Skip if nothing to save or switching
        if (!debouncedFile || debouncedFile.endsWith('/')) return
        if (isLoading || isCodeLoading) return

        // IMPORTANT: Only save if the debounced file is STILL the active file
        if (debouncedFile !== activeFileName) return

        // Don't save if identical to what we know is already on server/cache
        if (fileCacheRef.current.get(debouncedFile) === debouncedCode && lastSavedFileRef.current === debouncedFile) {
            return
        }

        const save = async () => {
            try {
                await saveFile(projectId, debouncedFile, debouncedCode)
                lastSavedFileRef.current = debouncedFile
                saveToCache(debouncedFile, debouncedCode)
            } catch (err) {
                console.error('Auto-save failed:', err)
            }
        }
        save()
    }, [debouncedData, projectId, activeFileName])

    const loadFiles = async () => {
        try {
            setIsLoading(true)
            const data = await getFiles(projectId)
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
            await createFile(projectId, filename)
            await loadFiles()
            // Only select if it's a file, not a folder
            if (!filename.endsWith('/')) {
                setActiveFileName(filename)
            }
            return true
        } catch (err) {
            toast.error('Failed to create file: ' + err.message)
            return false
        }
    }

    const handleDeleteFile = async (filename) => {
        if (filename === 'main.tex') return false

        try {
            await deleteFile(projectId, filename)
            await loadFiles()
            if (activeFileName === filename) setActiveFileName('main.tex')
            return true
        } catch (err) {
            toast.error('Failed to delete file: ' + err.message)
            return false
        }
    }

    const handleRenameFile = async (oldName, newName) => {
        if (oldName === 'main.tex') return false
        try {
            await renameFile(projectId, oldName, newName)
            await loadFiles()
            if (activeFileName === oldName) setActiveFileName(newName)
            return true
        } catch (err) {
            toast.error('Failed to rename file: ' + err.message)
            return false
        }
    }

    const handleUploadFile = async (filename, content, skipReload = false) => {
        try {
            // Create file with overwrite option for upload scenarios
            await createFile(projectId, filename, content, true)

            // If the uploaded file is the one currently open, update the editor content
            // to prevent auto-save from overwriting the upload with old content
            if (filename === activeFileName) {
                // If it's a binary file (data:...), don't put it in the editor
                if (typeof content === 'string' && !content.startsWith('data:')) {
                    setCode(content)
                    saveToCache(filename, content)
                }
            }

            // Clear cache for this file to ensure fresh load next time
            if (fileCacheRef.current.has(filename)) {
                fileCacheRef.current.delete(filename)
            }

            if (!skipReload) {
                await loadFiles()
            }
            return true
        } catch (err) {
            console.error('Failed to upload file:', err)
            return false
        }
    }

    const handleDuplicateFile = async (filename) => {
        try {
            const result = await duplicateFile(projectId, filename)
            await loadFiles()
            // Select the new duplicated file
            if (result.newFilename) {
                setActiveFileName(result.newFilename)
            }
            return true
        } catch (err) {
            toast.error('Failed to duplicate file: ' + err.message)
            return false
        }
    }

    const handleSyncTeX = async (page, x, y) => {
        console.log(`[EditorPage] SyncTeX Triggered: Page ${page}`)
        try {
            const result = await resolveSyncTeX(projectId, page, x, y)
            console.log('[EditorPage] SyncTeX Result:', result)

            if (result.success) {
                // Normalize path: SyncTeX often returns ./filename.tex
                const fileName = result.file.replace(/^\.\//, '')

                // Find the actual file in our project files list (exact or fuzzy match)
                const targetFile = files.find(f => f.name === fileName) ||
                    files.find(f => f.name.endsWith('/' + fileName))

                if (targetFile) {
                    const actualName = targetFile.name
                    const isNewFile = actualName !== activeFileName

                    if (isNewFile) {
                        console.log(`SyncTeX: Switching to ${actualName}`)
                        setActiveFileName(actualName)
                    }

                    // Small delay ensures Editor reacts to file switch BEFORE line jump
                    setTimeout(() => {
                        setJumpToLine({ file: actualName, line: result.line, timestamp: Date.now() })
                        if (isNewFile) toast.success(`Jumped to file: ${actualName}`)
                    }, isNewFile ? 100 : 0)
                } else {
                    console.warn(`SyncTeX Match: '${fileName}' not found in project. Current files:`, files.map(f => f.name))
                }
            }
        } catch (err) {
            console.error('SyncTeX handler failed:', err)
        }
    }

    const handleCompile = useCallback(async () => {
        setIsCompiling(true)
        setLogs('')
        setConsoleOpen(true)

        // Save current file first
        try {
            if (activeFileName) {
                await saveFile(projectId, activeFileName, code)
            }

            const result = await compileLatex({
                projectId,
                code: '',
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
        } catch (error) {
            setLogs(`Error: ${error.message}`)
        } finally {
            setIsCompiling(false)
        }
    }, [code, engine, activeFileName, projectId])

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
    }, [isResizing, sidebarWidth, editorWidth, consoleHeight])

    const handleBackToHome = () => {
        navigate('/')
    }

    const [isShareModalOpen, setIsShareModalOpen] = useState(false)

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
                projectName={projectInfo?.name}
                onBackToHome={handleBackToHome}
                onShare={() => setIsShareModalOpen(true)}
            />

            <FileTree
                projectId={projectId}
                files={files}
                activeFile={activeFileName}
                onFileSelect={setActiveFileName}
                onAddFile={handleAddFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onUploadFile={handleUploadFile}
                onDuplicateFile={handleDuplicateFile}
                onStorageUpdate={loadFiles}
            />

            <div className="resize-handle resize-handle--sidebar" onMouseDown={handleMouseDown('sidebar')} />

            <div className="content-area" ref={contentAreaRef}>
                <div className="main-content" ref={mainContentRef}>
                    <div className={`editor-container ${isCodeLoading ? 'editor-container--loading' : ''}`}>
                        <Editor
                            code={code}
                            onChange={setCode}
                            onCompile={handleCompile}
                            activeFile={activeFileName}
                            errors={compilationErrors}
                            jumpToLine={jumpToLine}
                            projectId={projectId}
                            userId={user?.uid}
                            userName={user?.displayName || user?.email}
                        />
                        {isCodeLoading && (
                            <div className="editor-loading-overlay">
                                <div className="loading-spinner"></div>
                                <span>Loading file content...</span>
                            </div>
                        )}
                    </div>

                    <div className="resize-handle resize-handle--editor" onMouseDown={handleMouseDown('editor')} />

                    <Preview pdfUrl={pdfUrl} onSyncTeX={handleSyncTeX} />
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

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                projectId={projectId}
                projectName={projectInfo?.name || 'Untitled'}
            />
        </div>
    )
}

export default EditorPage
