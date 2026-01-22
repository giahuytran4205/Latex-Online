import { useEffect, useRef, useMemo } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import { autocompletion } from '@codemirror/autocomplete'
import { Decoration } from '@codemirror/view'
import { yCollab } from 'y-codemirror.next'

// Config imports
import { latexCompletions } from '../config/latexCommands'
import { latexHighlightStyle, createEditorTheme } from '../config/theme'
import { createKeybindings } from '../config/keybindings'

// Utils imports
import { errorField, errorGutter, setErrors, errorMark, errorGutterMarker } from '../utils/errorDecorations'

/**
 * Professional Overleaf-style Editor Hook
 * 
 * Logic:
 * 1. Server is the Single Source of Truth.
 * 2. On connection, Server sends the full document state.
 * 3. Client purely renders what Yjs provides.
 * 4. Client NEVER initializes content from API code (prevents race conditions/duplication).
 */
export function useCodeMirror({
    code,
    onChange,
    onCompile,
    activeFile,
    errors = [],
    jumpToLine,
    yDoc,
    awareness,
    isSynced,
    readOnly = false
}) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const onChangeRef = useRef(onChange)
    const onCompileRef = useRef(onCompile)
    const isInternalChange = useRef(false)
    const lastJumpRef = useRef(null)

    // Keep refs updated
    useEffect(() => {
        onChangeRef.current = onChange
        onCompileRef.current = onCompile
    }, [onChange, onCompile])

    // Memoize theme
    const editorTheme = useMemo(() => createEditorTheme(), [])
    const keybindings = useMemo(() => createKeybindings(onCompileRef), [])

    // Initialize CodeMirror
    useEffect(() => {
        if (!editorRef.current) return

        const extensions = [
            basicSetup,
            syntaxHighlighting(latexHighlightStyle),
            keybindings,
            StreamLanguage.define(stex),
            editorTheme,
            autocompletion({ override: [latexCompletions], activateOnTyping: true, maxRenderedOptions: 15 }),
            EditorView.updateListener.of((update) => {
                if (update.selectionSet && awareness) {
                    const pos = update.state.selection.main.head
                    const currentLocalState = awareness.getLocalState()
                    if (currentLocalState?.user) {
                        awareness.setLocalStateField('user', {
                            ...currentLocalState.user,
                            cursor: pos
                        })
                    }
                }
                if (update.docChanged && !isInternalChange.current) {
                    onChangeRef.current?.(update.state.doc.toString())
                }
            }),
            errorField,
            errorGutter,
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
            EditorView.lineWrapping,
        ]

        // Collaboration Setup (The Core Logic)
        let initialContent = ''

        if (yDoc && awareness && activeFile) {
            const ytext = yDoc.getText(activeFile)

            // 1. Connect yCollab (handles all syncing and cursors)
            extensions.push(yCollab(ytext, awareness, { undoManager: false }))

            // 2. Initial content is purely from Yjs
            // Even if empty initially, yCollab will insert content when sync arrives
            initialContent = ytext.toString()
        } else {
            // Fallback for non-collaborative / disconnected mode
            initialContent = code || ''
        }

        const view = new EditorView({
            state: EditorState.create({
                doc: initialContent,
                extensions
            }),
            parent: editorRef.current,
        })

        viewRef.current = view

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy()
            }
            viewRef.current = null
        }
    }, [yDoc, awareness, activeFile, readOnly, editorTheme, keybindings])

    // Handle standalone mode updates (when Yjs is NOT active Only)
    useEffect(() => {
        // If Yjs is active, we IGNORE 'code' prop updates to avoid conflicts
        // Server is the truth, not the API response
        if (yDoc && awareness) return
        if (!viewRef.current) return

        const currentContent = viewRef.current.state.doc.toString()
        if (code !== null && code !== undefined && code !== currentContent) {
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
    }, [code, yDoc, awareness])

    // Error and Jump functionality handled as normal
    useEffect(() => {
        if (!viewRef.current || !activeFile) return
        // ... (Error handling logic unchanged)
        const activeErrors = errors.filter(e => e.file === activeFile || e.file === activeFile.split('/').pop())
        const deco = []
        for (const err of activeErrors) {
            if (err.line >= 1 && err.line <= viewRef.current.state.doc.lines) {
                try {
                    const line = viewRef.current.state.doc.line(err.line)
                    deco.push(errorMark.range(line.from))
                    deco.push(errorGutterMarker.range(line.from))
                } catch (e) { }
            }
        }
        deco.sort((a, b) => a.from - b.from)
        viewRef.current.dispatch({ effects: setErrors.of(Decoration.set(deco, true)) })
    }, [errors, activeFile])

    useEffect(() => {
        if (!viewRef.current || !jumpToLine) return
        if (lastJumpRef.current === jumpToLine.timestamp) return
        const { line, file, cursor, isUserJump } = jumpToLine
        if (file && file !== activeFile) return

        // Relaxed check for collab mode
        if (!isUserJump && !yDoc && viewRef.current.state.doc.toString() !== code) return

        if (isUserJump && cursor !== undefined) {
            const safePos = Math.min(cursor, viewRef.current.state.doc.length)
            viewRef.current.dispatch({
                selection: { anchor: safePos, head: safePos },
                scrollIntoView: true,
                userEvent: 'select'
            })
            viewRef.current.focus()
            lastJumpRef.current = jumpToLine.timestamp
        } else if (line >= 1 && line <= viewRef.current.state.doc.lines) {
            const lineInfo = viewRef.current.state.doc.line(line)
            viewRef.current.dispatch({
                selection: { anchor: lineInfo.from, head: lineInfo.from },
                scrollIntoView: true,
                userEvent: 'select'
            })
            viewRef.current.focus()
            lastJumpRef.current = jumpToLine.timestamp
        }
    }, [jumpToLine, code, activeFile, yDoc])

    return { editorRef, viewRef }
}
