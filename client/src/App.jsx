import { useState, useEffect, useCallback, useRef } from 'react'
import Editor from './components/Editor/Editor'
import Preview from './components/Preview/Preview'
import Toolbar from './components/Toolbar/Toolbar'
import FileTree from './components/FileTree/FileTree'
import Console from './components/Console/Console'
import { compileLatex } from './services/api'

const DEFAULT_FILES = {
    'main.tex': `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{Welcome to LaTeX Online}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
This is a collaborative LaTeX editor similar to Overleaf.
You can write your documents here and compile them to PDF.

\\section{Math Example}
Here's a beautiful equation:
\\begin{equation}
  E = mc^2
\\end{equation}

And the quadratic formula:
\\begin{equation}
  x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\end{equation}

\\section{Features}
\\begin{itemize}
  \\item Real-time collaboration with Yjs
  \\item Multiple LaTeX engines: pdflatex, xelatex, lualatex
  \\item Dark and light themes
  \\item Mobile-friendly interface
\\end{itemize}

\\end{document}
`,
    'references.bib': `@article{einstein1905,
  author = {Albert Einstein},
  title = {On the Electrodynamics of Moving Bodies},
  journal = {Annalen der Physik},
  year = {1905},
  volume = {17},
  pages = {891--921}
}
`
}

function App() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('latex-theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })
    const [engine, setEngine] = useState('pdflatex')
    const [files, setFiles] = useState(() => {
        const saved = localStorage.getItem('latex-files')
        return saved ? JSON.parse(saved) : DEFAULT_FILES
    })
    const [activeFile, setActiveFile] = useState('main.tex')
    const [pdfUrl, setPdfUrl] = useState(null)
    const [logs, setLogs] = useState('')
    const [isCompiling, setIsCompiling] = useState(false)
    const [consoleOpen, setConsoleOpen] = useState(false)
    const [collaborators, setCollaborators] = useState([])

    // Resizable panels
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('latex-sidebar-width')
        return saved ? parseInt(saved) : 200
    })
    const [editorWidth, setEditorWidth] = useState(() => {
        const saved = localStorage.getItem('latex-editor-width')
        return saved ? parseInt(saved) : 50 // percentage
    })
    const [isResizing, setIsResizing] = useState(null)
    const appRef = useRef(null)

    // Get current file content
    const code = files[activeFile] || ''

    // Update file content
    const setCode = useCallback((newCode) => {
        setFiles(prev => ({
            ...prev,
            [activeFile]: newCode
        }))
    }, [activeFile])

    // Save files to localStorage
    useEffect(() => {
        localStorage.setItem('latex-files', JSON.stringify(files))
    }, [files])

    // Apply theme
    useEffect(() => {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
        } else {
            document.documentElement.setAttribute('data-theme', theme)
        }
        localStorage.setItem('latex-theme', theme)
    }, [theme])

    // Add new file
    const handleAddFile = useCallback((filename) => {
        if (!filename || files[filename]) return false

        let content = ''
        if (filename.endsWith('.tex')) {
            content = `% ${filename}\n\\section{New Section}\n\n`
        } else if (filename.endsWith('.bib')) {
            content = `% Bibliography file: ${filename}\n`
        } else {
            content = `% ${filename}\n`
        }

        setFiles(prev => ({ ...prev, [filename]: content }))
        setActiveFile(filename)
        return true
    }, [files])

    // Delete file
    const handleDeleteFile = useCallback((filename) => {
        if (filename === 'main.tex') return false // Can't delete main.tex

        setFiles(prev => {
            const newFiles = { ...prev }
            delete newFiles[filename]
            return newFiles
        })

        if (activeFile === filename) {
            setActiveFile('main.tex')
        }
        return true
    }, [activeFile])

    // Rename file
    const handleRenameFile = useCallback((oldName, newName) => {
        if (!newName || files[newName] || oldName === 'main.tex') return false

        setFiles(prev => {
            const content = prev[oldName]
            const newFiles = { ...prev }
            delete newFiles[oldName]
            newFiles[newName] = content
            return newFiles
        })

        if (activeFile === oldName) {
            setActiveFile(newName)
        }
        return true
    }, [files, activeFile])

    // Compile LaTeX
    const handleCompile = useCallback(async () => {
        setIsCompiling(true)
        setLogs('')
        setConsoleOpen(true)

        try {
            const result = await compileLatex({
                code: files['main.tex'] || code,
                engine,
                filename: 'main.tex'
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
    }, [files, code, engine])

    // Keyboard shortcut for compile
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                handleCompile()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleCompile])

    // Handle resize
    const handleMouseDown = useCallback((type) => (e) => {
        e.preventDefault()
        setIsResizing(type)
    }, [])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e) => {
            if (!appRef.current) return

            if (isResizing === 'sidebar') {
                const newWidth = Math.max(150, Math.min(400, e.clientX))
                setSidebarWidth(newWidth)
                localStorage.setItem('latex-sidebar-width', newWidth.toString())
            } else if (isResizing === 'editor') {
                const rect = appRef.current.getBoundingClientRect()
                const contentWidth = rect.width - sidebarWidth
                const x = e.clientX - sidebarWidth
                const percent = Math.max(30, Math.min(70, (x / contentWidth) * 100))
                setEditorWidth(percent)
                localStorage.setItem('latex-editor-width', percent.toString())
            }
        }

        const handleMouseUp = () => {
            setIsResizing(null)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, sidebarWidth])

    // Get file list for FileTree
    const fileList = Object.keys(files).map(name => ({
        name,
        type: name.split('.').pop()
    }))

    return (
        <div
            className={`app ${isResizing ? 'resizing' : ''}`}
            ref={appRef}
            style={{
                '--sidebar-width': `${sidebarWidth}px`,
                '--editor-width': `${editorWidth}%`
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
                files={fileList}
                activeFile={activeFile}
                onFileSelect={setActiveFile}
                onAddFile={handleAddFile}
                onDeleteFile={handleDeleteFile}
                onRenameFile={handleRenameFile}
            />

            {/* Sidebar resize handle */}
            <div
                className="resize-handle resize-handle--sidebar"
                onMouseDown={handleMouseDown('sidebar')}
            />

            <Editor
                code={code}
                onChange={setCode}
                onCollaboratorsChange={setCollaborators}
            />

            {/* Editor/Preview resize handle */}
            <div
                className="resize-handle resize-handle--editor"
                onMouseDown={handleMouseDown('editor')}
            />

            <Preview pdfUrl={pdfUrl} />

            <Console
                logs={logs}
                isOpen={consoleOpen}
                onToggle={() => setConsoleOpen(!consoleOpen)}
            />
        </div>
    )
}

export default App
