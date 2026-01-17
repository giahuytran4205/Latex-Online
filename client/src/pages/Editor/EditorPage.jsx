import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// Components
import Editor from '../../components/Editor/Editor'
import Preview from '../../components/Preview/Preview'
import Toolbar from '../../components/Toolbar/Toolbar'
import FileTree from '../../components/FileTree/FileTree'
import Console from '../../components/Console/Console'
import ShareModal from '../../components/ShareModal/ShareModal'
import AIChat from '../../components/AIChat/AIChat'
import { useToast } from '../../components/Toast/Toast'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialog'

// Services
import { createFile, deleteFile, renameFile, duplicateFile, resolveSyncTeX, renameProject, getFileUrl } from '../../services/api'

// Components
import FileViewer from '../../components/FileViewer/FileViewer'

// Hooks
import { useResizable } from '../../hooks/useResizable'
import { useProject } from '../../hooks/useProject'
import { useFileEditor } from '../../hooks/useFileEditor'
import { useCompiler } from '../../hooks/useCompiler'
import { useAutoSave } from '../../hooks/useAutoSave'
import { useCollaboration } from '../../hooks/useCollaboration'

import './EditorPage.css'

function EditorPage() {
    const { projectId } = useParams()
    const [searchParams] = useSearchParams()
    const sid = searchParams.get('sid')
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const { confirm } = useConfirm()

    // 1. Resizable Panels
    const { sidebarWidth, editorWidth, consoleHeight, isResizing, handleMouseDown } = useResizable()

    // 2. Project & Files List
    const { projectInfo, setProjectInfo, files, isLoading, error, collaborators: projectCollaborators, refreshFiles } = useProject(projectId, sid)

    // 3. File Editing Content
    const {
        activeFileName,
        loadedFileName,
        code,
        setCode,
        isCodeLoading,
        handleFileSelect,
        triggerSave,
        handleUploadFile,
        saveToCache,
        refreshFileContent
    } = useFileEditor(projectId, sid)



    // 4. Compiler & PDF
    const {
        pdfUrl,
        setPdfUrl,
        logs,
        setLogs,
        isCompiling,
        compilationErrors,
        setCompilationErrors,
        compile
    } = useCompiler(projectId, sid)

    // 5. Collaboration
    const { yDoc, collaborators: liveCollaborators, awareness, isSynced } = useCollaboration(projectId, user?.uid, user?.displayName || user?.email, activeFileName, sid)

    // 6. Auto-save
    useAutoSave(projectId, activeFileName, code, triggerSave, isCodeLoading, isLoading)

    // UI States
    const [engine, setEngine] = useState('pdflatex')
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('latex-theme')
        return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    })
    const [consoleOpen, setConsoleOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isAIChatOpen, setIsAIChatOpen] = useState(false)
    const [jumpToLine, setJumpToLine] = useState(null)

    // Handle Access Denied / Error
    useEffect(() => {
        if (error) {
            confirm({
                title: 'Access Denied',
                message: 'You do not have permission to access this project or it does not exist.',
                confirmText: 'OK',
                showCancel: false
            }).then(() => {
                navigate('/')
            })
        }
    }, [error, confirm, navigate])

    // Ref handlers for child actions
    const lastFileSystemUpdateRef = useRef(0)

    const handleStorageUpdate = useCallback(() => {
        refreshFiles()
        // Broadcast file system change to others
        if (awareness) {
            const now = Date.now()
            awareness.setLocalStateField('fileSystemUpdate', now)
            lastFileSystemUpdateRef.current = now
        }
    }, [refreshFiles, awareness])

    // Listen for file system updates from others
    useEffect(() => {
        if (!awareness) return

        const handleAwarenessChange = () => {
            const states = awareness.getStates()
            let maxUpdate = 0

            states.forEach(state => {
                if (state.user && state.user.fileSystemUpdate) {
                    if (state.user.fileSystemUpdate > maxUpdate) {
                        maxUpdate = state.user.fileSystemUpdate
                    }
                }
            })

            if (maxUpdate > lastFileSystemUpdateRef.current) {
                console.log('[FileTree] Remote update detected, refreshing...')
                refreshFiles()
                lastFileSystemUpdateRef.current = maxUpdate
            }
        }

        awareness.on('change', handleAwarenessChange)
        return () => awareness.off('change', handleAwarenessChange)
    }, [awareness, refreshFiles])

    const handleAddFile = async (name) => {
        try {
            await createFile(projectId, name, '', false, sid)
            handleStorageUpdate()
            if (!name.endsWith('/')) handleFileSelect(name)
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleDeleteFile = async (name) => {
        if (name === 'main.tex') return false
        try {
            await deleteFile(projectId, name, sid)
            handleStorageUpdate()
            if (activeFileName === name) handleFileSelect('main.tex')
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleRenameFile = async (oldName, newName) => {
        if (oldName === 'main.tex') return false
        try {
            await renameFile(projectId, oldName, newName, sid)
            handleStorageUpdate()
            if (activeFileName === oldName) handleFileSelect(newName)
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleDuplicateFile = async (name) => {
        try {
            const res = await duplicateFile(projectId, name, sid)
            handleStorageUpdate()
            if (res.newFilename) handleFileSelect(res.newFilename)
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleSyncTeX = async (page, x, y) => {
        try {
            const res = await resolveSyncTeX(projectId, page, x, y, sid)
            if (res.success) {
                const fileName = res.file.replace(/^\.\//, '')
                const target = files.find(f => f.name === fileName) || files.find(f => f.name.endsWith('/' + fileName))

                if (target) {
                    const actualName = target.name
                    if (actualName !== activeFileName) {
                        handleFileSelect(actualName)
                    }
                    setTimeout(() => {
                        setJumpToLine({ file: actualName, line: res.line, timestamp: Date.now() })
                    }, actualName !== activeFileName ? 150 : 0)
                }
            }
        } catch (err) { console.error(err) }
    }

    const handleJumpToUser = useCallback((collab) => {
        if (!collab || collab.isSelf) return
        if (collab.activeFile && collab.activeFile !== activeFileName) {
            handleFileSelect(collab.activeFile)
            // The Editor will handle jumping to their position once it loads
        }
        // If in same file, we'll signal the Editor to jump
        setJumpToLine({
            file: collab.activeFile,
            cursor: collab.cursor, // We'll update useCollaboration to track this
            userId: collab.id,
            timestamp: Date.now(),
            isUserJump: true
        })
    }, [activeFileName, handleFileSelect])

    const onUploadFile = async (name, content, skipReload) => {
        const success = await handleUploadFile(name, content, skipReload)
        if (success && !skipReload) handleStorageUpdate()
        return success
    }

    const handleRenameProject = async (newName) => {
        try {
            const res = await renameProject(projectId, newName, sid)
            if (res.success) {
                setProjectInfo(prev => ({ ...prev, name: res.name }))
                toast.success('Project renamed')
                return true
            }
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const onCompile = () => {
        setConsoleOpen(true)
        compile(activeFileName, code, engine, triggerSave)
    }

    // Apply global theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('latex-theme', theme)
    }, [theme])

    const mainContentRef = useRef(null)
    const contentAreaRef = useRef(null)

    const handleAIFileUpdate = (operations) => {
        handleStorageUpdate()
        if (operations && Array.isArray(operations)) {
            operations.forEach(op => {
                if (op.file) {
                    refreshFileContent(op.file)
                }
            })
        }
    }

    return (
        <div
            className={`app ${isResizing ? 'resizing' : ''}`}
            style={{
                '--sidebar-width': `${sidebarWidth}px`,
                '--editor-width': editorWidth,
                '--console-height': `${consoleHeight}px`
            }}
        >
            <Toolbar
                engine={engine}
                onEngineChange={setEngine}
                onCompile={onCompile}
                isCompiling={isCompiling}
                theme={theme}
                onThemeChange={setTheme}
                pdfUrl={pdfUrl}
                projectName={projectInfo?.name}
                onRenameProject={handleRenameProject}
                collaborators={liveCollaborators}
                onJumpToUser={handleJumpToUser}
                onBackToHome={() => navigate('/')}
                onShare={() => setIsShareModalOpen(true)}
            />

            <FileTree
                projectId={projectId}
                files={files}
                activeFile={activeFileName}
                onFileSelect={handleFileSelect}
                onAddFile={handleAddFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
                onUploadFile={onUploadFile}
                onDuplicateFile={handleDuplicateFile}
                onStorageUpdate={handleStorageUpdate}
            />

            <div className="resize-handle resize-handle--sidebar" onMouseDown={handleMouseDown('sidebar')} />

            <div className="content-area" ref={contentAreaRef}>
                <div className="main-content" ref={mainContentRef}>
                    <div className={`editor-container ${isCodeLoading ? 'editor-container--loading' : ''}`}>
                        {loadedFileName === activeFileName && code !== null && (
                            typeof code === 'string' ? (
                                <Editor
                                    key={activeFileName}
                                    code={code}
                                    onChange={setCode}
                                    onCompile={onCompile}
                                    activeFile={activeFileName}
                                    errors={compilationErrors}
                                    jumpToLine={jumpToLine}
                                    projectId={projectId}
                                    userId={user?.uid}
                                    userName={user?.displayName || user?.email}
                                    yDoc={yDoc}
                                    awareness={awareness}
                                    isSynced={isSynced}
                                    readOnly={projectInfo?.permission === 'view'}
                                />
                            ) : (
                                <FileViewer
                                    filename={activeFileName}
                                    url={code.url}
                                />
                            )
                        )}
                        {isCodeLoading && (
                            <div className="editor-loading-overlay">
                                <div className="loading-spinner"></div>
                                <span>Loading content...</span>
                            </div>
                        )}
                    </div>

                    <div className="resize-handle resize-handle--editor" onMouseDown={handleMouseDown('editor')} />

                    <Preview pdfUrl={pdfUrl} onSyncTeX={handleSyncTeX} />
                </div>

                {!consoleOpen && logs && (
                    <div className="console-toggle" onClick={() => setConsoleOpen(true)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4,17 10,11 4,5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                        <span>Logs</span>
                        {logs.includes('Error') && <span style={{ color: 'var(--error)' }}>• Errors</span>}
                    </div>
                )}

                <div className={`console-wrapper ${consoleOpen ? 'console-wrapper--open' : ''}`}>
                    <div className="resize-handle resize-handle--console" onMouseDown={handleMouseDown('console')} />
                    <Console logs={logs} isOpen={consoleOpen} onToggle={() => setConsoleOpen(!consoleOpen)} />
                </div>
            </div>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                projectId={projectId}
                projectName={projectInfo?.name || 'Untitled'}
                sid={sid}
            />

            <AIChat
                projectId={projectId}
                activeFile={activeFileName}
                compileErrors={compilationErrors}
                onRefreshFiles={handleAIFileUpdate}
                isOpen={isAIChatOpen}
                onClose={() => setIsAIChatOpen(false)}
            />

            {/* AI Chat Toggle Button */}
            {!isAIChatOpen && (
                <button
                    className="ai-toggle-btn"
                    onClick={() => setIsAIChatOpen(true)}
                    title="Mở AI Assistant"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                </button>
            )}
        </div>
    )
}

export default EditorPage
