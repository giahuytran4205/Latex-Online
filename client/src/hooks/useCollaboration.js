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
    const [isSynced, setIsSynced] = useState(false)

    // Stable user color to persist across re-renders
    const userColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)])

    // 1. Connection Effect - Only re-runs if Project ID or Share ID changes
    useEffect(() => {
        if (!projectId) return

        const setupProvider = async () => {
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            const wsUrl = `${protocol}//${host}/ws`

            const params = { token: token || '', projectId }
            if (sid) params.sid = sid

            const provider = new WebsocketProvider(wsUrl, projectId, ydocRef.current, { params })
            providerRef.current = provider

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

            provider.on('sync', (isSynced) => {
                setIsSynced(isSynced)
            })
        }

        setupProvider()

        const cleanup = () => {
            if (providerRef.current) {
                // IMPORTANT: Explicitly set local state to null to notify others we are leaving immediately
                providerRef.current.awareness.setLocalState(null)
                providerRef.current.disconnect()
                providerRef.current.destroy()
            }
            providerRef.current = null
        }

        window.addEventListener('beforeunload', cleanup)

        return () => {
            window.removeEventListener('beforeunload', cleanup)
            cleanup()
        }
    }, [projectId, sid])

    // 2. User State Effect - Updates awareness when user info or file changes
    useEffect(() => {
        const provider = providerRef.current
        if (!provider || !provider.awareness) return

        const userState = {
            name: userName || 'Anonymous',
            color: userColorRef.current,
            colorLight: userColorRef.current + '33',
            activeFile: activeFile,
            id: userId || 'anon',
            fileSystemUpdate: Date.now()
        }

        // Broacast user state immediately
        provider.awareness.setLocalStateField('user', userState)

    }, [userId, userName, activeFile, isSynced])

    return {
        yDoc: ydocRef.current,
        provider: providerRef.current,
        collaborators,
        awareness: providerRef.current?.awareness || null,
        isSynced
    }
}
