import { useEffect, useRef, useState, useMemo } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { autocompletion, CompletionContext } from '@codemirror/autocomplete'
import './Editor.css'

// LaTeX autocomplete data
const latexCommands = [
    // Document structure
    { label: '\\documentclass', type: 'keyword', info: 'Define document class', apply: '\\documentclass{article}' },
    { label: '\\usepackage', type: 'keyword', info: 'Import package', apply: '\\usepackage{}' },
    { label: '\\begin', type: 'keyword', info: 'Begin environment', apply: '\\begin{}' },
    { label: '\\end', type: 'keyword', info: 'End environment', apply: '\\end{}' },
    { label: '\\title', type: 'keyword', info: 'Document title' },
    { label: '\\author', type: 'keyword', info: 'Document author' },
    { label: '\\date', type: 'keyword', info: 'Document date' },
    { label: '\\maketitle', type: 'keyword', info: 'Render title' },

    // Sections
    { label: '\\section', type: 'function', info: 'Section heading', apply: '\\section{}' },
    { label: '\\subsection', type: 'function', info: 'Subsection heading', apply: '\\subsection{}' },
    { label: '\\subsubsection', type: 'function', info: 'Subsubsection', apply: '\\subsubsection{}' },
    { label: '\\paragraph', type: 'function', info: 'Paragraph heading' },
    { label: '\\chapter', type: 'function', info: 'Chapter heading' },

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
    { label: '\\bibliography', type: 'function', info: 'Bibliography file' },
    { label: '\\bibliographystyle', type: 'function', info: 'Bibliography style' },

    // Figures and tables
    { label: '\\includegraphics', type: 'function', info: 'Include image', apply: '\\includegraphics[width=\\textwidth]{}' },
    { label: '\\caption', type: 'function', info: 'Figure/table caption', apply: '\\caption{}' },
    { label: '\\centering', type: 'keyword', info: 'Center content' },

    // Lists
    { label: '\\item', type: 'keyword', info: 'List item' },

    // Spacing
    { label: '\\newline', type: 'keyword', info: 'New line' },
    { label: '\\newpage', type: 'keyword', info: 'New page' },
    { label: '\\vspace', type: 'function', info: 'Vertical space' },
    { label: '\\hspace', type: 'function', info: 'Horizontal space' },
    { label: '\\noindent', type: 'keyword', info: 'No indentation' },

    // Special characters
    { label: '\\&', type: 'constant', info: 'Ampersand' },
    { label: '\\%', type: 'constant', info: 'Percent sign' },
    { label: '\\$', type: 'constant', info: 'Dollar sign' },
    { label: '\\#', type: 'constant', info: 'Hash sign' },
    { label: '\\_', type: 'constant', info: 'Underscore' },
    { label: '\\{', type: 'constant', info: 'Left brace' },
    { label: '\\}', type: 'constant', info: 'Right brace' },
    { label: '\\\\', type: 'constant', info: 'Line break' },

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
    { label: 'gather', info: 'Gathered equations' },
    { label: 'abstract', info: 'Abstract text' },
    { label: 'quote', info: 'Block quote' },
    { label: 'verbatim', info: 'Verbatim text' },
    { label: 'center', info: 'Centered content' },
    { label: 'flushleft', info: 'Left-aligned' },
    { label: 'flushright', info: 'Right-aligned' },
    { label: 'minipage', info: 'Mini page' },
    { label: 'array', info: 'Math array' },
    { label: 'matrix', info: 'Matrix' },
    { label: 'pmatrix', info: 'Parentheses matrix' },
    { label: 'bmatrix', info: 'Bracket matrix' },
    { label: 'cases', info: 'Cases/piecewise' },
    { label: 'proof', info: 'Proof environment' },
    { label: 'theorem', info: 'Theorem' },
    { label: 'lemma', info: 'Lemma' },
    { label: 'definition', info: 'Definition' },
]

// LaTeX autocomplete function
function latexCompletions(context) {
    const word = context.matchBefore(/\\[\w]*/)
    const envMatch = context.matchBefore(/\\begin\{[\w]*/)
    const endEnvMatch = context.matchBefore(/\\end\{[\w]*/)

    if (envMatch) {
        const prefix = envMatch.text.replace('\\begin{', '')
        return {
            from: envMatch.from + 7, // After \begin{
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

function Editor({ code, onChange, onCollaboratorsChange, activeFile }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const [connected, setConnected] = useState(true)
    const isUpdatingRef = useRef(false)

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
        '.cm-completionIcon': {
            marginRight: '8px',
        },
        '.cm-completionLabel': {
            fontFamily: "'JetBrains Mono', monospace",
        },
        '.cm-completionInfo': {
            padding: '8px',
            fontFamily: 'inherit',
            fontSize: '12px',
        },
    }), [])

    // Initialize editor
    useEffect(() => {
        if (!editorRef.current) return

        const state = EditorState.create({
            doc: code || '',
            extensions: [
                basicSetup,
                keymap.of([indentWithTab]),
                StreamLanguage.define(stex),
                editorTheme,
                autocompletion({
                    override: [latexCompletions],
                    activateOnTyping: true,
                    maxRenderedOptions: 20,
                }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged && !isUpdatingRef.current) {
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

        return () => {
            view.destroy()
        }
    }, []) // Only run once on mount

    // Update editor content when code prop changes (file switch)
    useEffect(() => {
        if (viewRef.current && code !== undefined) {
            const currentContent = viewRef.current.state.doc.toString()
            if (currentContent !== code) {
                isUpdatingRef.current = true
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentContent.length,
                        insert: code || ''
                    }
                })
                isUpdatingRef.current = false
            }
        }
    }, [code]) // Re-run when code changes

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
                <div className="editor-panel__status">
                    <span className="text-muted" style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                        Ctrl+Space for suggestions
                    </span>
                </div>
            </div>
            <div className="editor-panel__content" ref={editorRef}></div>
        </div>
    )
}

export default Editor
