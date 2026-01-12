const API_BASE = '/api'
const DEFAULT_PROJECT = 'default-project'

export async function compileLatex({ code, engine, filename }) {
    const response = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, engine, filename }),
    })
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return response.json()
}

export async function getFiles(projectId = DEFAULT_PROJECT) {
    const response = await fetch(`${API_BASE}/files/${projectId}`)
    if (!response.ok) throw new Error('Failed to fetch files')
    return response.json()
}

export async function getFileContent(projectId = DEFAULT_PROJECT, filename) {
    const response = await fetch(`${API_BASE}/files/${projectId}/${filename}`)
    if (!response.ok) throw new Error('Failed to fetch file content')
    return response.json()
}

export async function saveFile(projectId = DEFAULT_PROJECT, filename, content) {
    const response = await fetch(`${API_BASE}/files/${projectId}/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    })
    if (!response.ok) throw new Error('Failed to save file')
    return response.json()
}

export async function createFile(projectId = DEFAULT_PROJECT, filename, content = '') {
    const response = await fetch(`${API_BASE}/files/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
    })
    if (!response.ok) throw new Error('Failed to create file')
    return response.json()
}

export async function deleteFile(projectId = DEFAULT_PROJECT, filename) {
    const response = await fetch(`${API_BASE}/files/${projectId}/${filename}`, {
        method: 'DELETE',
    })
    if (!response.ok) throw new Error('Failed to delete file')
    return response.json()
}

export async function renameFile(projectId = DEFAULT_PROJECT, oldName, newName) {
    const response = await fetch(`${API_BASE}/files/${projectId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName }),
    })
    if (!response.ok) throw new Error('Failed to rename file')
    return response.json()
}
