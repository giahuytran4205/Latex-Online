import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sendAIMessage, fetchAIModels } from '../../services/api'
import { useToast } from '../Toast/Toast'
import './AIChat.css'

// Default models if API fails (use exact API model names)
const DEFAULT_MODELS = {
    'gemini-1.5-flash-latest': { name: 'Gemini 1.5 Flash', description: 'Nhanh, miễn phí (15 RPM)' },
    'gemini-1.5-pro-latest': { name: 'Gemini 1.5 Pro', description: 'Mạnh, miễn phí (2 RPM)' },
    'gemini-2.0-flash-exp': { name: 'Gemini 2.0 Flash', description: 'Mới nhất (thử nghiệm)' },
}

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
    const [conversationHistory, setConversationHistory] = useState([])
    const [input, setInput] = useState('')
    const [images, setImages] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '')
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini_model') || 'gemini-1.5-flash-latest')
    const [availableModels, setAvailableModels] = useState(DEFAULT_MODELS)
    const [showSettings, setShowSettings] = useState(false)
    const [showModelMenu, setShowModelMenu] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)
    const toast = useToast()

    // Load available models whenever API key is available
    useEffect(() => {
        if (apiKey) {
            fetchAIModels(apiKey).then(data => {
                if (data.models && Object.keys(data.models).length > 0) {
                    setAvailableModels(data.models)

                    // If current selected model is not in new list, select first available
                    if (!data.models[selectedModel]) {
                        const firstModel = Object.keys(data.models)[0]
                        if (firstModel) setSelectedModel(firstModel)
                    }
                }
            }).catch(() => {
                // Keep default models on error
            })
        }
    }, [apiKey])

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

    // Auto-save model preference
    useEffect(() => {
        localStorage.setItem('gemini_model', selectedModel)
    }, [selectedModel])

    const handleSaveSettings = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim())
            setShowSettings(false)

            // Trigger fetch models immediately
            fetchAIModels(apiKey.trim()).then(data => {
                if (data.models && Object.keys(data.models).length > 0) {
                    setAvailableModels(data.models)
                }
            })
            // toast.success('Đã lưu API Key') -- Removed as requested
        }
    }

    const handleClearConversation = () => {
        setMessages([])
        setConversationHistory([])
        toast.success('Đã xóa lịch sử chat')
    }

    const handlePaste = (e) => {
        const items = e.clipboardData.items
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault()
                const blob = item.getAsFile()
                const reader = new FileReader()
                reader.onload = (event) => {
                    setImages(prev => [...prev, {
                        mimeType: item.type,
                        data: event.target.result
                    }])
                }
                reader.readAsDataURL(blob)
            }
        }
    }

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSend = async () => {
        if ((!input.trim() && images.length === 0) || isLoading) return

        if (!apiKey) {
            setShowSettings(true)
            toast.error('Vui lòng nhập Gemini API key')
            return
        }

        const userMessage = input.trim()
        const currentImages = [...images]
        setInput('')
        setImages([])

        // Add user message to display
        setMessages(prev => [...prev, { role: 'user', content: userMessage, images: currentImages }])
        setIsLoading(true)

        try {
            const context = {
                activeFile,
                compileErrors: compileErrors?.length > 0
                    ? compileErrors.map(e => `Line ${e.line}: ${e.message}`).join('\n')
                    : null
            }

            const response = await sendAIMessage(
                projectId,
                userMessage,
                apiKey,
                context,
                selectedModel,
                conversationHistory,
                currentImages
            )

            // Update conversation history for next request
            setConversationHistory(prev => [
                ...prev,
                { role: 'user', content: userMessage }, // Note: history currently just stores text, see notes
                { role: 'assistant', content: response.response }
            ])

            // Add AI response to display
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.response,
                operations: response.operations,
                model: response.model
            }])

            // Refresh file tree if there were file operations
            if (response.operations?.length > 0) {
                onRefreshFiles?.(response.operations)
                toast.success(`Đã thực hiện ${response.operations.length} thao tác file`)
            }

        } catch (err) {
            console.error('AI Error:', err)

            let friendlyMessage = 'Đã có lỗi xảy ra khi xử lý yêu cầu của bạn.'

            if (err.message.includes('API key')) {
                friendlyMessage = 'API Key không hợp lệ hoặc bị thiếu. Vui lòng kiểm tra cài đặt.'
            } else if (err.message.includes('quota')) {
                friendlyMessage = 'Bạn đã hết quota miễn phí của model này. Vui lòng thử model khác (ưu tiên Flash).'
            } else if (err.message.includes('thought_signature')) {
                friendlyMessage = 'Model này đang gặp sự cố tương thích. Vui lòng chọn model khác.'
            }

            setMessages(prev => [...prev, {
                role: 'error',
                content: friendlyMessage,
                debug: err.message
            }])

            if (err.message.includes('API key') || err.message.includes('quota')) {
                setShowSettings(true)
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
                        onClick={handleClearConversation}
                        title="Xóa lịch sử chat"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                    <button
                        className="ai-chat__btn"
                        onClick={() => setShowSettings(!showSettings)}
                        title="Cài đặt"
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

            {showSettings && (
                <div className="ai-chat__settings">
                    <div className="ai-chat__setting-header">
                        <h3>Cấu hình Gemini API</h3>
                        <div className="ai-chat__setting-subtitle">Nhập API Key để kích hoạt AI Assistant</div>
                    </div>

                    <div className="ai-chat__setting-group">
                        <div className="ai-chat__input-wrapper">
                            <div className="ai-chat__input-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                </svg>
                            </div>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Dán API Key vào đây..."
                                spellCheck="false"
                            />
                        </div>
                    </div>

                    <div className="ai-chat__setting-actions">
                        <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ai-chat__link"
                        >
                            <span>Lấy API Key (Free)</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </a>
                        <button className="ai-chat__btn-primary" onClick={handleSaveSettings}>
                            Lưu cấu hình
                        </button>
                    </div>
                </div>
            )}

            <div className="ai-chat__messages">
                {messages.length === 0 && (
                    <div className="ai-chat__welcome">
                        <div className="ai-chat__welcome-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                                <path d="M12 6v6l4 2" />
                            </svg>
                        </div>
                        <h3>Xin chào!</h3>
                        <p>Tôi là trợ lý AI chuyên về LaTeX. Hãy hỏi tôi bất cứ điều gì về code, lỗi debug hoặc tạo nội dung mới.</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`ai-chat__message ai-chat__message--${msg.role}`}>
                        <div className="ai-chat__content">
                            {msg.images && msg.images.length > 0 && (
                                <div className="ai-chat__message-images">
                                    {msg.images.map((img, i) => (
                                        <img key={i} src={img.data} alt="Attached" className="ai-chat__message-img" />
                                    ))}
                                </div>
                            )}
                            {msg.role === 'error' ? (
                                <div className="ai-chat__error">{msg.content}</div>
                            ) : (
                                <div className="ai-markdown-content">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({ node, inline, className, children, ...props }) {
                                                const match = /language-(\w+)/.exec(className || '')
                                                const isMultiLine = String(children).includes('\n')

                                                return (!inline && (match || isMultiLine)) ? (
                                                    <pre className="ai-code-block" data-lang={match ? match[1] : ''}>
                                                        <code>{children}</code>
                                                    </pre>
                                                ) : (
                                                    <code className="ai-inline-code" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
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
                {images.length > 0 && (
                    <div className="ai-chat__attachments">
                        {images.map((img, i) => (
                            <div key={i} className="ai-chat__attachment-preview">
                                <img src={img.data} alt="Preview" />
                                <button onClick={() => removeImage(i)} className="ai-chat__remove-attachment">×</button>
                            </div>
                        ))}
                    </div>
                )}
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={handlePaste}
                    onInput={() => {
                        if (inputRef.current) {
                            inputRef.current.style.height = 'auto'
                            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Hỏi AI bất cứ điều gì..."
                    disabled={isLoading}
                    rows={1}
                />

                <div className="ai-chat__input-footer">
                    <div className="ai-chat__model-select-wrapper">
                        <div
                            className={`ai-chat__model-badge ${showModelMenu ? 'active' : ''}`}
                            onClick={() => setShowModelMenu(!showModelMenu)}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            <span>{availableModels[selectedModel]?.name || selectedModel}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </div>

                        {showModelMenu && (
                            <>
                                <div className="ai-chat__menu-backdrop" onClick={() => setShowModelMenu(false)} />
                                <div className="ai-chat__model-menu">
                                    {Object.entries(availableModels).map(([id, model]) => (
                                        <div
                                            key={id}
                                            className={`ai-chat__model-option ${selectedModel === id ? 'selected' : ''}`}
                                            onClick={() => { setSelectedModel(id); setShowModelMenu(false); }}
                                        >
                                            <span className="ai-chat__model-name">{model.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        className="ai-chat__send"
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AIChat
