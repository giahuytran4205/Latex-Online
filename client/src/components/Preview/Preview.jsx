import { useRef } from 'react'
import './Preview.css'

function Preview({ pdfUrl }) {
    const containerRef = useRef(null)

    const handleDownload = () => {
        if (!pdfUrl) return
        const a = document.createElement('a')
        a.href = pdfUrl
        a.download = 'document.pdf'
        a.click()
    }

    const handlePrint = () => {
        if (!pdfUrl) return
        // We open the URL again for printing to use browser's native print dialog
        const printWindow = window.open(pdfUrl, '_blank')
        if (printWindow) {
            printWindow.print()
        }
    }

    const handleOpenExternal = () => {
        if (!pdfUrl) return
        window.open(pdfUrl, '_blank')
    }

    return (
        <div className="preview-panel">
            <div className="preview-panel__header">
                <span className="preview-panel__title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    PDF Preview
                </span>
                <div className="preview-panel__controls">
                    {pdfUrl && (
                        <>
                            <button className="btn btn--icon" title="Print" onClick={handlePrint}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect x="6" y="14" width="12" height="8" />
                                </svg>
                            </button>
                            <button className="btn btn--icon" title="Download" onClick={handleDownload}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                            <div className="separator" style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }}></div>
                            <button className="btn btn--icon" title="Open in New Tab" onClick={handleOpenExternal}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="preview-panel__content" ref={containerRef} style={{ padding: 0, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                {!pdfUrl ? (
                    <div className="preview-panel__empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.2, marginBottom: '16px' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>Compile your LaTeX to see the PDF preview</span>
                    </div>
                ) : (
                    <iframe
                        key={pdfUrl}
                        src={`${pdfUrl}#view=FitH&scrollbar=1&toolbar=1&statusbar=0&messages=0&navpanes=0`}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title="PDF Viewer"
                    />
                )}
            </div>
        </div>
    )
}

export default Preview
