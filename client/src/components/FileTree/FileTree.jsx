import { useState, useRef, useMemo, useEffect } from 'react'
import { useToast } from '../Toast/Toast'
import { useConfirm } from '../ConfirmDialog/ConfirmDialog'
import JSZip from 'jszip'
import './FileTree.css'

function FileTree({ projectId, files, activeFile, onFileSelect, onAddFile, onDeleteFile, onRenameFile, onUploadFile, onDuplicateFile, onStorageUpdate }) {
    const toast = useToast()
    const { confirm } = useConfirm()

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
    const [uploadProgress, setUploadProgress] = useState(null) // { current, total, filename }

    // Sync selectedFiles with activeFile when it determines the current editor file
    useEffect(() => {
        if (activeFile) {
            setSelectedFiles(new Set([activeFile]))
            // Also ensure the folder containing the active file is expanded
            const parts = activeFile.split('/')
            if (parts.length > 1) {
                const parentPath = parts.slice(0, -1).join('/')
                setExpandedFolders(prev => {
                    // Naive check: if parent not expanded, add it. 
                    // Better: add all parent paths
                    const next = new Set(prev)
                    let currentPath = ''
                    for (let i = 0; i < parts.length - 1; i++) {
                        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
                        next.add(currentPath)
                    }
                    return next
                })
            }
        }
    }, [activeFile])

    const fileInputRef = useRef(null)
    const folderInputRef = useRef(null)
    const scrollContainerRef = useRef(null)

    // Build tree structure from flat file list
    const fileTree = useMemo(() => {
        const tree = { name: '', type: 'folder', children: [], path: '' }

        if (!files || !Array.isArray(files)) return tree

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

    // Get existing file paths for duplicate detection
    const existingFilePaths = useMemo(() => {
        return new Set(files.map(f => f.name.replace(/\/$/, '')))
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
            const success = await onAddFile(fullPath)
            if (success) {
                toast.success(`${addType === 'folder' ? 'Folder' : 'File'} created successfully`)
            }
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

            const confirmed = await confirm({
                title: 'Delete Files',
                message: itemsToDelete.length > 1
                    ? `Are you sure you want to delete ${itemsToDelete.length} items? This action cannot be undone.`
                    : `Are you sure you want to delete "${contextMenu.item.name}"? This action cannot be undone.`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'danger'
            })

            if (confirmed) {
                try {
                    for (const path of itemsToDelete) {
                        await onDeleteFile(path)
                    }
                    setSelectedFiles(new Set())
                    toast.success(`${itemsToDelete.length} item(s) deleted`)
                    if (onStorageUpdate) onStorageUpdate()
                } catch (e) {
                    console.error('Delete failed', e)
                    toast.error('Failed to delete some files')
                }
            }
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

    const handleRename = async () => {
        if (renaming && renameValue.trim() && onRenameFile) {
            const oldPath = renaming
            const parts = oldPath.split('/')
            parts[parts.length - 1] = renameValue.trim()
            const newPath = parts.join('/')

            const success = await onRenameFile(oldPath, newPath)
            if (success) {
                toast.success('Renamed successfully')
            }
        }
        setRenaming(null)
        setRenameValue('')
    }

    const processUpload = async (fileItems) => {
        if (!fileItems || fileItems.length === 0) return

        let itemsToProcess = [...fileItems]

        // 0. Handle Zip extraction
        const zipFiles = itemsToProcess.filter(item => item.file.name.toLowerCase().endsWith('.zip'))

        if (zipFiles.length > 0) {
            const wantUnzip = await confirm({
                title: 'Extract Zip Files?',
                message: `Found ${zipFiles.length} zip file(s). Do you want to extract them?`,
                confirmText: 'Extract',
                cancelText: 'Keep as Zip',
                type: 'info'
            })

            if (wantUnzip) {
                // Remove zips
                itemsToProcess = itemsToProcess.filter(item => !item.file.name.toLowerCase().endsWith('.zip'))

                for (const zipItem of zipFiles) {
                    try {
                        const zip = await JSZip.loadAsync(zipItem.file)
                        const extracted = []

                        const promises = []
                        zip.forEach((relativePath, zipEntry) => {
                            if (!zipEntry.dir) {
                                promises.push(
                                    zipEntry.async('blob').then(blob => {
                                        const fileName = relativePath.split('/').pop()
                                        const file = new File([blob], fileName, { type: blob.type })
                                        extracted.push({ file, path: relativePath })
                                    })
                                )
                            }
                        })
                        await Promise.all(promises)

                        if (extracted.length > 0) {
                            itemsToProcess.push(...extracted)
                            toast.success(`Extracted ${extracted.length} files from ${zipItem.file.name}`)
                        }
                    } catch (err) {
                        console.error('Unzip failed', err)
                        toast.error(`Failed to extract ${zipItem.file.name}`)
                        itemsToProcess.push(zipItem) // Put back if failed
                    }
                }
            }
        }

        const duplicates = itemsToProcess.filter(item => existingFilePaths.has(item.path))
        let overwriteAll = false
        let skipAll = false

        if (duplicates.length > 0) {
            const confirmed = await confirm({
                title: 'Files Already Exist',
                message: duplicates.length === 1
                    ? `"${duplicates[0].path}" already exists. Do you want to overwrite it?`
                    : `${duplicates.length} files already exist. Do you want to overwrite them?`,
                confirmText: 'Overwrite',
                cancelText: 'Skip',
                type: 'warning'
            })
            if (confirmed) overwriteAll = true
            else skipAll = true
        }

        const total = itemsToProcess.length
        let uploaded = 0
        let skipped = 0
        let failed = 0

        setUploadProgress({ current: 0, total, filename: '' })

        for (let i = 0; i < total; i++) {
            const { file, path } = itemsToProcess[i]
            setUploadProgress({ current: i + 1, total, filename: file.name })

            try {
                if (existingFilePaths.has(path) && skipAll) {
                    skipped++
                    continue
                }

                const content = await readFileContent(file)
                if (onUploadFile) {
                    const isLast = i === total - 1
                    await onUploadFile(path, content, !isLast)
                }
                uploaded++
            } catch (err) {
                console.error('Upload failed', err)
                failed++
            }
        }

        setUploadProgress(null)

        if (failed > 0) {
            toast.warning(`Uploaded ${uploaded} files, ${skipped} skipped, ${failed} failed`)
        } else if (skipped > 0) {
            toast.info(`Uploaded ${uploaded} files, ${skipped} skipped`)
        } else {
            toast.success(`Successfully uploaded ${uploaded} file(s)`)
        }

        if (onStorageUpdate) onStorageUpdate()
    }

    const handleUploadFiles = () => {
        fileInputRef.current?.click()
    }

    const handleUploadFolder = async () => {
        // Use File System Access API if available to avoid browser confirmation dialog
        if ('showDirectoryPicker' in window) {
            try {
                const dirHandle = await window.showDirectoryPicker()
                const fileItems = []

                const scan = async (handle, prefix = '') => {
                    for await (const entry of handle.values()) {
                        const path = prefix ? `${prefix}/${entry.name}` : entry.name
                        if (entry.kind === 'file') {
                            const file = await entry.getFile()
                            fileItems.push({ file, path })
                        } else if (entry.kind === 'directory') {
                            await scan(entry, path)
                        }
                    }
                }

                // Start scan with folder name as root
                await scan(dirHandle, dirHandle.name)

                if (fileItems.length === 0) {
                    toast.info('Folder is empty')
                    return
                }

                // Show App Confirmation Dialog instead of Browser Alert
                const confirmed = await confirm({
                    title: 'Confirm Folder Upload',
                    message: `Upload ${fileItems.length} files from folder "${dirHandle.name}"?`,
                    confirmText: 'Upload',
                    cancelText: 'Cancel'
                })

                if (confirmed) {
                    await processUpload(fileItems)
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error(err)
                    toast.error('Failed to access folder: ' + err.message)
                }
            }
        } else {
            // Fallback
            folderInputRef.current?.click()
        }
    }

    const handleFileUpload = async (e) => {
        const uploadedFiles = e.target.files
        if (!uploadedFiles || uploadedFiles.length === 0) return

        const fileItems = Array.from(uploadedFiles).map(file => ({
            file,
            path: file.webkitRelativePath || file.name
        }))

        await processUpload(fileItems)
        e.target.value = ''
    }

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
        if (e.currentTarget.contains(e.relatedTarget)) return
        setIsDragging(false)
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)

        if (scrollContainerRef.current) {
            const { top, bottom } = scrollContainerRef.current.getBoundingClientRect()
            const cursorY = e.clientY
            const threshold = 50

            if (cursorY < top + threshold) {
                scrollContainerRef.current.scrollTop -= 10
            } else if (cursorY > bottom - threshold) {
                scrollContainerRef.current.scrollTop += 10
            }
        }
    }

    const collectFilesFromEntry = async (item, path = '') => {
        const files = []

        if (item.isFile) {
            return new Promise((resolve) => {
                item.file((file) => {
                    const fullPath = path + file.name
                    resolve([{ file, path: fullPath }])
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

            for (const entry of entries) {
                const subFiles = await collectFilesFromEntry(entry, path + item.name + '/')
                files.push(...subFiles)
            }
        }

        return files
    }

    const handleDrop = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        // Handle internal drag to root
        if (draggedItem) {
            const fileName = draggedItem.name
            const newPath = draggedItem.type === 'folder'
                ? (fileName.endsWith('/') ? fileName : fileName + '/')
                : fileName

            if (draggedItem.path === newPath) {
                setDraggedItem(null)
                return
            }

            const confirmed = await confirm({
                title: 'Move to Root',
                message: `Move "${draggedItem.name}" to the top level folder?`,
                confirmText: 'Move',
                cancelText: 'Cancel'
            })

            if (confirmed && onRenameFile) {
                try {
                    await onRenameFile(draggedItem.path, newPath)
                    toast.success('Moved to root')
                } catch (err) {
                    toast.error('Failed to move')
                }
            }
            setDraggedItem(null)
            return
        }

        const items = e.dataTransfer?.items
        if (!items) return

        const allFiles = []
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null
            if (item) {
                const files = await collectFilesFromEntry(item)
                allFiles.push(...files)
            }
        }

        await processUpload(allFiles)
    }

    const readFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = reject

            // Text file extensions
            const textExtensions = ['tex', 'bib', 'txt', 'sty', 'cls', 'md', 'json', 'xml', 'html', 'css', 'js', 'bbl', 'aux', 'log', 'out', 'toc', 'lof', 'lot']
            const ext = file.name.split('.').pop().toLowerCase()

            if (textExtensions.includes(ext)) {
                reader.onload = () => resolve(reader.result)
                reader.readAsText(file)
            } else {
                // For binary files (images, PDFs), use ArrayBuffer and convert to base64
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
                reader.readAsArrayBuffer(file)
            }
        })
    }

    const handleDownload = () => {
        if (!contextMenu) return
        const path = contextMenu.item.path
        const downloadUrl = `/api/files/${projectId}/${encodeURIComponent(path)}/download`
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
            toast.success('File duplicated')
            if (onStorageUpdate) onStorageUpdate()
        } catch (err) {
            console.error('Failed to duplicate:', err)
        }
        setContextMenu(null)
    }

    const [draggedItem, setDraggedItem] = useState(null)

    const handleDragStartItem = (e, item) => {
        e.stopPropagation()
        setDraggedItem(item)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', item.path)
    }

    const handleDragEndItem = (e) => {
        setDraggedItem(null)
        setIsDragging(false)
    }

    const handleDragOverItem = (e, item) => {
        e.preventDefault()
        e.stopPropagation()

        if (draggedItem && item.path !== draggedItem.path) {
            // Check if item is a child of draggedItem (if draggedItem is folder)
            if (draggedItem.type === 'folder' && item.path.startsWith(draggedItem.path)) {
                e.dataTransfer.dropEffect = 'none'
                return
            }
            e.currentTarget.classList.add('file-tree__item--drop-target')
            e.dataTransfer.dropEffect = 'move'
        } else {
            e.dataTransfer.dropEffect = 'none'
        }
    }

    const handleDragLeaveItem = (e) => {
        e.currentTarget.classList.remove('file-tree__item--drop-target')
    }

    const handleDropItem = async (e, targetItem) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.classList.remove('file-tree__item--drop-target')
        setIsDragging(false)

        if (!draggedItem || !targetItem) return
        if (draggedItem.path === targetItem.path) return

        // Calculate new path
        let targetPath = ''
        if (targetItem.type === 'folder') {
            targetPath = targetItem.path.endsWith('/') ? targetItem.path : targetItem.path + '/'
        } else {
            // Sibling drop: parent
            const parts = targetItem.path.split('/')
            parts.pop()
            targetPath = parts.join('/')
            if (targetPath && !targetPath.endsWith('/')) targetPath += '/'
        }

        const fileName = draggedItem.name
        const newPath = targetPath + fileName + (draggedItem.type === 'folder' ? '/' : '')

        if (newPath === draggedItem.path) return

        const confirmed = await confirm({
            title: 'Move Item',
            message: `Move "${draggedItem.name}" to "${targetPath || 'root'}"?`,
            confirmText: 'Move',
            cancelText: 'Cancel'
        })

        if (confirmed) {
            try {
                if (onRenameFile) {
                    const success = await onRenameFile(draggedItem.path, newPath)
                    if (success) {
                        toast.success('Moved successfully')
                    }
                }
            } catch (err) {
                toast.error('Failed to move item')
            }
        }
        setDraggedItem(null)
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
            if (item.type === 'folder') {
                toggleFolder(item.path)
            } else {
                setSelectedFiles(new Set([item.path]))
                setLastSelectedPath(item.path)
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
                    className={`file-tree__item ${isActive || isSelected ? 'file-tree__item--selected' : ''} ${isFolder ? 'file-tree__item--folder' : ''}`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    draggable
                    onDragStart={(e) => handleDragStartItem(e, item)}
                    onDragEnd={handleDragEndItem}
                    onDragOver={(e) => handleDragOverItem(e, item)}
                    onDragLeave={handleDragLeaveItem}
                    onDrop={(e) => handleDropItem(e, item)}
                    onClick={(e) => handleItemClick(e, item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                >
                    {isFolder && (
                        <span
                            className={`file-tree__chevron ${isExpanded ? 'file-tree__chevron--expanded' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                toggleFolder(item.path)
                            }}
                        >
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
            {isDragging && !draggedItem && (
                <div className="file-tree__drop-overlay">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        <polyline points="12,10 12,16" />
                        <polyline points="9,13 12,10 15,13" />
                    </svg>
                    <p>Drop files or folders here</p>
                </div>
            )}

            {uploadProgress && (
                <div className="file-tree__upload-progress">
                    <div className="file-tree__upload-progress-bar">
                        <div
                            className="file-tree__upload-progress-fill"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                    </div>
                    <span>Uploading {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.filename}</span>
                </div>
            )}

            <div className="sidebar__header">
                <span>FILES</span>
                <div className="sidebar__actions">
                    <button
                        className="btn btn--icon btn--tiny"
                        title="Upload files"
                        onClick={handleUploadFiles}
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
                        onClick={handleUploadFolder}
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

            <div className="sidebar__content" ref={scrollContainerRef}>
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
                                <button onClick={() => { handleNewFile(''); setContextMenu(null) }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                        <polyline points="14,2 14,8 20,8" />
                                        <line x1="12" y1="18" x2="12" y2="12" />
                                        <line x1="9" y1="15" x2="15" y2="15" />
                                    </svg>
                                    New File
                                </button>
                                <button onClick={() => { handleNewFolder(''); setContextMenu(null) }}>
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
        </aside>
    )
}

export default FileTree
