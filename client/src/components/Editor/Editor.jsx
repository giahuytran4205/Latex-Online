import { useEffect, useRef, useMemo, useCallback } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { autocompletion, startCompletion, completionStatus, acceptCompletion } from '@codemirror/autocomplete'
import './Editor.css'

// LaTeX autocomplete data
const latexCommands = [
    // Document structure
    { label: '\\documentclass', type: 'keyword', info: 'Define document class', apply: '\\documentclass{article}' },
    { label: '\\usepackage', type: 'keyword', info: 'Import package', apply: '\\usepackage{}' },
    { label: '\\begin', type: 'keyword', info: 'Begin environment', apply: '\\begin{}' },
    { label: '\\end', type: 'keyword', info: 'End environment', apply: '\\end{}' },
    { label: '\\title', type: 'keyword', info: 'Document title', apply: '\\title{}' },
    { label: '\\author', type: 'keyword', info: 'Document author', apply: '\\author{}' },
    { label: '\\date', type: 'keyword', info: 'Document date', apply: '\\date{}' },
    { label: '\\maketitle', type: 'keyword', info: 'Render title' },

    // Sections
    { label: '\\section', type: 'function', info: 'Section heading', apply: '\\section{}' },
    { label: '\\subsection', type: 'function', info: 'Subsection heading', apply: '\\subsection{}' },
    { label: '\\subsubsection', type: 'function', info: 'Subsubsection', apply: '\\subsubsection{}' },
    { label: '\\paragraph', type: 'function', info: 'Paragraph heading', apply: '\\paragraph{}' },
    { label: '\\chapter', type: 'function', info: 'Chapter heading', apply: '\\chapter{}' },

    // Text formatting
    { label: '\\textbf', type: 'function', info: 'Bold text', apply: '\\textbf{}' },
    { label: '\\textit', type: 'function', info: 'Italic text', apply: '\\textit{}' },
    { label: '\\underline', type: 'function', info: 'Underlined text', apply: '\\underline{}' },
    { label: '\\emph', type: 'function', info: 'Emphasized text', apply: '\\emph{}' },
    { label: '\\texttt', type: 'function', info: 'Typewriter text', apply: '\\texttt{}' },
    { label: '\\textsc', type: 'function', info: 'Small caps', apply: '\\textsc{}' },

    // Math
    { label: '\\frac', type: 'function', info: 'Fraction', apply: '\\frac{}{}' },
    { label: '\\sqrt', type: 'function', info: 'Square root', apply: '\\sqrt{}' },
    { label: '\\sum', type: 'function', info: 'Summation' },
    { label: '\\int', type: 'function', info: 'Integral' },
    { label: '\\prod', type: 'function', info: 'Product' },
    { label: '\\lim', type: 'function', info: 'Limit' },
    { label: '\\infty', type: 'constant', info: 'Infinity symbol' },
    { label: '\\alpha', type: 'constant', info: 'Greek alpha' },
    { label: '\\beta', type: 'constant', info: 'Greek beta' },
    { label: '\\gamma', type: 'constant', info: 'Greek gamma' },
    { label: '\\delta', type: 'constant', info: 'Greek delta' },
    { label: '\\epsilon', type: 'constant', info: 'Greek epsilon' },
    { label: '\\theta', type: 'constant', info: 'Greek theta' },
    { label: '\\lambda', type: 'constant', info: 'Greek lambda' },
    { label: '\\mu', type: 'constant', info: 'Greek mu' },
    { label: '\\pi', type: 'constant', info: 'Greek pi' },
    { label: '\\sigma', type: 'constant', info: 'Greek sigma' },
    { label: '\\omega', type: 'constant', info: 'Greek omega' },
    { label: '\\partial', type: 'constant', info: 'Partial derivative' },
    { label: '\\nabla', type: 'constant', info: 'Nabla/gradient' },
    { label: '\\times', type: 'constant', info: 'Multiplication' },
    { label: '\\cdot', type: 'constant', info: 'Dot product' },
    { label: '\\leq', type: 'constant', info: 'Less or equal' },
    { label: '\\geq', type: 'constant', info: 'Greater or equal' },
    { label: '\\neq', type: 'constant', info: 'Not equal' },
    { label: '\\approx', type: 'constant', info: 'Approximately' },
    { label: '\\rightarrow', type: 'constant', info: 'Right arrow' },
    { label: '\\leftarrow', type: 'constant', info: 'Left arrow' },
    { label: '\\Rightarrow', type: 'constant', info: 'Double right arrow' },
    { label: '\\Leftrightarrow', type: 'constant', info: 'Double arrow' },

    // References
    { label: '\\label', type: 'function', info: 'Create label', apply: '\\label{}' },
    { label: '\\ref', type: 'function', info: 'Reference label', apply: '\\ref{}' },
    { label: '\\cite', type: 'function', info: 'Citation', apply: '\\cite{}' },
    { label: '\\bibliography', type: 'function', info: 'Bibliography file', apply: '\\bibliography{}' },
    { label: '\\bibliographystyle', type: 'function', info: 'Bibliography style', apply: '\\bibliographystyle{}' },

    // Figures and tables
    { label: '\\includegraphics', type: 'function', info: 'Include image', apply: '\\includegraphics[width=\\textwidth]{}' },
    { label: '\\caption', type: 'function', info: 'Figure/table caption', apply: '\\caption{}' },
    { label: '\\centering', type: 'keyword', info: 'Center content' },

    // Lists
    { label: '\\item', type: 'keyword', info: 'List item' },

    // Spacing
    { label: '\\newline', type: 'keyword', info: 'New line' },
    { label: '\\newpage', type: 'keyword', info: 'New page' },
    { label: '\\vspace', type: 'function', info: 'Vertical space', apply: '\\vspace{}' },
    { label: '\\hspace', type: 'function', info: 'Horizontal space', apply: '\\hspace{}' },
    { label: '\\noindent', type: 'keyword', info: 'No indentation' },

    // Footnotes
    { label: '\\footnote', type: 'function', info: 'Footnote', apply: '\\footnote{}' },
]

