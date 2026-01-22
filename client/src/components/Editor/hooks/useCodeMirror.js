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
 * Custom hook for CodeMirror editor initialization and management
 * 
 * With server-side Yjs persistence, the server is the source of truth.
 * Client only needs to:
 * 1. Connect to Yjs
 * 2. Wait for sync
 * 3. If document is empty after sync, initialize with API content
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
    const initializedFilesRef = useRef(new Set())

    // Keep refs updated
    useEffect(() => {
        onChangeRef.current = onChange
        onCompileRef.current = onCompile
    }, [onChange, onCompile])

    // Memoize theme
    const editorTheme = useMemo(() => createEditorTheme(), [])

    // Memoize keybindings
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
                // Report changes if not internal
                // Note: Cursor sync is handled automatically by yCollab
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

        // Add Yjs collaboration if available
        if (yDoc && awareness && activeFile) {
            const ytext = yDoc.getText(activeFile)
            extensions.push(yCollab(ytext, awareness))
        }

        // Initial content from Yjs (server-persisted) or fallback to code
        let initialContent = ''
        if (yDoc && activeFile) {
            const ytext = yDoc.getText(activeFile)
            initialContent = ytext.toString()
        }
        if (!initialContent && code) {
            initialContent = code
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

    /**
     * Initialize Yjs document with API content if empty after sync
     * 
     * With server-side persistence:
     * - Server already has the document state
     * - We only need to initialize if it's truly empty (new file)
     */
    useEffect(() => {
        if (!yDoc || !activeFile || !isSynced || !code) return

        const ytext = yDoc.getText(activeFile)
        const fileKey = `${yDoc.clientID}-${activeFile}`

        // Skip if already initialized in this session
        if (initializedFilesRef.current.has(fileKey)) return

        // Only initialize if Yjs document is empty
        if (ytext.length === 0 && code.length > 0) {
            console.log(`[Editor] Initializing empty Yjs doc for "${activeFile}"`)
            yDoc.transact(() => {
                ytext.insert(0, code)
            })
        }

        initializedFilesRef.current.add(fileKey)
    }, [yDoc, activeFile, isSynced, code])

    // Handle standalone mode (no Yjs)
    useEffect(() => {
        if (!viewRef.current || yDoc) return

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
    }, [code, yDoc])

    // Handle error decorations
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

    // Handle jump to line
    useEffect(() => {
        if (!viewRef.current || !jumpToLine) return

        if (lastJumpRef.current === jumpToLine.timestamp) return

        const { line, file, cursor, isUserJump } = jumpToLine

        if (file && file !== activeFile) return

        if (!isUserJump && viewRef.current.state.doc.toString() !== code) return

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
    }, [jumpToLine, code, activeFile])

    return { editorRef, viewRef }
}
