import { useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { autocompletion, startCompletion, completionStatus, acceptCompletion } from '@codemirror/autocomplete'
import { Decoration, gutter, GutterMarker } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

// Yjs Imports
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'

import './Editor.css'

// Error decorations
const errorMark = Decoration.line({
    attributes: { class: 'cm-line-error' }
})

const errorGutterMarker = new class extends GutterMarker {
    toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-error-gutter-marker'
        span.innerHTML = '●'
        span.title = 'LaTeX Error'
        return span
    }
}

const setErrors = StateEffect.define()

const errorField = StateField.define({
    create() {
        return Decoration.none
    },
    update(underlines, tr) {
        underlines = underlines.map(tr.changes)
        for (let e of tr.effects) {
            if (e.is(setErrors)) {
                underlines = e.value
            }
        }
        return underlines
    },
    provide: f => EditorView.decorations.from(f)
})

const errorGutter = gutter({
    class: 'cm-error-gutter',
    renderEmptyElements: false,
    markers: view => view.state.field(errorField)
})

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
    { label: '\\theta', type: 'constant', info: 'Greek theta' },
    { label: '\\lambda', type: 'constant', info: 'Greek lambda' },
    { label: '\\pi', type: 'constant', info: 'Greek pi' },
    { label: '\\sigma', type: 'constant', info: 'Greek sigma' },
    { label: '\\omega', type: 'constant', info: 'Greek omega' },
    { label: '\\times', type: 'constant', info: 'Multiplication' },
    { label: '\\cdot', type: 'constant', info: 'Dot product' },
    { label: '\\leq', type: 'constant', info: 'Less or equal' },
    { label: '\\geq', type: 'constant', info: 'Greater or equal' },
    { label: '\\neq', type: 'constant', info: 'Not equal' },
    { label: '\\rightarrow', type: 'constant', info: 'Right arrow' },
    { label: '\\Rightarrow', type: 'constant', info: 'Double right arrow' },

    // References
    { label: '\\label', type: 'function', info: 'Create label', apply: '\\label{}' },
    { label: '\\ref', type: 'function', info: 'Reference label', apply: '\\ref{}' },
    { label: '\\cite', type: 'function', info: 'Citation', apply: '\\cite{}' },

    // Figures and tables
    { label: '\\includegraphics', type: 'function', info: 'Include image', apply: '\\includegraphics[width=\\textwidth]{}' },
    { label: '\\caption', type: 'function', info: 'Figure/table caption', apply: '\\caption{}' },
    { label: '\\centering', type: 'keyword', info: 'Center content' },

    // Lists
    { label: '\\item', type: 'keyword', info: 'List item' },

    // Spacing
    { label: '\\newline', type: 'keyword', info: 'New line' },
    { label: '\\newpage', type: 'keyword', info: 'New page' },
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
    { label: 'equation', info: 'Numbered equation' },
    { label: 'align', info: 'Aligned equations' },
    { label: 'center', info: 'Centered content' },
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

// User colors for collaboration
const USER_COLORS = [
    '#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352',
    '#9ac2c9', '#8acb88', '#1be7ff', '#6eeb83', '#e4ff1a',
    '#e8aa14', '#ff5714', '#ea9ab2', '#7fb069', '#31afb4'
]

