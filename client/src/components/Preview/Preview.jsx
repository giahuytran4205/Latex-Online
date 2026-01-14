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

        const rect = e.currentTarget.getBoundingClientRect()

        // Coordinates relative to the page wrapper
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        // Convert pixels to PDF points (1/72 inch)
        // PDF.js uses scale = pixels / PDF_point
        // SyncTeX 'edit' typically expects coordinates from Top-Left
        const pdfX = clickX / scale
        const pdfY = clickY / scale

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

// Basic styles for text layer (if not importing pdf_viewer.css)
const textLayerStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    lineHeight: 1.0,
    opacity: 0.2, // Make text selection visible but subtle
}

function PdfPage({ pdf, pageNum, scale, onDoubleClick }) {
    const canvasRef = useRef(null)
    const textLayerRef = useRef(null)
    const annotationLayerRef = useRef(null)

    useEffect(() => {
        const renderPage = async () => {
            if (!pdf || !canvasRef.current) return

            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: scale * window.devicePixelRatio })
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')

            // Adjust canvas for high-DPI displays
            canvas.height = viewport.height
            canvas.width = viewport.width
            canvas.style.height = `${viewport.height / window.devicePixelRatio}px`
            canvas.style.width = `${viewport.width / window.devicePixelRatio}px`

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            }

            await page.render(renderContext).promise

            // Render Text Layer
            if (textLayerRef.current) {
                const textContent = await page.getTextContent()
                const textLayerDiv = textLayerRef.current

                // Clear previous text layer content
                textLayerDiv.innerHTML = ''
                textLayerDiv.style.height = canvas.style.height
                textLayerDiv.style.width = canvas.style.width

                // Use PDF.js internal text layer rendering (simplified)
                // Note: proper implementation usually requires pdfjs-dist/web/pdf_viewer.css
                // We're doing a manual simplified render to allow selection

                // We need to use the non-scaled viewport for text layer layout
                const textViewport = page.getViewport({ scale: scale })

                pdfjsLib.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: textViewport,
                    textDivs: []
                })
            }

            // Render Annotation Layer
            if (annotationLayerRef.current) {
                const annotations = await page.getAnnotations()
                const annotationLayerDiv = annotationLayerRef.current

                annotationLayerDiv.innerHTML = ''
                annotationLayerDiv.style.height = canvas.style.height
                annotationLayerDiv.style.width = canvas.style.width

                const annotationViewport = page.getViewport({ scale: scale })

                const linkService = {
                    navigateTo: (dest) => { console.log('Navigate to:', dest) },
                    getDestinationHash: (dest) => '#',
                    getAnchorUrl: (hash) => hash
                }

                const layer = new pdfjsLib.AnnotationLayer({
                    div: annotationLayerDiv,
                    accessibilityManager: null,
                    page: page,
                    viewport: annotationViewport,
                })

                layer.render({
                    annotations: annotations,
                    div: annotationLayerDiv,
                    linkService: linkService,
                    page: page
                })
            }
        }

        renderPage()
    }, [pdf, pageNum, scale])

    return (
        <div
            className="pdf-page-wrapper"
            style={{ position: 'relative' }}
            onDoubleClick={(e) => onDoubleClick(e, pageNum)}
            title="Double click to go to source"
        >
            <canvas
                ref={canvasRef}
            />
            <div
                ref={textLayerRef}
                className="textLayer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    lineHeight: '1.0',
                    '--scale-factor': scale,
                    opacity: 0, // Make text layer invisible but selectable
                    pointerEvents: 'auto'
                }}
            />
            <div
                ref={annotationLayerRef}
                className="annotationLayer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none' // Let double-clicks pass through to wrapper
                }}
            />
        </div>
    )
}

export default Preview
