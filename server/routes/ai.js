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

// Apply auth middleware
router.use(verifyToken)

/**
 * AI Agent endpoint - processes user requests and performs file operations
 */
router.post('/chat', async (req, res) => {
    try {
        const { projectId, message, apiKey, context } = req.body

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' })
        }

        if (!apiKey) {
            return res.status(400).json({ error: 'Gemini API key is required' })
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' })
        }

        // Verify project access
        const auth = getProjectWithAuth(req.user, projectId, 'edit')
        if (auth.error) {
            return res.status(auth.status).json({ error: auth.error })
        }

        const { projectPath } = auth

        // Get project file structure
        const files = getProjectFiles(projectPath)

        // Build system prompt with project context
        const systemPrompt = buildSystemPrompt(files, context)

        // Call Gemini API
        const response = await callGeminiAPI(apiKey, systemPrompt, message)

        if (response.error) {
            return res.status(400).json({ error: response.error })
        }

        // Parse and execute file operations from AI response
        const result = await executeOperations(projectPath, response.operations || [])

        res.json({
            success: true,
            response: response.message,
            operations: result.operations,
            errors: result.errors
        })

    } catch (err) {
        console.error('[AI] Error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

/**
 * Get all files in project for context
 */
function getProjectFiles(projectPath, basePath = '') {
    const items = readdirSync(projectPath)
    let files = []

    for (const item of items) {
        if (item.startsWith('.')) continue

        const fullPath = join(projectPath, item)
        const relativePath = basePath ? `${basePath}/${item}` : item
        const stats = statSync(fullPath)

        if (stats.isDirectory()) {
            files.push({ name: relativePath + '/', type: 'folder' })
            files = files.concat(getProjectFiles(fullPath, relativePath))
        } else {
            const ext = extname(item).toLowerCase()
            const isText = ['.tex', '.txt', '.bib', '.cls', '.sty', '.md', '.json', '.js', '.css', '.html'].includes(ext)

            files.push({
                name: relativePath,
                type: ext.substring(1) || 'txt',
                size: stats.size,
                content: isText && stats.size < 50000 ? readFileSync(fullPath, 'utf-8') : null
            })
        }
    }

    return files
}

/**
 * Build system prompt for AI
 */
function buildSystemPrompt(files, context) {
    const fileList = files.map(f => {
        if (f.type === 'folder') return `📁 ${f.name}`
        return `📄 ${f.name} (${f.size} bytes)`
    }).join('\n')

    const fileContents = files
        .filter(f => f.content)
        .map(f => `\n--- ${f.name} ---\n${f.content}`)
        .join('\n')

    return `Bạn là một AI assistant chuyên về LaTeX và hỗ trợ người dùng viết tài liệu khoa học.

## Cấu trúc project hiện tại:
${fileList}

## Nội dung các file:
${fileContents}

${context?.activeFile ? `\n## File đang mở: ${context.activeFile}` : ''}
${context?.selectedCode ? `\n## Code được chọn:\n${context.selectedCode}` : ''}
${context?.compileErrors ? `\n## Lỗi compile gần nhất:\n${context.compileErrors}` : ''}

## Bạn có thể thực hiện các thao tác sau:

Để thực hiện thao tác file, hãy bao gồm JSON block trong response với format:
\`\`\`json
{
  "operations": [
    {
      "type": "create" | "edit" | "delete",
      "file": "path/to/file.tex",
      "content": "nội dung file (cho create/edit)",
      "description": "mô tả ngắn về thay đổi"
    }
  ]
}
\`\`\`

### Lưu ý:
- Với "edit": content là nội dung MỚI HOÀN CHỈNH của file
- Với "create": tạo file mới với content
- Với "delete": chỉ cần file path, không cần content
- Luôn giải thích những gì bạn đang làm
- Không xoá file main.tex
- Đảm bảo code LaTeX hợp lệ

Hãy trả lời bằng tiếng Việt khi người dùng hỏi bằng tiếng Việt.`
}

/**
 * Call Gemini API
 */
async function callGeminiAPI(apiKey, systemPrompt, userMessage) {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: systemPrompt + '\n\n---\n\nNgười dùng: ' + userMessage }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    ]
                })
            }
        )

        if (!response.ok) {
            const error = await response.json()
            console.error('[AI] Gemini API error:', error)
            return { error: error.error?.message || 'Gemini API error' }
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Extract operations from JSON block
        const operations = extractOperations(text)

        return {
            message: text,
            operations
        }

    } catch (err) {
        console.error('[AI] API call error:', err)
        return { error: err.message }
    }
}

/**
 * Extract operations from AI response
 */
function extractOperations(text) {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (!jsonMatch) return []

    try {
        const parsed = JSON.parse(jsonMatch[1])
        return parsed.operations || []
    } catch (err) {
        console.error('[AI] Failed to parse operations:', err)
        return []
    }
}

/**
 * Execute file operations
 */
async function executeOperations(projectPath, operations) {
    const results = { operations: [], errors: [] }

    for (const op of operations) {
        try {
            const filePath = join(projectPath, op.file)

            switch (op.type) {
                case 'create':
                case 'edit':
                    // Ensure parent directory exists
                    const parentDir = dirname(filePath)
                    if (!existsSync(parentDir)) {
                        mkdirSync(parentDir, { recursive: true })
                    }
                    writeFileSync(filePath, op.content || '')
                    results.operations.push({
                        type: op.type,
                        file: op.file,
                        description: op.description,
                        success: true
                    })
                    break

                case 'delete':
                    // Prevent deleting main.tex
                    if (op.file === 'main.tex') {
                        results.errors.push({
                            file: op.file,
                            error: 'Cannot delete main.tex'
                        })
                        continue
                    }
                    if (existsSync(filePath)) {
                        unlinkSync(filePath)
                        results.operations.push({
                            type: 'delete',
                            file: op.file,
                            description: op.description,
                            success: true
                        })
                    }
                    break

                default:
                    results.errors.push({
                        file: op.file,
                        error: `Unknown operation type: ${op.type}`
                    })
            }
        } catch (err) {
            results.errors.push({
                file: op.file,
                error: err.message
            })
        }
    }

    return results
}

export default router