function Editor({
    code,
    onChange,
    onCompile,
    activeFile,
    errors = [],
    jumpToLine,
    projectId,
    userId,
    userName
}) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const onChangeRef = useRef(onChange)
    const onCompileRef = useRef(onCompile)
    const isInternalChange = useRef(false)

    const yDocRef = useRef(null)
    const providerRef = useRef(null)

    useEffect(() => {
        onChangeRef.current = onChange
        onCompileRef.current = onCompile
    }, [onChange, onCompile])

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
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
            backgroundColor: 'var(--accent-light)',
            color: 'var(--accent)',
        },
        '.cm-line-error': {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
        },
        '.cm-error-underline': {
            textDecoration: 'underline 2px var(--error)',
            textUnderlineOffset: '4px',
        },
        '.cm-error-gutter-marker': {
            color: 'var(--error)',
            fontSize: '12px',
            paddingLeft: '4px',
            display: 'block',
        },
        '.cm-ySelection': {
            opacity: 0.5
        },
        '.cm-ySelectionInfo': {
            fontSize: '0.7rem',
            padding: '2px 4px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-color)',
            border: '1px solid var(--border-color)',
            zIndex: 10
        }
    }), [])

    const keybindings = useMemo(() => keymap.of([
        {
            key: 'Tab',
            run: (view) => {
                if (completionStatus(view.state)) {
                    return acceptCompletion(view)
                }
                return indentWithTab.run ? indentWithTab.run(view) : false
            }
        },
        { key: 'Ctrl-Space', run: startCompletion },
        { key: 'Ctrl-b', run: (view) => wrapSelection(view, '\\textbf{', '}') },
        { key: 'Ctrl-i', run: (view) => wrapSelection(view, '\\textit{', '}') },
        { key: 'Ctrl-u', preventDefault: true, run: (view) => wrapSelection(view, '\\underline{', '}') },
        { key: 'Ctrl-e', run: (view) => wrapSelection(view, '\\emph{', '}') },
        { key: 'Ctrl-m', run: (view) => wrapSelection(view, '$', '$') },
        { key: 'Ctrl-Shift-m', run: (view) => wrapSelection(view, '\\[\n', '\n\\]') },
        {
            key: 'Ctrl-s',
            preventDefault: true,
            run: () => { onCompileRef.current?.(); return true }
        },
        {
            key: 'Ctrl-Enter',
            run: () => { onCompileRef.current?.(); return true }
        },
    ]), [])

    useEffect(() => {
        if (!projectId || !activeFile) {
            if (providerRef.current) {
                providerRef.current.disconnect()
                providerRef.current = null
            }
            if (yDocRef.current) {
                yDocRef.current.destroy()
                yDocRef.current = null
            }
            return
        }

        const ydoc = new Y.Doc()
        const ytext = ydoc.getText('codemirror')

        if (code && ytext.length === 0) {
            ytext.insert(0, code)
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const wsUrl = `${protocol}//${host}/ws?projectId=${projectId}&activeFile=${encodeURIComponent(activeFile)}&userId=${userId || 'anon'}`

        const provider = new WebsocketProvider(wsUrl, `${projectId}-${activeFile}`, ydoc)

        const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
        provider.awareness.setLocalStateField('user', {
            name: userName || 'Anonymous',
            color: color,
            colorLight: color + '33'
        })

        yDocRef.current = ydoc
        providerRef.current = provider

        console.log(`[Collab] Connected to ${projectId}/${activeFile}`)

        return () => {
            provider.disconnect()
            ydoc.destroy()
            yDocRef.current = null
            providerRef.current = null
        }
    }, [projectId, activeFile, userId, userName])

    useEffect(() => {
        if (!editorRef.current) return

        if (viewRef.current) {
            viewRef.current.destroy()
            viewRef.current = null
        }

        const extensions = [
            basicSetup,
            keybindings,
            StreamLanguage.define(stex),
            editorTheme,
            autocompletion({
                override: [latexCompletions],
                activateOnTyping: true,
                maxRenderedOptions: 15,
            }),
            EditorView.updateListener.of((update) => {
                if (!projectId && update.docChanged && !isInternalChange.current) {
                    onChangeRef.current?.(update.state.doc.toString())
                }
            }),
            errorField,
            errorGutter,
        ]

        if (projectId && yDocRef.current && providerRef.current) {
            const ytext = yDocRef.current.getText('codemirror')
            extensions.push(yCollab(ytext, providerRef.current.awareness))
        }

        const state = EditorState.create({
            doc: (projectId && yDocRef.current) ? yDocRef.current.getText('codemirror').toString() : (code || ''),
            extensions
        })

        const view = new EditorView({
            state,
            parent: editorRef.current,
        })
        viewRef.current = view

        return () => {
            view.destroy()
            viewRef.current = null
        }
    }, [editorTheme, keybindings, projectId, activeFile, yDocRef.current, providerRef.current])

    useEffect(() => {
        if (!viewRef.current || projectId) return

        const currentContent = viewRef.current.state.doc.toString()

        if (code !== currentContent) {
            isInternalChange.current = true
            viewRef.current.dispatch({
                changes: {
                    from: 0,
                    to: currentContent.length,
                    insert: code || ''
                }
            })
            isInternalChange.current = false
        }
    }, [code, projectId])

    useEffect(() => {
        if (!viewRef.current || !activeFile) return

        const activeErrors = errors.filter(e => e.file === activeFile || e.file === activeFile.split('/').pop())
        const deco = []

        for (const err of activeErrors) {
            if (err.line >= 1 && err.line <= viewRef.current.state.doc.lines) {
                try {
                    const line = viewRef.current.state.doc.line(err.line)
                    deco.push(errorMark.range(line.from))
                    deco.push(errorGutterMarker.range(line.from))
                } catch (e) {
                    console.error('Error applying marker:', e)
                }
            }
        }

        deco.sort((a, b) => a.from - b.from)

        viewRef.current.dispatch({
            effects: setErrors.of(Decoration.set(deco, true))
        })
    }, [errors, activeFile])

    const lastJumpRef = useRef(null)

    useEffect(() => {
        if (!viewRef.current || !jumpToLine) return

        if (lastJumpRef.current === jumpToLine.timestamp) return

        const { line, file } = jumpToLine

        if (file && file !== activeFile) return
        if (viewRef.current.state.doc.toString() !== code) return

        if (line >= 1 && line <= viewRef.current.state.doc.lines) {
            const lineInfo = viewRef.current.state.doc.line(line)

            viewRef.current.dispatch({
                selection: { anchor: lineInfo.from, head: lineInfo.from },
                scrollIntoView: true,
                userEvent: 'select'
            })
            viewRef.current.focus()
            lastJumpRef.current = jumpToLine.timestamp
        }
    }, [jumpToLine, code, activeFile])

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
