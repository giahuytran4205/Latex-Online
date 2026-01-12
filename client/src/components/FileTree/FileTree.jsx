import { useState } from 'react'
import './FileTree.css'

function FileTree({ files, activeFile, onFileSelect, onAddFile, onDeleteFile, onRenameFile }) {
    const [isAdding, setIsAdding] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [contextMenu, setContextMenu] = useState(null)
    const [renaming, setRenaming] = useState(null)
    const [renameValue, setRenameValue] = useState('')

    const getIcon = (type) => {
        switch (type) {
            case 'tex':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                    </svg>
                )
            case 'bib':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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

    return (
        <aside className="sidebar">
            <div className="sidebar__header">
                <span>FILES</span>
                <button
                    className="btn btn--icon"
                    title="New file"
                    onClick={() => setIsAdding(true)}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
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

                {files.map((file) => (
                    <div
                        key={file.name}
                        className={`file-tree__item ${activeFile === file.name ? 'file-tree__item--active' : ''}`}
                        onClick={() => onFileSelect(file.name)}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                    >
                        <span className="file-tree__icon">{getIcon(file.type)}</span>
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
                            <span>{file.name}</span>
                        )}
                    </div>
                ))}
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
                        <button onClick={handleStartRename}>Rename</button>
                        {contextMenu.file !== 'main.tex' && (
                            <button onClick={handleDelete} className="danger">Delete</button>
                        )}
                    </div>
                </>
            )}
        </aside>
    )
}

export default FileTree
