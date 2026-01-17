import express from 'express'
import { verifyToken } from '../services/auth.js'
import { getProjectWithAuth } from '../utils/project.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname, extname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const router = express.Router()
const PROJECTS_DIR = join(__dirname, '../../projects')

// Available models with their characteristics (use exact API model names)
const AVAILABLE_MODELS = {
    'gemini-1.5-flash-latest': { name: 'Gemini 1.5 Flash', description: 'Nhanh, miễn phí (15 RPM)', maxTokens: 8192 },
    'gemini-1.5-pro-latest': { name: 'Gemini 1.5 Pro', description: 'Mạnh, miễn phí (2 RPM)', maxTokens: 8192 },
    'gemini-2.0-flash-exp': { name: 'Gemini 2.0 Flash', description: 'Mới nhất (thử nghiệm)', maxTokens: 8192 },
    'gemini-1.0-pro': { name: 'Gemini 1.0 Pro', description: 'Ổn định, miễn phí', maxTokens: 8192 },
}

// Tool definitions for function calling
const TOOLS = [
    {
        name: 'read_file',
        description: 'Read content of a specific file in the project',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to the file relative to project root' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'create_file',
        description: 'Create a new file with content',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path for the new file' },
                content: { type: 'string', description: 'Content of the file' },
                description: { type: 'string', description: 'Brief description of what this file does' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'edit_file',
        description: 'Replace entire content of an existing file',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to the file' },
                content: { type: 'string', description: 'New complete content for the file' },
                description: { type: 'string', description: 'Brief description of changes made' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'delete_file',
        description: 'Delete a file from the project (cannot delete main.tex)',
        parameters: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Path to the file to delete' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'list_files',
        description: 'Get list of all files in the project',
        parameters: {
            type: 'object',
            properties: {}
        }
    }
]

// Apply auth middleware
router.use(verifyToken)

/**
 * Fetch available models using User's API Key
 */
router.post('/fetch-models', async (req, res) => {
    try {
        const { apiKey } = req.body
        if (!apiKey) return res.status(400).json({ error: 'API Key is required' })

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        if (!response.ok) {
            const err = await response.json()
            return res.status(response.status).json({ error: err.error?.message || 'Failed to fetch models' })
        }

        const data = await response.json()

        // Filter for chat-capable models and format them
        const models = {}

        if (data.models) {
            data.models.forEach(m => {
                const id = m.name.replace('models/', '')

                // Only include gemini/gemma models that support generateContent
                // Filter out non-chat models like embeddings or specific robotics models if not desired
                const isChatModel = (m.name.includes('gemini') || m.name.includes('gemma')) &&
                    m.supportedGenerationMethods.includes('generateContent') &&
                    !m.name.includes('embedding') &&
                    !m.name.includes('robotics')

                if (isChatModel) {
                    let description = m.description || ''

                    // Highlight new generation models
                    if (id.includes('gemini-3')) description = `🌟 Gemini 3.0 (Newest) - ${description}`
                    else if (id.includes('gemini-2.5')) description = `🚀 Gemini 2.5 (Next Gen) - ${description}`
                    else if (id.includes('flash')) description = `⚡ Fast & Free Tier - ${description}`

                    models[id] = {
                        name: m.displayName || id,
                        description: description,
                        maxTokens: m.outputTokenLimit || 8192
                    }
                }
            })
        }

        res.json({ models })
    } catch (err) {
        console.error('[AI] Fetch models error:', err)
        res.status(500).json({ error: err.message })
    }
})

/**
 * AI Agent chat endpoint with tool calling support
 */
router.post('/chat', async (req, res) => {
    try {
        let { projectId, message, apiKey, context, model = 'gemini-1.5-flash', conversationHistory = [] } = req.body

        if (!projectId) return res.status(400).json({ error: 'Project ID is required' })
        if (!apiKey) return res.status(400).json({ error: 'Gemini API key is required' })
        if (!message) return res.status(400).json({ error: 'Message is required' })

        // We no longer strictly validate against a hardcoded list since we fetch dynamically.
        // But we ensure a default if missing.
        if (!model) model = 'gemini-1.5-flash'

        // Verify project access
        const auth = getProjectWithAuth(req.user, projectId, 'edit')
        if (auth.error) return res.status(auth.status).json({ error: auth.error })

        const { projectPath } = auth

        // Build initial context (minimal - just file list)
        const fileList = getFileList(projectPath)
        const activeFileContent = context?.activeFile ? readFileSafe(projectPath, context.activeFile) : null

        // Build system instruction
        const systemInstruction = buildSystemInstruction(fileList, context, activeFileContent)

        // Build conversation with history
        const contents = buildConversation(systemInstruction, conversationHistory, message)

        // Call Gemini API with function calling
        const response = await callGeminiWithTools(apiKey, model, contents, projectPath)

        if (response.error) {
            return res.status(400).json({ error: response.error })
        }

        res.json({
            success: true,
            response: response.message,
            operations: response.operations,
            model: model
        })

    } catch (err) {
        console.error('[AI] Error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

/**
 * Get flat file list (no content, just paths)
 */
function getFileList(projectPath, basePath = '') {
    const items = readdirSync(projectPath)
    let files = []

    for (const item of items) {
        if (item.startsWith('.')) continue
        const fullPath = join(projectPath, item)
        const relativePath = basePath ? `${basePath}/${item}` : item
        const stats = statSync(fullPath)

        if (stats.isDirectory()) {
            files = files.concat(getFileList(fullPath, relativePath))
        } else {
            files.push(relativePath)
        }
    }
    return files
}

/**
 * Safely read file content
 */
function readFileSafe(projectPath, filePath) {
    try {
        const fullPath = join(projectPath, filePath)
        if (!existsSync(fullPath)) return null
        const stats = statSync(fullPath)
        if (stats.size > 50000) return '[File too large]'
        return readFileSync(fullPath, 'utf-8')
    } catch (err) {
        return null
    }
}

/**
 * Build system instruction (concise)
 */
function buildSystemInstruction(fileList, context, activeFileContent) {
    let instruction = `Bạn là AI assistant cho LaTeX editor. Bạn có thể đọc, tạo, sửa, xóa file.

Project files: ${fileList.join(', ')}
${context?.activeFile ? `\nActive file: ${context.activeFile}` : ''}
${context?.compileErrors ? `\nCompile errors:\n${context.compileErrors}` : ''}`

    if (activeFileContent) {
        instruction += `\n\n--- ${context.activeFile} ---\n${activeFileContent}`
    }

    instruction += `\n\nSử dụng các tools để thao tác file. Luôn trả lời bằng tiếng Việt.`

    return instruction
}

/**
 * Build conversation array for API
 */
function buildConversation(systemInstruction, history, currentMessage) {
    const contents = []

    // Add system as first user message (Gemini doesn't have system role in contents)
    contents.push({
        role: 'user',
        parts: [{ text: `[System Instructions]\n${systemInstruction}\n\n[User Message]\n${history.length === 0 ? currentMessage : 'Bắt đầu conversation.'}` }]
    })

    if (history.length === 0) {
        return contents
    }

    // Add a model acknowledgment
    contents.push({
        role: 'model',
        parts: [{ text: 'Tôi hiểu. Tôi sẽ hỗ trợ bạn với dự án LaTeX.' }]
    })

    // Add conversation history
    for (const msg of history) {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        })
    }

    // Add current message
    contents.push({
        role: 'user',
        parts: [{ text: currentMessage }]
    })

    return contents
}

/**
 * Call Gemini API with function calling
 */
async function callGeminiWithTools(apiKey, model, contents, projectPath) {
    const operations = []
    let finalMessage = ''
    let iterationCount = 0
    const maxIterations = 5 // Prevent infinite loops

    // Convert tools to Gemini format
    const geminiTools = [{
        functionDeclarations: TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }))
    }]

    while (iterationCount < maxIterations) {
        iterationCount++

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        tools: geminiTools,
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 8192,
                        }
                    })
                }
            )

            if (!response.ok) {
                const error = await response.json()
                console.error('[AI] Gemini API error:', error)
                return { error: error.error?.message || 'Gemini API error' }
            }

            const data = await response.json()
            const candidate = data.candidates?.[0]

            if (!candidate?.content?.parts) {
                return { error: 'No response from AI' }
            }

            const modelParts = candidate.content.parts

            // Accumulate text response for the user interface
            for (const part of modelParts) {
                if (part.text) {
                    finalMessage += part.text
                }
            }

            // Check for function calls
            const functionCalls = modelParts.filter(part => part.functionCall)

            if (functionCalls.length > 0) {
                // IMPORTANT: Push the ENTIRE model response (including thoughts) to history
                // This satisfies the thought_signature requirement for thinking models
                contents.push({
                    role: 'model',
                    parts: modelParts
                })

                // Execute all function calls found in the response
                for (const callPart of functionCalls) {
                    const { name, args } = callPart.functionCall

                    // Execute the function
                    const result = executeFunction(name, args, projectPath, operations)

                    // Add result to conversation for next iteration
                    contents.push({
                        role: 'user', // Gemini API expects functionResponse from 'user' or 'function' role
                        parts: [{
                            functionResponse: {
                                name,
                                response: { result }
                            }
                        }]
                    })
                }
                // Loop continues to let model generate more content/calls
            } else {
                // No function calls, we are done
                break
            }

        } catch (err) {
            console.error('[AI] API call error:', err)
            return { error: err.message }
        }
    }

    return {
        message: finalMessage,
        operations
    }
}

