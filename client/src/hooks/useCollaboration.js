import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { auth } from '../config/firebase'

const USER_COLORS = [
    '#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352',
    '#9ac2c9', '#8acb88', '#1be7ff', '#c078b5', '#e4ff1a',
    '#e8aa14', '#ff5714', '#ea9ab2', '#7fb069', '#31afb4'
]

export function useCollaboration(projectId, userId, userName, activeFile, sid) {
    const ydocRef = useRef(new Y.Doc())
    const providerRef = useRef(null)
    const [collaborators, setCollaborators] = useState([])

    useEffect(() => {
        if (!projectId) return

        const setupProvider = async () => {
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            const wsUrl = `${protocol}//${host}/ws?projectId=${projectId}&token=${token}${sid ? `&sid=${sid}` : ''}`

            const provider = new WebsocketProvider(wsUrl, projectId, ydocRef.current)
            providerRef.current = provider

            const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

            // Initial state
            provider.awareness.setLocalStateField('user', {
                name: userName || 'Anonymous',
                color: color,
                colorLight: color + '33',
                activeFile: activeFile,
                id: userId || 'anon'
            })

            const handleAwarenessUpdate = () => {
                const states = provider.awareness.getStates()
                const collabs = []
                states.forEach((state, clientID) => {
                    if (state.user) {
                        collabs.push({
                            clientID,
                            ...state.user,
                            isSelf: clientID === provider.awareness.clientID
                        })
                    }
                })
                setCollaborators(collabs)
            }

            provider.awareness.on('change', handleAwarenessUpdate)
            handleAwarenessUpdate()
        }

        setupProvider()

        return () => {
            if (providerRef.current) {
                providerRef.current.disconnect()
                // cleanup if needed
            }
            providerRef.current = null
        }
    }, [projectId, userId, userName, sid]) // Reconnect if sid changes

    // Update active file in awareness when it changes
    useEffect(() => {
        if (providerRef.current) {
            providerRef.current.awareness.setLocalStateField('user', {
                ...providerRef.current.awareness.getLocalState().user,
                activeFile: activeFile
            })
        }
    }, [activeFile])

    return {
        yDoc: ydocRef.current,
        provider: providerRef.current,
        collaborators,
        awareness: providerRef.current?.awareness || null
    }
}
