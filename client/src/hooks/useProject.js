import { useState, useEffect, useCallback } from 'react'
import { getFiles, getProjectInfo } from '../services/api'

export function useProject(projectId) {
    const [projectInfo, setProjectInfo] = useState(null)
    const [files, setFiles] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [collaborators, setCollaborators] = useState([])

    const loadProject = useCallback(async () => {
        if (!projectId) return
        try {
            setIsLoading(true)
            const [info, filesData] = await Promise.all([
                getProjectInfo(projectId),
                getFiles(projectId)
            ])
            setProjectInfo(info)
            setFiles(filesData.files)
            setCollaborators(info.collaborators || [])
        } catch (err) {
            console.error('Failed to load project:', err)
            throw err
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
        collaborators,
        refreshFiles: loadProject
    }
}
