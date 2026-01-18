import { useState, useCallback, useEffect } from 'react'

export function useResizable() {
    const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem('latex-sidebar-width') || '250'))
    const [editorWidth, setEditorWidth] = useState(() => parseInt(localStorage.getItem('latex-editor-width') || '50'))
    const [consoleHeight, setConsoleHeight] = useState(() => parseInt(localStorage.getItem('latex-console-height') || '200'))
    const [isResizing, setIsResizing] = useState(null)

    const handleMouseDown = useCallback((type) => (e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(type)
    }, [])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e) => {
            if (isResizing === 'sidebar') {
                const newWidth = Math.max(150, Math.min(450, e.clientX))
                setSidebarWidth(newWidth)
            } else if (isResizing === 'editor') {
                // Find nearest main-content parent for relative calculation
                const mainContent = document.querySelector('.main-content')
                if (mainContent) {
                    const rect = mainContent.getBoundingClientRect()
                    const x = e.clientX - rect.left

                    // Constraints in pixels (matching CSS min-widths)
                    const minWidthPx = 200
                    const maxWidthPx = rect.width - 200

                    const safeX = Math.max(minWidthPx, Math.min(maxWidthPx, x))
                    const percent = (safeX / rect.width) * 100

                    setEditorWidth(percent)
                }
            } else if (isResizing === 'console') {
                const contentArea = document.querySelector('.content-area')
                if (contentArea) {
                    const rect = contentArea.getBoundingClientRect()
                    const newHeight = Math.max(80, Math.min(600, rect.bottom - e.clientY))
                    setConsoleHeight(newHeight)
                }
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

    return {
        sidebarWidth,
        editorWidth,
        consoleHeight,
        isResizing,
        handleMouseDown
    }
}