/**
 * Execute a tool function
 */
function executeFunction(name, args, projectPath, operations) {
    try {
        switch (name) {
            case 'read_file': {
                const content = readFileSafe(projectPath, args.file_path)
                if (content === null) return { success: false, error: 'File not found' }
                return { success: true, content }
            }

            case 'list_files': {
                const files = getFileList(projectPath)
                return { success: true, files }
            }

            case 'create_file': {
                const filePath = join(projectPath, args.file_path)
                const parentDir = dirname(filePath)
                if (!existsSync(parentDir)) {
                    mkdirSync(parentDir, { recursive: true })
                }
                writeFileSync(filePath, args.content || '')
                operations.push({
                    type: 'create',
                    file: args.file_path,
                    description: args.description || 'Created new file',
                    success: true
                })
                return { success: true, message: `Created ${args.file_path}` }
            }

            case 'edit_file': {
                const filePath = join(projectPath, args.file_path)
                if (!existsSync(filePath)) {
                    return { success: false, error: 'File not found' }
                }
                writeFileSync(filePath, args.content || '')
                operations.push({
                    type: 'edit',
                    file: args.file_path,
                    description: args.description || 'Modified file',
                    success: true
                })
                return { success: true, message: `Updated ${args.file_path}` }
            }

            case 'delete_file': {
                if (args.file_path === 'main.tex') {
                    return { success: false, error: 'Cannot delete main.tex' }
                }
                const filePath = join(projectPath, args.file_path)
                if (existsSync(filePath)) {
                    unlinkSync(filePath)
                    operations.push({
                        type: 'delete',
                        file: args.file_path,
                        description: 'Deleted file',
                        success: true
                    })
                    return { success: true, message: `Deleted ${args.file_path}` }
                }
                return { success: false, error: 'File not found' }
            }

            default:
                return { success: false, error: `Unknown function: ${name}` }
        }
    } catch (err) {
        return { success: false, error: err.message }
    }
}

export default router
