import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './Preview.css'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

function Preview({ pdfUrl }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [pdf, setPdf] = useState(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Load PDF
    useEffect(() => {
        if (!pdfUrl) {
            setPdf(null)
            return
        }

        setLoading(true)
        setError(null)

        pdfjsLib.getDocument(pdfUrl).promise
            .then((pdfDoc) => {
                setPdf(pdfDoc)
                setTotalPages(pdfDoc.numPages)
                setCurrentPage(1)
                setLoading(false)
            })
            .catch((err) => {
                setError('Failed to load PDF: ' + err.message)
                setLoading(false)
            })
    }, [pdfUrl])

    // Render page
    useEffect(() => {
        if (!pdf || !canvasRef.current) return

        pdf.getPage(currentPage).then((page) => {
            const viewport = page.getViewport({ scale })
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            canvas.height = viewport.height
            canvas.width = viewport.width

            page.render({
                canvasContext: context,
                viewport: viewport,
            })
        })
    }, [pdf, currentPage, scale])

    const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3))
    const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5))
    const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1))
    const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages))

    return (
        <div className="preview-panel" ref={containerRef}>
            <div className="preview-panel__header">
                <span className="preview-panel__title">PDF Preview</span>
                <div className="preview-panel__controls">
                    {pdf && (
                        <>
                            <button className="btn btn--icon" onClick={handlePrevPage} disabled={currentPage <= 1}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15,18 9,12 15,6" />
                                </svg>
                            </button>
                            <span className="preview-panel__zoom">
                                {currentPage} / {totalPages}
                            </span>
                            <button className="btn btn--icon" onClick={handleNextPage} disabled={currentPage >= totalPages}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9,18 15,12 9,6" />
                                </svg>
                            </button>
                            <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>
                            <button className="btn btn--icon" onClick={handleZoomOut}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                            <span className="preview-panel__zoom">{Math.round(scale * 100)}%</span>
                            <button className="btn btn--icon" onClick={handleZoomIn}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="11" y1="8" x2="11" y2="14" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="preview-panel__content">
                {loading && (
                    <div className="preview-panel__empty">
                        <div className="spinner"></div>
                        <span>Loading PDF...</span>
                    </div>
                )}
                {error && (
                    <div className="preview-panel__empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12" y2="16" />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}
                {!pdfUrl && !loading && !error && (
                    <div className="preview-panel__empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>Click "Compile" to generate PDF</span>
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                            Or press Ctrl+Enter
                        </span>
                    </div>
                )}
                {pdf && !loading && (
                    <div className="pdf-viewer">
                        <canvas ref={canvasRef}></canvas>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Preview
