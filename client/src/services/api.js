import { auth } from '../config/firebase'

const API_BASE = '/api'

// Helper to get auth token
const getAuthHeaders = async () => {
    const user = auth.currentUser
    if (user) {
        const token = await user.getIdToken()
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    }
    return { 'Content-Type': 'application/json' }
}

// Helper to encode filename for URL (handles nested paths)
const encodeFilename = (filename) => encodeURIComponent(filename)

// ============ PROJECT MANAGEMENT ============

export async function getProjects() {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects`, { headers })
    if (!response.ok) throw new Error('Failed to fetch projects')
    return response.json()
}

export async function getProjectInfo(projectId) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects/${projectId}`, { headers })
    if (!response.ok) throw new Error('Failed to fetch project info')
    return response.json()
}

export async function createProject(name, template = 'blank') {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, template }),
    })
    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create project')
    }
    return response.json()
}

export async function deleteProject(projectId) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'DELETE',
        headers,
    })
    if (!response.ok) throw new Error('Failed to delete project')
    return response.json()
}

export async function duplicateProject(projectId) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects/${projectId}/duplicate`, {
        method: 'POST',
        headers,
    })
    if (!response.ok) throw new Error('Failed to duplicate project')
    return response.json()
}

export async function shareProject(projectId, email, permission = 'view') {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects/${projectId}/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, permission }),
    })
    if (!response.ok) throw new Error('Failed to share project')
    return response.json()
}

export async function getUserStorageInfo() {
    const headers = await getAuthHeaders()
    // Use projects router which has proper auth middleware
    const response = await fetch(`${API_BASE}/projects/storage`, { headers })
    if (!response.ok) {
        // Return default if endpoint not available
        return { used: 0, limit: 100 * 1024 * 1024 }
    }
    return response.json()
}

// ============ COMPILATION ============

export async function compileLatex({ code, engine, filename, projectId }) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, code, engine, filename }),
    })
    const data = await response.json().catch(() => ({ success: false }))

    if (!response.ok && !data.logs) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }

    return {
        ...data,
        pdfUrl: data.pdf
    }
}

// ============ FILE OPERATIONS ============

export async function getFiles(projectId) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}`, { headers })
    if (!response.ok) throw new Error('Failed to fetch files')
    return response.json()
}

export async function getFileContent(projectId, filename) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/${encodeFilename(filename)}`, { headers })
    if (!response.ok) throw new Error('Failed to fetch file content')
    return response.json()
}

export async function saveFile(projectId, filename, content) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/${encodeFilename(filename)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ content }),
    })
    if (!response.ok) throw new Error('Failed to save file')
    return response.json()
}

export async function createFile(projectId, filename, content = '', overwrite = false) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename, content, overwrite }),
    })
    if (!response.ok) throw new Error('Failed to create file')
    return response.json()
}

export async function deleteFile(projectId, filename) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/${encodeFilename(filename)}`, {
        method: 'DELETE',
        headers,
    })
    if (!response.ok) throw new Error('Failed to delete file')
    return response.json()
}

export async function renameFile(projectId, oldName, newName) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/rename`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ oldName, newName }),
    })
    if (!response.ok) throw new Error('Failed to rename file')
    return response.json()
}

export async function duplicateFile(projectId, filename) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/duplicate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename }),
    })
    if (!response.ok) throw new Error('Failed to duplicate file')
    return response.json()
}

export async function moveFile(projectId, oldPath, newPath) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/files/${projectId}/move`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ oldPath, newPath }),
    })
    if (!response.ok) throw new Error('Failed to move file')
    return response.json()
}
