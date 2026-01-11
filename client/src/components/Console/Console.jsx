import { useEffect, useRef } from 'react'
import './Console.css'

function Console({ logs, isOpen, onToggle }) {
    const contentRef = useRef(null)

    // Auto-scroll to bottom when logs change
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
    }, [logs])

    const parseLogLine = (line) => {
        if (line.includes('Error') || line.includes('!')) {
            return 'console__line--error'
        }
        if (line.includes('Warning') || line.includes('Overfull') || line.includes('Underfull')) {
            return 'console__line--warning'
        }
        if (line.includes('Output written') || line.includes('successful')) {
            return 'console__line--success'
        }
        return ''
    }

    return (
        <div className={`console ${isOpen ? 'console--open' : ''}`}>
            <div className="console__header">
                <div className="console__title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="4,17 10,11 4,5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    Compilation Log
                </div>
                <button className="btn btn--icon" onClick={onToggle}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="console__content" ref={contentRef}>
                {logs ? (
                    logs.split('\n').map((line, i) => (
                        <div key={i} className={`console__line ${parseLogLine(line)}`}>
                            {line}
                        </div>
                    ))
                ) : (
                    <div className="text-muted">No compilation logs yet.</div>
                )}
            </div>
        </div>
    )
}

export default Console
