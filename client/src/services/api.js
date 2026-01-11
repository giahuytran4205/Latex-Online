const API_BASE = '/api'

export async function compileLatex({ code, engine, filename }) {
    const response = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, engine, filename }),
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
}

export async function getFiles(projectId) {
    const response = await fetch(`${API_BASE}/files/${projectId}`)
    return response.json()
}

export async function saveFile(projectId, filename, content) {
    const response = await fetch(`${API_BASE}/files/${projectId}/${filename}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
    })
    return response.json()
}

export async function uploadFile(projectId, file) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE}/files/${projectId}/upload`, {
        method: 'POST',
        body: formData,
    })
    return response.json()
}
