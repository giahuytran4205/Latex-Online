import { useState, useRef, useEffect } from 'react'
import { sendAIMessage } from '../../services/api'
import { useToast } from '../Toast/Toast'
import './AIChat.css'

/**
 * AI Chat Component - Sidebar chat interface for AI assistance
 */
function AIChat({
    projectId,
    activeFile,
    compileErrors,
    onRefreshFiles,
    isOpen,
    onClose
}) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '')
    const [showApiKeyInput, setShowApiKeyInput] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const toast = useToast()

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    const handleSaveApiKey = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim())
            setShowApiKeyInput(false)
            toast.success('API key đã được lưu')
        }
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        if (!apiKey) {
            setShowApiKeyInput(true)
            toast.error('Vui lòng nhập Gemini API key')
            return
        }

        const userMessage = input.trim()
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])
        setIsLoading(true)

        try {
            const context = {
                activeFile,
                compileErrors: compileErrors?.length > 0
                    ? compileErrors.map(e => `Line ${e.line}: ${e.message}`).join('\n')
                    : null
            }

            const response = await sendAIMessage(projectId, userMessage, apiKey, context)

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.response,
                operations: response.operations
            }])

            // Refresh file tree if there were file operations
            if (response.operations?.length > 0) {
                onRefreshFiles?.()
                toast.success(`Đã thực hiện ${response.operations.length} thao tác file`)
            }

        } catch (err) {
            console.error('AI Error:', err)
            setMessages(prev => [...prev, {
                role: 'error',
                content: err.message
            }])

            if (err.message.includes('API key')) {
                setShowApiKeyInput(true)
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const formatMessage = (content) => {
        // Remove JSON operation blocks for display
        const cleanContent = content.replace(/```json\s*\{[\s\S]*?"operations"[\s\S]*?\}\s*```/g, '')

        // Convert markdown code blocks
        return cleanContent.split('```').map((part, i) => {
            if (i % 2 === 1) {
                // Code block
                const [lang, ...code] = part.split('\n')
                return (
                    <pre key={i} className="ai-code-block" data-lang={lang}>
                        <code>{code.join('\n')}</code>
                    </pre>
                )
            }
            // Regular text - convert newlines to <br>
            return <span key={i}>{part.split('\n').map((line, j) => (
                <span key={j}>{line}<br /></span>
            ))}</span>
        })
    }

    if (!isOpen) return null

    return (
        <div className="ai-chat">
            <div className="ai-chat__header">
                <div className="ai-chat__title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    AI Assistant
                </div>
                <div className="ai-chat__actions">
                    <button
                        className="ai-chat__btn"
                        onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                        title="Cài đặt API Key"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                    <button className="ai-chat__btn ai-chat__close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>

            {showApiKeyInput && (
                <div className="ai-chat__api-key">
                    <div className="ai-chat__api-key-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                        Gemini API Key
                    </div>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Nhập API key từ Google AI Studio..."
                        className="ai-chat__api-key-input"
                    />
                    <button className="ai-chat__api-key-save" onClick={handleSaveApiKey}>
                        Lưu
                    </button>
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ai-chat__api-key-link"
                    >
                        Lấy API key miễn phí →
                    </a>
                </div>
            )}

            <div className="ai-chat__messages">
                {messages.length === 0 && (
                    <div className="ai-chat__welcome">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <line x1="9" y1="9" x2="9.01" y2="9" />
                            <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                        <h3>Xin chào! Tôi có thể giúp gì?</h3>
                        <p>Tôi có thể giúp bạn:</p>
                        <ul>
                            <li>Viết và sửa code LaTeX</li>
                            <li>Tạo, sửa, xóa file</li>
                            <li>Fix lỗi compile</li>
                            <li>Giải thích code</li>
                        </ul>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`ai-chat__message ai-chat__message--${msg.role}`}>
                        {msg.role === 'user' && (
                            <div className="ai-chat__avatar ai-chat__avatar--user">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </div>
                        )}
                        {msg.role === 'assistant' && (
                            <div className="ai-chat__avatar ai-chat__avatar--ai">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42" />
                                </svg>
                            </div>
                        )}
                        <div className="ai-chat__content">
                            {msg.role === 'error' ? (
                                <div className="ai-chat__error">{msg.content}</div>
                            ) : (
                                formatMessage(msg.content)
                            )}

                            {msg.operations?.length > 0 && (
                                <div className="ai-chat__operations">
                                    <div className="ai-chat__operations-title">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                        Đã thực hiện:
                                    </div>
                                    {msg.operations.map((op, i) => (
                                        <div key={i} className={`ai-chat__operation ai-chat__operation--${op.type}`}>
                                            <span className="ai-chat__operation-type">
                                                {op.type === 'create' && '🆕'}
                                                {op.type === 'edit' && '✏️'}
                                                {op.type === 'delete' && '🗑️'}
                                            </span>
                                            <span className="ai-chat__operation-file">{op.file}</span>
                                            {op.description && (
                                                <span className="ai-chat__operation-desc">{op.description}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="ai-chat__message ai-chat__message--assistant">
                        <div className="ai-chat__avatar ai-chat__avatar--ai">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>
                        <div className="ai-chat__content">
                            <div className="ai-chat__typing">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="ai-chat__input-area">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Hỏi AI bất cứ điều gì..."
                    disabled={isLoading}
                    rows={1}
                />
                <button
                    className="ai-chat__send"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </div>
        </div>
    )
}

export default AIChat
