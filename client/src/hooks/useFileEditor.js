import { useState, useEffect, useCallback, useRef } from 'react'
import { getFileContent, saveFile, createFile } from '../services/api'

export function useFileEditor(projectId, initialFile = 'main.tex') {
    const [activeFileName, setActiveFileName] = useState(initialFile)
    const [loadedFileName, setLoadedFileName] = useState(null)
    const [code, setCode] = useState(null)
    const [isCodeLoading, setIsCodeLoading] = useState(false)

    // Cache for file contents
    const fileCache = useRef(new Map())
    const currentFetchToken = useRef(0)

    const saveToCache = useCallback((filename, content) => {
        if (filename && content !== null && content !== undefined) {
            fileCache.current.set(filename, content)
        }
    }, [])

    const handleFileSelect = useCallback((filename) => {
        if (!filename || filename === activeFileName) return
        if (filename.endsWith('/')) return

        // 1. Save current content to cache if it exists
        if (activeFileName && code !== null) {
            saveToCache(activeFileName, code)
        }

        // 2. Clear state instantly to force unmount
        setCode(null)
        setLoadedFileName(null)

        // 3. Increment fetch token to invalidate previous pending requests
        currentFetchToken.current += 1

        // 4. Update pointer
        setActiveFileName(filename)
    }, [activeFileName, code, saveToCache])

    // Fetch effect with race condition protection
    useEffect(() => {
        if (!projectId || !activeFileName || code !== null) return

        const fetchToken = currentFetchToken.current

        // Check cache
        if (fileCache.current.has(activeFileName)) {
            const cached = fileCache.current.get(activeFileName)
            setCode(cached)
            setLoadedFileName(activeFileName)
            return
        }

        setIsCodeLoading(true)
        const fetchFile = async () => {
            try {
                const data = await getFileContent(projectId, activeFileName)

                // CRITICAL: Only update if the user hasn't switched files since we started
                if (currentFetchToken.current === fetchToken) {
                    setCode(data.content || '')
                    setLoadedFileName(activeFileName)
                    saveToCache(activeFileName, data.content || '')
                } else {
                    console.log(`[Race Condition] Dropping stale result for ${activeFileName}`)
                }
            } catch (err) {
                console.error('Failed to load file:', err)
                if (currentFetchToken.current === fetchToken) {
                    setCode('')
                    setLoadedFileName(activeFileName)
                }
            } finally {
                if (currentFetchToken.current === fetchToken) {
                    setIsCodeLoading(false)
                }
            }
        }

        fetchFile()
    }, [projectId, activeFileName, code, saveToCache])

    // Manual save helper
    const triggerSave = useCallback(async (content = code) => {
        if (!projectId || !activeFileName || content === null) return
        try {
            await saveFile(projectId, activeFileName, content)
            saveToCache(activeFileName, content)
            return true
        } catch (err) {
            console.error('Save failed:', err)
            throw err
        }
    }, [projectId, activeFileName, code, saveToCache])

    const handleUploadFile = useCallback(async (filename, content, skipReload = false) => {
        try {
            // 1. Create/Overwrite file on server
            await createFile(projectId, filename, content, true)

            // 2. If it's the active file, update editor and cache
            if (filename === activeFileName) {
                if (typeof content === 'string' && !content.startsWith('data:')) {
                    setCode(content)
                    setLoadedFileName(filename)
                    saveToCache(filename, content)
                }
            }

            // 3. Clear cache for this file to force fresh fetch in other contexts
            fileCache.current.delete(filename)

            return true
        } catch (err) {
            console.error('Upload failed:', err)
            return false
        }
    }, [projectId, activeFileName, saveToCache])

    return {
        activeFileName,
        loadedFileName,
        code,
        setCode,
        isCodeLoading,
        handleFileSelect,
        triggerSave,
        handleUploadFile,
        saveToCache
    }
}
