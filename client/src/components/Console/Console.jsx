import { useEffect, useRef, useMemo } from 'react'
import './Console.css'

function Console({ logs, isOpen, onToggle, errors = [] }) {
    const contentRef = useRef(null)

    // Auto-scroll to first error or bottom when logs change
    useEffect(() => {
        if (contentRef.current) {
            const firstError = contentRef.current.querySelector('.console__line--error')
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
            } else {
                contentRef.current.scrollTop = contentRef.current.scrollHeight
            }
        }
    }, [logs])

    // Parse logs and extract important info
    const { parsedLines, errorCount, warningCount } = useMemo(() => {
        if (!logs) return { parsedLines: [], errorCount: 0, warningCount: 0 }

        let errCount = 0
        let warnCount = 0

        const lines = logs.split('\n').map((line, i) => {
            let className = ''

            // Error detection
            if (line.startsWith('!') || line.includes('Fatal error') ||
                line.match(/^l\.\d+/) || line.includes('Emergency stop')) {
                className = 'console__line--error'
                errCount++
            }
            // LaTeX error format: filename:line: error
            else if (line.match(/^.+:\d+:.+error/i)) {
                className = 'console__line--error'
                errCount++
            }
            // Warnings
            else if (line.includes('Warning') || line.includes('Overfull') ||
                line.includes('Underfull') || line.includes('Missing')) {
                className = 'console__line--warning'
                warnCount++
            }
            // Success
            else if (line.includes('Output written') || line.includes('pages,') ||
                line.toLowerCase().includes('successful')) {
                className = 'console__line--success'
            }
            // File info
            else if (line.startsWith('(') || line.startsWith(')') ||
                line.includes('.tex') || line.includes('.sty')) {
                className = 'console__line--info'
            }

            return { text: line, className, index: i }
        })

        return { parsedLines: lines, errorCount: errCount, warningCount: warnCount }
    }, [logs])

    return (
        <div className={`console ${isOpen ? 'console--open' : ''}`}>
            <div className="console__header">
                <div className="console__title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="4,17 10,11 4,5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    Compilation Log
                    {errorCount > 0 && (
                        <span className="console__badge console__badge--error">
                            {errorCount} error{errorCount > 1 ? 's' : ''}
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="console__badge console__badge--warning">
                            {warningCount} warning{warningCount > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="console__actions">
                    <button
                        className="btn btn--icon btn--tiny"
                        onClick={() => {
                            if (contentRef.current) {
                                contentRef.current.scrollTop = 0
                            }
                        }}
                        title="Scroll to top"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="18,15 12,9 6,15" />
                        </svg>
                    </button>
                    <button className="btn btn--icon btn--tiny" onClick={onToggle} title="Close">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            </div>
            <div className="console__content" ref={contentRef}>
                {parsedLines.length > 0 ? (
                    parsedLines.map((line) => (
                        <div key={line.index} className={`console__line ${line.className}`}>
                            {line.text || '\u00A0'}
                        </div>
                    ))
                ) : (
                    <div className="console__empty">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polyline points="4,17 10,11 4,5" />
                            <line x1="12" y1="19" x2="20" y2="19" />
                        </svg>
                        <p>No compilation logs yet.</p>
                        <p className="text-muted">Press Ctrl+S or click Compile to build your document.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Console
