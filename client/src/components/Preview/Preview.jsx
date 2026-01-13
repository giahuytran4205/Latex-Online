import { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './Preview.css'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const PDFPage = ({ pageNum, pdf, scale, onMeasure }) => {
    const canvasRef = useRef(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!pdf || !canvasRef.current) return

        let renderTask = null
        setLoading(true)

        pdf.getPage(pageNum).then((page) => {
            const viewport = page.getViewport({ scale })

            // Notify parent about page dimensions (for Fit Width logic, usually from page 1)
            if (onMeasure && pageNum === 1) {
                onMeasure(viewport.width)
            }

            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            // High DPI Rendering
            const dpr = window.devicePixelRatio || 1
            canvas.height = viewport.height * dpr
            canvas.width = viewport.width * dpr
            canvas.style.height = `${viewport.height}px`
            canvas.style.width = `${viewport.width}px`

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
                transform: [dpr, 0, 0, dpr, 0, 0]
            }

            renderTask = page.render(renderContext)

            renderTask.promise.then(() => {
                setLoading(false)
            }).catch(() => {
                // Ignore cancellation errors
            })
        })

        return () => {
            if (renderTask) renderTask.cancel()
        }
    }, [pdf, pageNum, scale])

    return (
        <div className="pdf-page" style={{ position: 'relative', margin: '10px auto', display: 'flex', justifyContent: 'center' }}>
            <canvas ref={canvasRef} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
            {loading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)' }}>
                    Loading...
                </div>
            )}
        </div>
    )
}

function Preview({ pdfUrl }) {
    const containerRef = useRef(null)
    const [pdf, setPdf] = useState(null)
    const [totalPages, setTotalPages] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [fitMode, setFitMode] = useState('width') // 'width', 'actual'

    // Load PDF
    useEffect(() => {
        if (!pdfUrl) {
            setPdf(null)
            return
        }

        setLoading(true)
        setError(null)

        const loadingTask = pdfjsLib.getDocument(pdfUrl)

        loadingTask.promise
            .then((pdfDoc) => {
                setPdf(pdfDoc)
                setTotalPages(pdfDoc.numPages)
                setLoading(false)
                // Default to fit width will trigger on measure
            })
            .catch((err) => {
                setError('Failed to load PDF: ' + err.message)
                setLoading(false)
            })

        return () => {
            // Cleanup shared transport? pdfjsLib manages this mostly.
        }
    }, [pdfUrl])

    // Fit Width Logic
    const handleMeasure = useCallback((pageWidth) => {
        if (fitMode === 'width' && containerRef.current) {
            const containerWidth = containerRef.current.clientWidth - 40 // Padding
            if (pageWidth > 0) {
                setScale(containerWidth / pageWidth)
            }
        }
    }, [fitMode])

    // Re-measure on resize if in fit width mode
    useEffect(() => {
        const handleResize = () => {
            if (fitMode === 'width' && pdf && containerRef.current) {
                // Trigger re-measure effectively by forcing update? 
                // We rely on handleMeasure being called by page 1 render, which depends on scale. 
                // This circular dependency (render -> measure -> scale -> render) needs handling.
                // Simpler: Just recalculate if we knew the base width. 
                // But we don't store base width.
                // For now, let's just stick to initial fit or manual Fit Width button click.
            }
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [fitMode, pdf])

    const handleZoomIn = () => {
        setFitMode('custom')
        setScale((s) => Math.min(s + 0.25, 3))
    }

    const handleZoomOut = () => {
        setFitMode('custom')
        setScale((s) => Math.max(s - 0.25, 0.5))
    }

    const handleFitWidth = () => {
        setFitMode('width')
        // Force re-render of page 1 to trigger measure?
        // Or fetch page 1 directly here.
        if (pdf && containerRef.current) {
            pdf.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 1.0 })
                const containerWidth = containerRef.current.clientWidth - 40
                setScale(containerWidth / viewport.width)
            })
        }
    }

    const handleDownload = () => {
        if (!pdfUrl) return
        const a = document.createElement('a')
        a.href = pdfUrl
        a.download = 'document.pdf'
        a.click()
    }

    const handlePrint = () => {
        if (!pdfUrl) return
        window.open(pdfUrl, '_blank')
    }

    return (
        <div className="preview-panel">
            <div className="preview-panel__header">
                <span className="preview-panel__title">PDF Preview</span>
                <div className="preview-panel__controls">
                    {pdf && (
                        <>
                            {/* Page Count Info */}
                            <span className="preview-panel__zoom" style={{ marginRight: '8px' }}>
                                {totalPages} Pages
                            </span>

                            <div className="separator" style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>

                            <button className="btn btn--icon" title="Fit Width" onClick={handleFitWidth}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
                                </svg>
                            </button>
                            <button className="btn btn--icon" title="Zoom Out" onClick={handleZoomOut}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>
                            <span className="preview-panel__zoom">{Math.round(scale * 100)}%</span>
                            <button className="btn btn--icon" title="Zoom In" onClick={handleZoomIn}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    <line x1="11" y1="8" x2="11" y2="14" />
                                    <line x1="8" y1="11" x2="14" y2="11" />
                                </svg>
                            </button>

                            <div className="separator" style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 8px' }}></div>

                            <button className="btn btn--icon" title="Download" onClick={handleDownload}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </button>
                            <button className="btn btn--icon" title="Print" onClick={handlePrint}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect x="6" y="14" width="12" height="8" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="preview-panel__content" ref={containerRef} style={{ overflowY: 'auto', background: '#525659', padding: '20px' }}>
                {loading && (
                    <div className="preview-panel__empty" style={{ color: 'white' }}>
                        <div className="spinner"></div>
                        <span>Loading PDF...</span>
                    </div>
                )}
                {error && (
                    <div className="preview-panel__empty" style={{ color: 'white' }}>
                        <span>{error}</span>
                    </div>
                )}

                {!pdfUrl && !loading && !error && (
                    <div className="preview-panel__empty" style={{ color: '#ccc' }}>
                        <span>Click "Compile" to generate PDF</span>
                    </div>
                )}

                {pdf && !loading && (
                    <div className="pdf-document">
                        {Array.from({ length: totalPages }, (_, i) => (
                            <PDFPage
                                key={i + 1}
                                pageNum={i + 1}
                                pdf={pdf}
                                scale={scale}
                                onMeasure={i === 0 ? handleMeasure : null}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Preview
