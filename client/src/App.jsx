import { useState, useEffect, useCallback } from 'react'
import Editor from './components/Editor/Editor'
import Preview from './components/Preview/Preview'
import Toolbar from './components/Toolbar/Toolbar'
import FileTree from './components/FileTree/FileTree'
import Console from './components/Console/Console'
import { compileLatex } from './services/api'

const DEFAULT_LATEX = `\\documentclass{article}
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
`

function App() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('latex-theme')
        if (saved) return saved
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    })
    const [engine, setEngine] = useState('pdflatex')
    const [code, setCode] = useState(DEFAULT_LATEX)
    const [pdfUrl, setPdfUrl] = useState(null)
    const [logs, setLogs] = useState('')
    const [isCompiling, setIsCompiling] = useState(false)
    const [consoleOpen, setConsoleOpen] = useState(false)
    const [activeFile, setActiveFile] = useState('main.tex')
    const [collaborators, setCollaborators] = useState([])

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

    // Compile LaTeX
    const handleCompile = useCallback(async () => {
        setIsCompiling(true)
        setLogs('')
        setConsoleOpen(true)

        try {
            const result = await compileLatex({
                code,
                engine,
                filename: activeFile
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
    }, [code, engine, activeFile])

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

    const files = [
        { name: 'main.tex', type: 'tex' },
        { name: 'references.bib', type: 'bib' },
    ]

    return (
        <div className="app">
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
                files={files}
                activeFile={activeFile}
                onFileSelect={setActiveFile}
            />

            <Editor
                code={code}
                onChange={setCode}
                onCollaboratorsChange={setCollaborators}
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
