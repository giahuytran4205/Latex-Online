import { useRef, useEffect, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import './Preview.css'

// Set worker path
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

function Preview({ pdfUrl, onSyncTeX }) {
    const containerRef = useRef(null)
    const [numPages, setNumPages] = useState(0)
    const [pdf, setPdf] = useState(null)
    const [scale, setScale] = useState(1.5)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!pdfUrl) {
            setPdf(null)
            setNumPages(0)
            return
        }

        const loadPdf = async () => {
            setLoading(true)
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl)
                const pdfInstance = await loadingTask.promise
                setPdf(pdfInstance)
                setNumPages(pdfInstance.numPages)
            } catch (err) {
                console.error('Error loading PDF:', err)
            } finally {
                setLoading(false)
            }
        }

        loadPdf()
    }, [pdfUrl])

    const handleDownload = () => {
        if (!pdfUrl) return
        const a = document.createElement('a')
        a.href = pdfUrl
        a.download = 'document.pdf'
        a.click()
    }

    const handlePrint = () => {
        if (!pdfUrl) return
        window.open(pdfUrl, '_blank').print()
    }

    const handleSyncTeXClick = useCallback((e, pageNum) => {
        if (!onSyncTeX || !containerRef.current) return

        const canvas = e.currentTarget
        const rect = canvas.getBoundingClientRect()

        // Coordinates relative to canvas
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        // Convert to PDF points (72 DPI)
        // Canvas scale is scale * devicePixelRatio
        const pdfX = (clickX / scale)
        const pdfY = (rect.height - clickY) / scale // PDF coords usually start from bottom

        onSyncTeX(pageNum, pdfX, pdfY)
    }, [onSyncTeX, scale])

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
                    <div className="zoom-controls">
                        <button className="btn btn--icon" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="zoom-level">{Math.round(scale * 100)}%</span>
                        <button className="btn btn--icon" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                    {pdfUrl && (
                        <>
                            <div className="separator"></div>
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
                        </>
                    )}
                </div>
            </div>

            <div className="preview-panel__content" ref={containerRef}>
                {!pdfUrl ? (
                    <div className="preview-panel__empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Compile your LaTeX to see the PDF preview</span>
                    </div>
                ) : (
                    <div className="pdf-viewer">
                        {Array.from({ length: numPages }, (_, i) => (
                            <PdfPage
                                key={`${pdfUrl}-${i + 1}-${scale}`}
                                pdf={pdf}
                                pageNum={i + 1}
                                scale={scale}
                                onDoubleClick={handleSyncTeXClick}
                            />
                        ))}
                    </div>
                )}
                {loading && (
                    <div className="preview-loading">
                        <div className="loading-spinner"></div>
                    </div>
                )}
            </div>
        </div>
    )
}

function PdfPage({ pdf, pageNum, scale, onDoubleClick }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const renderPage = async () => {
            if (!pdf || !canvasRef.current) return

            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: scale * window.devicePixelRatio })
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            canvas.height = viewport.height
            canvas.width = viewport.width
            canvas.style.height = `${viewport.height / window.devicePixelRatio}px`
            canvas.style.width = `${viewport.width / window.devicePixelRatio}px`

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            }

            await page.render(renderContext).promise
        }

        renderPage()
    }, [pdf, pageNum, scale])

    return (
        <div className="pdf-page-wrapper">
            <canvas
                ref={canvasRef}
                onDoubleClick={(e) => onDoubleClick(e, pageNum)}
                title="Double click to go to source"
            />
        </div>
    )
}

export default Preview