const latexEnvironments = [
    { label: 'document', info: 'Main document body' },
    { label: 'figure', info: 'Figure environment' },
    { label: 'table', info: 'Table environment' },
    { label: 'tabular', info: 'Tabular data' },
    { label: 'itemize', info: 'Bulleted list' },
    { label: 'enumerate', info: 'Numbered list' },
    { label: 'description', info: 'Description list' },
    { label: 'equation', info: 'Numbered equation' },
    { label: 'equation*', info: 'Unnumbered equation' },
    { label: 'align', info: 'Aligned equations' },
    { label: 'align*', info: 'Aligned equations (unnumbered)' },
    { label: 'abstract', info: 'Abstract text' },
    { label: 'quote', info: 'Block quote' },
    { label: 'verbatim', info: 'Verbatim text' },
    { label: 'center', info: 'Centered content' },
    { label: 'minipage', info: 'Mini page' },
    { label: 'array', info: 'Math array' },
    { label: 'matrix', info: 'Matrix' },
    { label: 'pmatrix', info: 'Parentheses matrix' },
    { label: 'bmatrix', info: 'Bracket matrix' },
    { label: 'cases', info: 'Cases/piecewise' },
]

// LaTeX autocomplete function
function latexCompletions(context) {
    const word = context.matchBefore(/\\[\w]*/)
    const envMatch = context.matchBefore(/\\begin\{[\w]*/)
    const endEnvMatch = context.matchBefore(/\\end\{[\w]*/)

    if (envMatch) {
        const prefix = envMatch.text.replace('\\begin{', '')
        return {
            from: envMatch.from + 7,
            options: latexEnvironments
                .filter(e => e.label.startsWith(prefix))
                .map(e => ({
                    label: e.label,
                    type: 'type',
                    info: e.info,
                    apply: e.label + '}\n\n\\end{' + e.label + '}'
                }))
        }
    }

    if (endEnvMatch) {
        const prefix = endEnvMatch.text.replace('\\end{', '')
        return {
            from: endEnvMatch.from + 5,
            options: latexEnvironments
                .filter(e => e.label.startsWith(prefix))
                .map(e => ({
                    label: e.label,
                    type: 'type',
                    info: e.info,
                    apply: e.label + '}'
                }))
        }
    }

    if (!word) return null

    return {
        from: word.from,
        options: latexCommands.filter(cmd =>
            cmd.label.toLowerCase().startsWith(word.text.toLowerCase())
        )
    }
}

// Wrap selection with LaTeX command
function wrapSelection(view, before, after) {
    const { from, to } = view.state.selection.main
    const selectedText = view.state.doc.sliceString(from, to)

    view.dispatch({
        changes: { from, to, insert: before + selectedText + after },
        selection: { anchor: from + before.length, head: from + before.length + selectedText.length }
    })
    return true
}

function Editor({ code, onChange, onCompile, activeFile }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const lastActiveFileRef = useRef(null)

    // Create editor theme
    const editorTheme = useMemo(() => EditorView.theme({
        '&': {
            height: '100%',
            fontSize: '14px',
        },
        '.cm-scroller': {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            lineHeight: '1.6',
        },
        '.cm-content': {
            padding: '12px 0',
        },
        '.cm-gutters': {
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
        },
        '.cm-activeLineGutter': {
            backgroundColor: 'var(--accent-light)',
        },
        '.cm-activeLine': {
            backgroundColor: 'var(--accent-light)',
        },
        '.cm-tooltip': {
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
        },
        '.cm-tooltip-autocomplete': {
            '& > ul > li': {
                padding: '4px 8px',
            },
            '& > ul > li[aria-selected]': {
                backgroundColor: 'var(--accent-light)',
                color: 'var(--accent)',
            },
        },
    }), [])

    // Create Overleaf-like keybindings
    const createKeybindings = useCallback((onCompileHandler) => {
        return keymap.of([
            // Tab - accept completion if open, otherwise indent
            {
                key: 'Tab',
                run: (view) => {
                    // Check if autocomplete is active
                    if (completionStatus(view.state)) {
                        return acceptCompletion(view)
                    }
                    // Otherwise do normal tab (indent)
                    return indentWithTab.run ? indentWithTab.run(view) : false
                }
            },

            // Ctrl+Space - Show autocomplete
            {
                key: 'Ctrl-Space',
                run: startCompletion
            },

            // Ctrl+B - Bold
            {
                key: 'Ctrl-b',
                run: (view) => wrapSelection(view, '\\textbf{', '}')
            },

            // Ctrl+I - Italic
            {
                key: 'Ctrl-i',
                run: (view) => wrapSelection(view, '\\textit{', '}')
            },

            // Ctrl+U - Underline
            {
                key: 'Ctrl-u',
                preventDefault: true,
                run: (view) => wrapSelection(view, '\\underline{', '}')
            },

            // Ctrl+E - Emphasize  
            {
                key: 'Ctrl-e',
                run: (view) => wrapSelection(view, '\\emph{', '}')
            },

            // Ctrl+M - Math mode
            {
                key: 'Ctrl-m',
                run: (view) => wrapSelection(view, '$', '$')
            },

            // Ctrl+Shift+M - Display math
            {
                key: 'Ctrl-Shift-m',
                run: (view) => wrapSelection(view, '\\[\n', '\n\\]')
            },

            // Ctrl+S - Save and compile
            {
                key: 'Ctrl-s',
                preventDefault: true,
                run: () => {
                    if (onCompileHandler) onCompileHandler()
                    return true
                }
            },

            // Ctrl+Enter - Compile
            {
                key: 'Ctrl-Enter',
                run: () => {
                    if (onCompileHandler) onCompileHandler()
                    return true
                }
            },
        ])
    }, [])

    // Create editor when activeFile changes
    useEffect(() => {
        if (!editorRef.current) return

        // Check if file actually changed
        if (activeFile === lastActiveFileRef.current && viewRef.current) {
            return
        }
        lastActiveFileRef.current = activeFile

        // Destroy previous editor
        if (viewRef.current) {
            viewRef.current.destroy()
            viewRef.current = null
        }

        // Clear container
        editorRef.current.innerHTML = ''

        // Create new editor with current code
        const state = EditorState.create({
            doc: code || '',
            extensions: [
                basicSetup,
                createKeybindings(onCompile),
                StreamLanguage.define(stex),
                editorTheme,
                autocompletion({
                    override: [latexCompletions],
                    activateOnTyping: true,
                    maxRenderedOptions: 15,
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString())
                    }
                }),
            ],
        })

        const view = new EditorView({
            state,
            parent: editorRef.current,
        })
        viewRef.current = view
        view.focus()

    }, [activeFile, editorTheme, createKeybindings, onCompile])

    // Update editor content when code changes from outside (file loaded)
    useEffect(() => {
        if (!viewRef.current) return

        const currentContent = viewRef.current.state.doc.toString()

        // Only update if code is different from what's in editor
        if (code !== undefined && code !== null && currentContent !== code) {
            viewRef.current.dispatch({
                changes: {
                    from: 0,
                    to: currentContent.length,
                    insert: code
                }
            })
        }
    }, [code])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (viewRef.current) {
                viewRef.current.destroy()
            }
        }
    }, [])

    // Get display filename
    const displayName = activeFile ? activeFile.split('/').pop() : 'main.tex'

    return (
        <div className="editor-panel">
            <div className="editor-panel__header">
                <div className="editor-panel__tabs">
                    <button className="editor-tab editor-tab--active">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                        </svg>
                        {displayName}
                    </button>
                </div>
                <div className="editor-panel__shortcuts">
                    <span className="shortcut-hint" title="Bold">Ctrl+B</span>
                    <span className="shortcut-hint" title="Italic">Ctrl+I</span>
                    <span className="shortcut-hint" title="Save & Compile">Ctrl+S</span>
                </div>
            </div>
            <div className="editor-panel__content" ref={editorRef}></div>
        </div>
    )
}

export default Editor
