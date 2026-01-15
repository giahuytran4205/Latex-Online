import { useState, useEffect, useCallback } from 'react'
import { getFiles, getProjectInfo } from '../services/api'

export function useProject(projectId, sid) {
    const [projectInfo, setProjectInfo] = useState(null)
    const [files, setFiles] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [collaborators, setCollaborators] = useState([])

    const loadProject = useCallback(async () => {
        if (!projectId) return
        try {
            setIsLoading(true)
            const [info, filesData] = await Promise.all([
                getProjectInfo(projectId, sid),
                getFiles(projectId, sid)
            ])
            setProjectInfo(info)
            setFiles(filesData.files)
            setCollaborators(info.collaborators || [])
            setError(null)
        } catch (err) {
            console.error('Failed to load project:', err)
            setError(err)
        } finally {
            setIsLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        loadProject()
    }, [loadProject])

    return {
        projectInfo,
        setProjectInfo,
        files,
        isLoading,
        error,
        collaborators,
        refreshFiles: loadProject
    }
}
