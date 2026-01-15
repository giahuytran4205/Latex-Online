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

export async function getProjectInfo(projectId, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/projects/${projectId}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, { headers })
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

export async function renameProject(projectId, name, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/projects/${projectId}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name }),
    })
    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename project')
    }
    return response.json()
}

export async function shareProject(projectId, settings) {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/projects/${projectId}/share`, {
        method: 'POST',
        headers,
        body: JSON.stringify(settings),
    })
    if (!response.ok) throw new Error('Failed to update sharing settings')
    return response.json()
}

export async function resolveShareId(shareId) {
    const response = await fetch(`${API_BASE}/projects/resolve/${shareId}`)
    if (!response.ok) throw new Error('Invalid or expired share link')
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

export async function compileLatex({ code, engine, filename, projectId, sid }) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/compile` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId, code, engine, filename, shareId: sid }),
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

export async function resolveSyncTeX(projectId, page, x, y, sid) {
    const headers = await getAuthHeaders()
    const params = { projectId, page, x, y }
    if (sid) params.sid = sid
    const query = new URLSearchParams(params).toString()
    const response = await fetch(`${API_BASE}/compile/synctex?${query}`, { headers })
    if (!response.ok) throw new Error('SyncTeX resolution failed')
    return response.json()
}

// ============ FILE OPERATIONS ============

export async function getFiles(projectId, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error('Failed to fetch files')
    return response.json()
}

export async function getFileContent(projectId, filename, sid) {
    const isBinary = /\.(png|jpg|jpeg|gif|ico|pdf|sty|cls|zip|gz|tar|bib)$/i.test(filename)
    if (isBinary) {
        return { isBinary: true, url: await getFileUrl(projectId, filename, sid) }
    }

    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/${encodeFilename(filename)}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, { headers })
    if (!response.ok) throw new Error('Failed to fetch file content')
    return response.json()
}

export async function getFileUrl(projectId, filename, sid) {
    const user = auth.currentUser
    const token = user ? await user.getIdToken() : ''
    let url = `${API_BASE}/files/${projectId}/${encodeFilename(filename)}/download?token=${token}&mode=view`
    if (sid) url += `&sid=${sid}`
    return url
}

export async function saveFile(projectId, filename, content, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/${encodeFilename(filename)}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ content }),
    })
    if (!response.ok) throw new Error('Failed to save file')
    return response.json()
}

export async function createFile(projectId, filename, content = '', overwrite = false, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename, content, overwrite }),
    })
    if (!response.ok) throw new Error('Failed to create file')
    return response.json()
}

export async function deleteFile(projectId, filename, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/${encodeFilename(filename)}` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'DELETE',
        headers,
    })
    if (!response.ok) throw new Error('Failed to delete file')
    return response.json()
}

export async function renameFile(projectId, oldName, newName, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/rename` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ oldName, newName }),
    })
    if (!response.ok) throw new Error('Failed to rename file')
    return response.json()
}

export async function duplicateFile(projectId, filename, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/duplicate` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filename }),
    })
    if (!response.ok) throw new Error('Failed to duplicate file')
    return response.json()
}

export async function moveFile(projectId, oldPath, newPath, sid) {
    const headers = await getAuthHeaders()
    const url = `${API_BASE}/files/${projectId}/move` + (sid ? `?sid=${sid}` : '')
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ oldPath, newPath }),
    })
    if (!response.ok) throw new Error('Failed to move file')
    return response.json()
}
