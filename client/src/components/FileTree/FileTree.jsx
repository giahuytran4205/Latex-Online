import { useState, useRef, useMemo } from 'react'
import './FileTree.css'

function FileTree({ files, activeFile, onFileSelect, onAddFile, onDeleteFile, onRenameFile, onUploadFile, onDuplicateFile }) {
    const [isAdding, setIsAdding] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState(new Set())
    const [addType, setAddType] = useState('file') // 'file' or 'folder'
    const [addPath, setAddPath] = useState('') // Parent path for new item
    const [newFileName, setNewFileName] = useState('')
    const [contextMenu, setContextMenu] = useState(null)
    const [renaming, setRenaming] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const [expandedFolders, setExpandedFolders] = useState(() => {
        const saved = localStorage.getItem('latex-expanded-folders')
        return saved ? new Set(JSON.parse(saved)) : new Set([''])
    })
    const fileInputRef = useRef(null)

    // Build tree structure from flat file list
    const fileTree = useMemo(() => {
        const tree = { name: '', type: 'folder', children: [], path: '' }

        const sortedFiles = [...files].sort((a, b) => {
            // Folders first, then files
            const aIsFolder = a.name.endsWith('/')
            const bIsFolder = b.name.endsWith('/')
            if (aIsFolder && !bIsFolder) return -1
            if (!aIsFolder && bIsFolder) return 1
            return a.name.localeCompare(b.name)
        })

        sortedFiles.forEach(file => {
            const parts = file.name.split('/')
            let current = tree

            parts.forEach((part, index) => {
                if (!part) return

                const isLast = index === parts.length - 1
                const path = parts.slice(0, index + 1).join('/')

                let child = current.children.find(c => c.name === part)

                if (!child) {
                    child = {
                        name: part,
                        path: path,
                        type: isLast && !file.name.endsWith('/') ? (file.type || 'file') : 'folder',
                        children: [],
                        size: file.size,
                        updatedAt: file.updatedAt
                    }
                    current.children.push(child)
                }

                current = child
            })
        })

        return tree
    }, [files])

    const getIcon = (type, isExpanded = false) => {
        if (type === 'folder') {
            return isExpanded ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
            ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
            )
        }

        switch (type) {
            case 'tex':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                    </svg>
                )
            case 'bib':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                )
            case 'sty':
            case 'cls':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <circle cx="12" cy="14" r="3" />
                    </svg>
                )
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'svg':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21,15 16,10 5,21" />
                    </svg>
                )
            case 'pdf':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
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

    const [lastSelectedPath, setLastSelectedPath] = useState(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [confirmMessage, setConfirmMessage] = useState('')
    const [confirmAction, setConfirmAction] = useState(null)

    // Helper to get flat list of visible items for range selection
    const visibleItems = useMemo(() => {
        const items = []
        const traverse = (nodes) => {
            const sorted = [...nodes].sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1
                if (a.type !== 'folder' && b.type === 'folder') return 1
                return a.name.localeCompare(b.name)
            })

            for (const item of sorted) {
                items.push(item)
                if (item.type === 'folder' && expandedFolders.has(item.path)) {
                    traverse(item.children || [])
                }
            }
        }
        traverse(fileTree.children || [])
        return items
    }, [fileTree, expandedFolders])

    const handleNewFile = (initialName = '') => {
        let path = ''
        if (selectedFiles.size === 1) {
            const selected = Array.from(selectedFiles)[0]
            if (selected.endsWith('/')) {
                path = selected.slice(0, -1)
            } else {
                const parts = selected.split('/')
                if (parts.length > 1) {
                    path = parts.slice(0, -1).join('/')
                }
            }
        }

        setAddType('file')
        setAddPath(path)
        setIsAdding(true)
        setNewFileName(initialName)
    }

    const handleNewFolder = (initialName = '') => {
        let path = ''
        if (selectedFiles.size === 1) {
            const selected = Array.from(selectedFiles)[0]
            if (selected.endsWith('/')) {
                path = selected.slice(0, -1)
            } else {
                const parts = selected.split('/')
                if (parts.length > 1) {
                    path = parts.slice(0, -1).join('/')
                }
            }
        }

        setAddType('folder')
        setAddPath(path)
        setIsAdding(true)
        setNewFileName(initialName)
    }

    const toggleFolder = (path) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(path)) {
            newExpanded.delete(path)
        } else {
            newExpanded.add(path)
        }
        setExpandedFolders(newExpanded)
        localStorage.setItem('latex-expanded-folders', JSON.stringify([...newExpanded]))
    }

    const handleAddItem = async () => {
        if (!newFileName.trim()) {
            setIsAdding(false)
            return
        }

        const filename = newFileName.trim()
        // If it's a folder we are adding
        const nameToCreate = addType === 'folder'
            ? (filename.endsWith('/') ? filename : filename + '/')
            : filename

        const fullPath = addPath ? `${addPath}/${nameToCreate}` : nameToCreate

        if (onAddFile) {
            await onAddFile(fullPath)
            setNewFileName('')
            setIsAdding(false)
            setAddPath('')
        }
    }



    const handleDelete = async () => {
        if (contextMenu && onDeleteFile) {
            // If the context item is in selection, delete all selected
            const itemsToDelete = selectedFiles.has(contextMenu.item.path)
                ? Array.from(selectedFiles)
                : [contextMenu.item.path]

            const message = itemsToDelete.length > 1
                ? `Are you sure you want to delete ${itemsToDelete.length} items?`
                : `Are you sure you want to delete "${contextMenu.item.name}"?`

            setConfirmMessage(message)
            setConfirmAction(() => async () => {
                try {
                    for (const path of itemsToDelete) {
                        await onDeleteFile(path)
                    }
                    setSelectedFiles(new Set())
                } catch (e) {
                    console.error('Delete failed', e)
                } finally {
                    setShowConfirm(false)
                }
            })
            setShowConfirm(true)
        }
        setContextMenu(null)
    }

    const handleStartRename = () => {
        if (contextMenu) {
            setRenaming(contextMenu.item.path)
            setRenameValue(contextMenu.item.name)
        }
        setContextMenu(null)
    }

    const handleRename = () => {
        if (renaming && renameValue.trim() && onRenameFile) {
            const oldPath = renaming
            const parts = oldPath.split('/')
            parts[parts.length - 1] = renameValue.trim()
            const newPath = parts.join('/')
            onRenameFile(oldPath, newPath)
        }
        setRenaming(null)
        setRenameValue('')
    }



    const handleUploadClick = () => {
        fileInputRef.current?.click()
    }

    const handleUploadFolderClick = () => {
        folderInputRef.current?.click()
    }

    const handleFileUpload = async (e) => {
        const uploadedFiles = e.target.files
        if (!uploadedFiles || uploadedFiles.length === 0) return

        const totalFiles = uploadedFiles.length
        let uploaded = 0
        let failed = 0

        for (const file of uploadedFiles) {
            try {
                // Use webkitRelativePath if available (folder upload), otherwise just filename
                const uploadPath = file.webkitRelativePath || file.name

                const content = await readFileContent(file)
                if (onUploadFile) {
                    await onUploadFile(uploadPath, content)
                }
                uploaded++
            } catch (err) {
                console.error('Failed to upload file:', err)
                failed++
            }
        }

        if (failed > 0) {
            alert(`Upload complete: ${uploaded} successful, ${failed} failed`)
        }

        e.target.value = ''
    }

    const folderInputRef = useRef(null)

    // Drag & Drop handlers
    const [isDragging, setIsDragging] = useState(false)

    const handleDragEnter = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Only disable if leaving the main container
        if (e.currentTarget.contains(e.relatedTarget)) return
        setIsDragging(false)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const traverseFileTree = async (item, path = '') => {
        if (item.isFile) {
            return new Promise((resolve, reject) => {
                item.file(async (file) => {
                    try {
                        const content = await readFileContent(file)
                        // Preserve full path relative to drop root
                        const fullPath = path + file.name
                        if (onUploadFile) {
                            await onUploadFile(fullPath, content)
                        }
                        resolve({ success: true })
                    } catch (e) {
                        console.error('Failed to read file:', e)
                        resolve({ success: false })
                    }
                })
            })
        } else if (item.isDirectory) {
            const dirReader = item.createReader()
            const entries = await new Promise((resolve) => {
                const results = []
                const readNext = () => {
                    dirReader.readEntries((entryList) => {
                        if (entryList.length === 0) {
                            resolve(results)
                        } else {
                            results.push(...entryList)
                            readNext()
                        }
                    })
                }
                readNext()
            })

            // Recursively traverse
            const promises = entries.map(entry => traverseFileTree(entry, path + item.name + '/'))
            return Promise.all(promises)
        }
    }

    const handleDrop = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const items = e.dataTransfer.items
        if (!items) return

        let count = 0
        const promises = []

        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null
            if (item) {
                promises.push(traverseFileTree(item))
                count++
            }
        }

        if (count > 0) {
            await Promise.all(promises)
        }
    }

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = reject

            // Text file extensions
            const textExtensions = ['tex', 'bib', 'txt', 'sty', 'cls', 'md', 'json', 'xml', 'html', 'css', 'js', 'bbl', 'aux', 'log', 'out', 'toc', 'lof', 'lot']
            const ext = file.name.split('.').pop().toLowerCase()

            if (textExtensions.includes(ext)) {
                reader.readAsText(file)
            } else {
                // For binary files (images, PDFs), use ArrayBuffer and convert to base64
                reader.readAsArrayBuffer(file)
                reader.onload = () => {
                    const buffer = reader.result
                    const bytes = new Uint8Array(buffer)
                    let binary = ''
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i])
                    }
                    const base64 = 'data:' + file.type + ';base64,' + btoa(binary)
                    resolve(base64)
                }
            }
        })
    }

    const handleDownload = () => {
        if (!contextMenu) return
        const path = contextMenu.item.path
        const downloadUrl = `/api/files/default-project/${encodeURIComponent(path)}/download`
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = contextMenu.item.name
        a.click()
        setContextMenu(null)
    }

    const handleDuplicate = async () => {
        if (!contextMenu || !onDuplicateFile) return
        try {
            await onDuplicateFile(contextMenu.item.path)
        } catch (err) {
            console.error('Failed to duplicate:', err)
        }
        setContextMenu(null)
    }

    const handleItemClick = (e, item) => {
        e.stopPropagation()

        if (e.shiftKey && lastSelectedPath) {
            const startIdx = visibleItems.findIndex(i => i.path === lastSelectedPath)
            const endIdx = visibleItems.findIndex(i => i.path === item.path)

            if (startIdx !== -1 && endIdx !== -1) {
                const start = Math.min(startIdx, endIdx)
                const end = Math.max(startIdx, endIdx)
                const range = visibleItems.slice(start, end + 1).map(i => i.path)

                const newSelected = new Set(selectedFiles)
                range.forEach(path => newSelected.add(path))
                setSelectedFiles(newSelected)
            }
        } else if (e.ctrlKey || e.metaKey) {
            const newSelected = new Set(selectedFiles)
            if (newSelected.has(item.path)) {
                newSelected.delete(item.path)
            } else {
                newSelected.add(item.path)
                setLastSelectedPath(item.path)
            }
            setSelectedFiles(newSelected)
        } else {
            setSelectedFiles(new Set([item.path]))
            setLastSelectedPath(item.path)
            if (item.type === 'folder') {
                toggleFolder(item.path)
            } else {
                onFileSelect(item.path)
            }
        }
    }

    const handleContextMenu = (e, item) => {
        e.preventDefault()
        e.stopPropagation()

        // If right-clicking item not in selection, start new selection
        if (!selectedFiles.has(item.path)) {
            setSelectedFiles(new Set([item.path]))
        }

        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            item: item
        })
    }

    const renderItem = (item, depth = 0) => {
        const isFolder = item.type === 'folder'
        const isExpanded = expandedFolders.has(item.path)
        const isActive = activeFile === item.path
        const isSelected = selectedFiles.has(item.path)
        const isRenaming = renaming === item.path

        return (
            <div key={item.path || 'root'} className="file-tree__node">
                <div
                    className={`file-tree__item ${isActive ? 'file-tree__item--active' : ''} ${isSelected ? 'file-tree__item--selected' : ''} ${isFolder ? 'file-tree__item--folder' : ''}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    onClick={(e) => handleItemClick(e, item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                >
                    {isFolder && (
                        <span className={`file-tree__chevron ${isExpanded ? 'file-tree__chevron--expanded' : ''}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9,18 15,12 9,6" />
                            </svg>
                        </span>
                    )}
                    <span className="file-tree__icon">{getIcon(item.type, isExpanded)}</span>
                    <div className="file-tree__info">
                        {isRenaming ? (
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
                            <span className="file-tree__name">{item.name}</span>
                        )}
                    </div>
                    {item.path === 'main.tex' && (
                        <span className="file-tree__badge" title="Main file">★</span>
                    )}
                </div>

                {isFolder && isExpanded && item.children && (
                    <div className="file-tree__children">
                        {item.children
                            .sort((a, b) => {
                                // Folders first
                                if (a.type === 'folder' && b.type !== 'folder') return -1
                                if (a.type !== 'folder' && b.type === 'folder') return 1
                                return a.name.localeCompare(b.name)
                            })
                            .map(child => renderItem(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <aside
            className={`sidebar ${isDragging ? 'file-tree--dragging' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="file-tree__drop-overlay">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        <polyline points="12,10 12,16" />
                        <polyline points="9,13 12,10 15,13" />
                    </svg>
                    <p>Drop files or folders here</p>
                </div>
            )}
            <div className="sidebar__header">
                <span>FILES</span>
                <div className="sidebar__actions">
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
                        title="Upload folder"
                        onClick={handleUploadFolderClick}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            <polyline points="12,10 12,16" />
                            <polyline points="9,13 12,10 15,13" />
                        </svg>
                    </button>
                    <button
                        className="btn btn--icon btn--tiny"
                        title="New folder"
                        onClick={() => handleNewFolder('')}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            <line x1="12" y1="11" x2="12" y2="17" />
                            <line x1="9" y1="14" x2="15" y2="14" />
                        </svg>
                    </button>
                    <button
                        className="btn btn--icon btn--tiny"
                        title="New file"
                        onClick={() => handleNewFile('')}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                    </button>
                </div>
                {/* Hidden file inputs */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
                <input
                    ref={folderInputRef}
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                />
            </div>

            <div className="sidebar__content">
                {isAdding && (
                    <div className="file-tree__add">
                        <span className="file-tree__add-icon">
                            {addType === 'folder' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14,2 14,8 20,8" />
                                </svg>
                            )}
                        </span>
                        <input
                            type="text"
                            placeholder={addType === 'folder' ? 'folder name' : 'filename.tex'}
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddItem()
                                if (e.key === 'Escape') {
                                    setIsAdding(false)
                                    setNewFileName('')
                                }
                            }}
                            autoFocus
                        />
                        <button onClick={handleAddItem}>✓</button>
                        <button onClick={() => { setIsAdding(false); setNewFileName('') }}>✕</button>
                    </div>
                )}

                <div className="file-tree__list">
                    {fileTree.children
                        .sort((a, b) => {
                            if (a.type === 'folder' && b.type !== 'folder') return -1
                            if (a.type !== 'folder' && b.type === 'folder') return 1
                            return a.name.localeCompare(b.name)
                        })
                        .map(item => renderItem(item, 0))}
                </div>

                {fileTree.children.length === 0 && !isAdding && (
                    <div className="file-tree__empty">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        <p>No files yet</p>
                        <div className="file-tree__empty-actions">
                            <button className="btn btn--secondary btn--small" onClick={() => handleNewFile('')}>
                                New File
                            </button>
                            <button className="btn btn--secondary btn--small" onClick={() => handleNewFolder('')}>
                                New Folder
                            </button>
                        </div>
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
                        {contextMenu.item.type === 'folder' && (
                            <>
                                <button onClick={() => handleNewFile(contextMenu.item.path)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14,2 14,8 20,8" />
                                        <line x1="12" y1="18" x2="12" y2="12" />
                                        <line x1="9" y1="15" x2="15" y2="15" />
                                    </svg>
                                    New File
                                </button>
                                <button onClick={() => handleNewFolder(contextMenu.item.path)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        <line x1="12" y1="11" x2="12" y2="17" />
                                        <line x1="9" y1="14" x2="15" y2="14" />
                                    </svg>
                                    New Folder
                                </button>
                                <div className="context-menu__separator" />
                            </>
                        )}
                        <button onClick={handleStartRename}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            Rename
                        </button>
                        {contextMenu.item.type !== 'folder' && (
                            <>
                                <button onClick={handleDownload}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7,10 12,15 17,10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download
                                </button>
                                <button onClick={handleDuplicate}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                    Duplicate
                                </button>
                            </>
                        )}
                        {contextMenu.item.path !== 'main.tex' && (
                            <>
                                <div className="context-menu__separator" />
                                <button onClick={handleDelete} className="danger">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3,6 5,6 21,6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                    Delete
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
            {showConfirm && (
                <div className="file-tree__confirm-overlay">
                    <div className="file-tree__confirm-modal">
                        <h3>Confirm Action</h3>
                        <p>{confirmMessage}</p>
                        <div className="file-tree__confirm-actions">
                            <button className="btn btn--secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="btn btn--danger" onClick={confirmAction}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}

export default FileTree
