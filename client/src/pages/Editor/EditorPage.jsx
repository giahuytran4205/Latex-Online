import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

// Components
import Editor from '../../components/Editor/Editor'
import Preview from '../../components/Preview/Preview'
import Toolbar from '../../components/Toolbar/Toolbar'
import FileTree from '../../components/FileTree/FileTree'
import Console from '../../components/Console/Console'
import ShareModal from '../../components/ShareModal/ShareModal'
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
    const navigate = useNavigate()
    const { user } = useAuth()
    const toast = useToast()
    const { confirm } = useConfirm()

    // 1. Resizable Panels
    const { sidebarWidth, editorWidth, consoleHeight, isResizing, handleMouseDown } = useResizable()

    // 2. Project & Files List
    const { projectInfo, setProjectInfo, files, isLoading, collaborators: projectCollaborators, refreshFiles } = useProject(projectId)

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
        saveToCache
    } = useFileEditor(projectId)

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
    } = useCompiler(projectId)

    // 5. Collaboration
    const { yDoc, collaborators: liveCollaborators, awareness } = useCollaboration(projectId, user?.uid, user?.displayName || user?.email, activeFileName)

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
    const [jumpToLine, setJumpToLine] = useState(null)

    // Ref handlers for child actions
    const handleAddFile = async (name) => {
        try {
            await createFile(projectId, name)
            await refreshFiles()
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
            await deleteFile(projectId, name)
            await refreshFiles()
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
            await renameFile(projectId, oldName, newName)
            await refreshFiles()
            if (activeFileName === oldName) handleFileSelect(newName)
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleDuplicateFile = async (name) => {
        try {
            const res = await duplicateFile(projectId, name)
            await refreshFiles()
            if (res.newFilename) handleFileSelect(res.newFilename)
            return true
        } catch (err) {
            toast.error(err.message)
            return false
        }
    }

    const handleSyncTeX = async (page, x, y) => {
        try {
            const res = await resolveSyncTeX(projectId, page, x, y)
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
        if (success && !skipReload) await refreshFiles()
        return success
    }

    const handleRenameProject = async (newName) => {
        try {
            const res = await renameProject(projectId, newName)
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
                onStorageUpdate={refreshFiles}
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
                                />
                            ) : (
                                <FileViewer
                                    filename={activeFileName}
                                    url={code.url}
                                    onDownload={async () => {
                                        const url = await getFileUrl(projectId, activeFileName)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = activeFileName.split('/').pop()
                                        a.click()
                                    }}
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
            />
        </div>
    )
}

export default EditorPage
