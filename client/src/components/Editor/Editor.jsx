import { useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { stex } from '@codemirror/legacy-modes/mode/stex'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import './Editor.css'

// Random color for user
const userColors = [
    '#f87171', '#fb923c', '#fbbf24', '#a3e635',
    '#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa',
    '#a78bfa', '#f472b6', '#fb7185'
]

const randomColor = () => userColors[Math.floor(Math.random() * userColors.length)]

// Random name for demo
const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']
const randomName = () => names[Math.floor(Math.random() * names.length)]

function Editor({ code, onChange, onCollaboratorsChange }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    const ydocRef = useRef(null)
    const providerRef = useRef(null)
    const [connected, setConnected] = useState(false)

    useEffect(() => {
        if (!editorRef.current) return

        // Initialize Yjs
        const ydoc = new Y.Doc()
        ydocRef.current = ydoc
        const ytext = ydoc.getText('codemirror')

        // Set initial content if ytext is empty
        if (ytext.length === 0 && code) {
            ytext.insert(0, code)
        }

        // WebSocket provider for collaboration
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
        const provider = new WebsocketProvider(wsUrl, 'latex-room', ydoc)
        providerRef.current = provider

        // User awareness
        const userColor = randomColor()
        const userName = randomName()
        provider.awareness.setLocalStateField('user', {
            name: userName,
            color: userColor,
        })

        provider.on('status', ({ status }) => {
            setConnected(status === 'connected')
        })

        // Track collaborators
        const updateCollaborators = () => {
            const states = provider.awareness.getStates()
            const users = []
            states.forEach((state, clientId) => {
                if (state.user && clientId !== ydoc.clientID) {
                    users.push(state.user)
                }
            })
            onCollaboratorsChange(users)
        }

        provider.awareness.on('change', updateCollaborators)

        // Create editor theme
        const editorTheme = EditorView.theme({
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
        })

        // Create editor state
        const state = EditorState.create({
            doc: ytext.toString(),
            extensions: [
                basicSetup,
                keymap.of([indentWithTab]),
                StreamLanguage.define(stex),
                editorTheme,
                yCollab(ytext, provider.awareness),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString())
                    }
                }),
            ],
        })

        // Create view
        const view = new EditorView({
            state,
            parent: editorRef.current,
        })
        viewRef.current = view

        return () => {
            view.destroy()
            provider.disconnect()
            ydoc.destroy()
        }
    }, [])

    return (
        <div className="editor-panel">
            <div className="editor-panel__header">
                <div className="editor-panel__tabs">
                    <button className="editor-tab editor-tab--active">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                        </svg>
                        main.tex
                    </button>
                </div>
                <div className="editor-panel__status">
                    <span className={`status-dot ${connected ? '' : 'status-dot--offline'}`}></span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {connected ? 'Connected' : 'Connecting...'}
                    </span>
                </div>
            </div>
            <div className="editor-panel__content" ref={editorRef}></div>
        </div>
    )
}

export default Editor
