import { useState, useRef } from 'react'
import './FileTree.css'

function FileTree({ files, activeFile, onFileSelect, onAddFile, onDeleteFile, onRenameFile, onUploadFile }) {
    const [isAdding, setIsAdding] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [contextMenu, setContextMenu] = useState(null)
    const [renaming, setRenaming] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const [showDetails, setShowDetails] = useState(false)
    const fileInputRef = useRef(null)

    const getIcon = (type) => {
        switch (type) {
            case 'tex':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <text x="8" y="16" fontSize="6" fill="currentColor" stroke="none">TEX</text>
                    </svg>
                )
            case 'bib':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                )
            case 'sty':
            case 'cls':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <circle cx="12" cy="14" r="3" />
                    </svg>
                )
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'pdf':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21,15 16,10 5,21" />
                    </svg>
                )
            default:
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <polyline points="13,2 13,9 20,9" />
                    </svg>
                )
        }
    }

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    const handleAddFile = () => {
        if (newFileName.trim()) {
            const filename = newFileName.includes('.') ? newFileName : `${newFileName}.tex`
            if (onAddFile(filename)) {
                setNewFileName('')
                setIsAdding(false)
            }
        }
    }

    const handleContextMenu = (e, file) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            file: file.name
        })
    }

    const handleDelete = () => {
        if (contextMenu && onDeleteFile) {
            onDeleteFile(contextMenu.file)
        }
        setContextMenu(null)
    }

    const handleStartRename = () => {
        if (contextMenu) {
            setRenaming(contextMenu.file)
            setRenameValue(contextMenu.file)
        }
        setContextMenu(null)
    }

    const handleRename = () => {
        if (renaming && renameValue.trim() && onRenameFile) {
            onRenameFile(renaming, renameValue.trim())
        }
        setRenaming(null)
        setRenameValue('')
    }

    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileUpload = async (e) => {
        const uploadedFiles = e.target.files
        if (!uploadedFiles || uploadedFiles.length === 0) return

        for (const file of uploadedFiles) {
            try {
                const content = await readFileContent(file)
                if (onUploadFile) {
                    await onUploadFile(file.name, content)
                } else if (onAddFile) {
                    // Fallback: create file with content
                    await onAddFile(file.name, content)
                }
            } catch (err) {
                console.error('Failed to upload file:', err)
                alert(`Failed to upload ${file.name}`)
            }
        }
        // Reset input
        e.target.value = ''
    }

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject
            // For binary files, we might want to use readAsDataURL
            // For text files, use readAsText
            const textExtensions = ['tex', 'bib', 'txt', 'sty', 'cls', 'md', 'json']
            const ext = file.name.split('.').pop().toLowerCase()
            if (textExtensions.includes(ext)) {
                reader.readAsText(file)
            } else {
                reader.readAsDataURL(file)
            }
        })
    }

    const handleDownload = () => {
        if (!contextMenu) return
        const filename = contextMenu.file
        // Trigger download via API
        const downloadUrl = `/api/files/default-project/${filename}/download`
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        a.click()
        setContextMenu(null)
    }

    return (
        <aside className="sidebar">
            <div className="sidebar__header">
                <span>FILES</span>
                <div className="sidebar__actions">
                    <button
                        className="btn btn--icon btn--tiny"
                        title="Toggle details"
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </button>
                    <button
                        className="btn btn--icon btn--tiny"
                        title="Upload file"
                        onClick={handleUploadClick}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17,8 12,3 7,8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </button>
                    <button
                        className="btn btn--icon btn--tiny"
                        title="New file"
                        onClick={() => setIsAdding(true)}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".tex,.bib,.sty,.cls,.txt,.png,.jpg,.jpeg,.pdf"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
            </div>

            <div className="sidebar__content">
                {isAdding && (
                    <div className="file-tree__add">
                        <input
                            type="text"
                            placeholder="filename.tex"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddFile()
                                if (e.key === 'Escape') {
                                    setIsAdding(false)
                                    setNewFileName('')
                                }
                            }}
                            autoFocus
                        />
                        <button onClick={handleAddFile}>✓</button>
                        <button onClick={() => { setIsAdding(false); setNewFileName('') }}>✕</button>
                    </div>
                )}

                <div className="file-tree__list">
                    {files.map((file) => (
                        <div
                            key={file.name}
                            className={`file-tree__item ${activeFile === file.name ? 'file-tree__item--active' : ''}`}
                            onClick={() => onFileSelect(file.name)}
                            onContextMenu={(e) => handleContextMenu(e, file)}
                        >
                            <span className="file-tree__icon">{getIcon(file.type)}</span>
                            <div className="file-tree__info">
                                {renaming === file.name ? (
                                    <input
                                        type="text"
                                        className="file-tree__rename"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename()
                                            if (e.key === 'Escape') {
                                                setRenaming(null)
                                                setRenameValue('')
                                            }
                                        }}
                                        onBlur={handleRename}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <>
                                        <span className="file-tree__name">{file.name}</span>
                                        {showDetails && (
                                            <span className="file-tree__meta">
                                                {formatSize(file.size)} • {formatDate(file.updatedAt)}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            {file.name === 'main.tex' && (
                                <span className="file-tree__badge" title="Main file">★</span>
                            )}
                        </div>
                    ))}
                </div>

                {files.length === 0 && (
                    <div className="file-tree__empty">
                        <p>No files yet</p>
                        <button className="btn btn--secondary btn--small" onClick={() => setIsAdding(true)}>
                            Create first file
                        </button>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="context-menu-overlay"
                        onClick={() => setContextMenu(null)}
                    />
                    <div
                        className="context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button onClick={handleStartRename}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Rename
                        </button>
                        <button onClick={handleDownload}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                        </button>
                        {contextMenu.file !== 'main.tex' && (
                            <button onClick={handleDelete} className="danger">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3,6 5,6 21,6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete
                            </button>
                        )}
                    </div>
                </>
            )}
        </aside>
    )
}

export default FileTree
