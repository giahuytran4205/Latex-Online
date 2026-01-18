import { useEffect, useRef, useMemo, useCallback } from 'react'
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
                // Track cursor position in awareness
                if (update.selectionSet && awareness) {
                    const pos = update.state.selection.main.head
                    awareness.setLocalStateField('user', {
                        ...awareness.getLocalState()?.user,
                        cursor: pos
                    })
                }

                // Report changes if not internal
                if (update.docChanged && !isInternalChange.current) {
                    onChangeRef.current?.(update.state.doc.toString())
                }
            }),
            errorField,
            errorGutter,
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
        ]

        // Add Yjs collaboration if available
        if (yDoc && awareness && activeFile) {
            const ytext = yDoc.getText(activeFile)
            extensions.push(yCollab(ytext, awareness))
        }

        // Determine initial content
        let initialContent = code || ''
        if (yDoc && activeFile) {
            const ytext = yDoc.getText(activeFile)
            const ytextContent = ytext.toString()
            if (ytextContent.length > 0) {
                initialContent = ytextContent
            } else if (code && code.length > 0) {
                console.log('[Editor] Initializing Yjs with API content')
                ytext.insert(0, code)
                initialContent = code
            }
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

    // Handle external code updates
    useEffect(() => {
        if (!viewRef.current) return

        const currentContent = viewRef.current.state.doc.toString()

        // Only update if code is provided and significantly different
        // This handles cases where AI updates the file and we reload it from server
        if (code !== null && code !== undefined && code !== currentContent) {

            if (yDoc && activeFile) {
                // Cooperative mode: Update Y.Text directly
                // This will trigger yCollab to update the view automatically
                const ytext = yDoc.getText(activeFile)
                const yContent = ytext.toString()

                if (yContent !== code) {
                    console.log('[Editor] Syncing Yjs with new server content')
                    yDoc.transact(() => {
                        ytext.delete(0, ytext.length)
                        ytext.insert(0, code)
                    })
                }
            } else {
                // Standalone mode: Update view directly
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
        }
    }, [code, yDoc, activeFile])

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

        // Skip code match check for user jump as it might be mid-sync
        if (!isUserJump && viewRef.current.state.doc.toString() !== code) return

        if (isUserJump && cursor !== undefined) {
            // Jump by cursor index (for collaborator jump)
            const safePos = Math.min(cursor, viewRef.current.state.doc.length)
            viewRef.current.dispatch({
                selection: { anchor: safePos, head: safePos },
                scrollIntoView: true,
                userEvent: 'select'
            })
            viewRef.current.focus()
            lastJumpRef.current = jumpToLine.timestamp
        } else if (line >= 1 && line <= viewRef.current.state.doc.lines) {
            // Jump by line number
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
