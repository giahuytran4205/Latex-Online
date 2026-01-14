import { useRef, useEffect, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
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
                <div className="preview-panel__title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span>PDF Preview</span>
                </div>
                <div className="preview-panel__controls">
                    <div className="zoom-controls">
                        <button className="btn btn--icon btn--dark" title="Zoom Out" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="zoom-level">{Math.round(scale * 100)}%</span>
                        <button className="btn btn--icon btn--dark" title="Zoom In" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                    {pdfUrl && (
                        <>
                            <div className="separator--dark"></div>
                            <button className="btn btn--icon btn--dark" title="Print" onClick={handlePrint}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="6 9 6 2 18 2 18 9" />
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                    <rect x="6" y="14" width="12" height="8" />
                                </svg>
                            </button>
                            <button className="btn btn--icon btn--dark" title="Download" onClick={handleDownload}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        <h3>Ready to compile</h3>
                        <p>Your PDF preview will appear here once you compile your LaTeX project.</p>
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
        let renderTask = null

        const renderPage = async () => {
            if (!pdf || !canvasRef.current) return

            const page = await pdf.getPage(pageNum)

            // For sharper rendering
            const renderScale = scale * window.devicePixelRatio * 1.5
            const viewport = page.getViewport({ scale: renderScale })

            const canvas = canvasRef.current
            const context = canvas.getContext('2d', { alpha: false })

            canvas.height = viewport.height
            canvas.width = viewport.width

            // CSS size
            const displayViewport = page.getViewport({ scale: scale })
            canvas.style.height = `${displayViewport.height}px`
            canvas.style.width = `${displayViewport.width}px`

            if (renderTask) renderTask.cancel()

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            }

            renderTask = page.render(renderContext)
            await renderTask.promise

            // Render Text Layer
            if (textLayerRef.current) {
                const textContent = await page.getTextContent()
                const textLayerDiv = textLayerRef.current

                textLayerDiv.innerHTML = ''
                textLayerDiv.style.height = `${displayViewport.height}px`
                textLayerDiv.style.width = `${displayViewport.width}px`

                pdfjsLib.renderTextLayer({
                    textContentSource: textContent,
                    container: textLayerDiv,
                    viewport: displayViewport,
                    textDivs: []
                })
            }

            // Render Annotation Layer
            if (annotationLayerRef.current) {
                const annotations = await page.getAnnotations()
                const annotationLayerDiv = annotationLayerRef.current

                annotationLayerDiv.innerHTML = ''
                annotationLayerDiv.style.height = `${displayViewport.height}px`
                annotationLayerDiv.style.width = `${displayViewport.width}px`

                const linkService = {
                    externalLinkTarget: 2, // _blank
                    externalLinkRel: 'noopener noreferrer nofollow',
                    baseUrl: null,
                    navigateTo: (dest) => {
                        console.log('Navigate to destination:', dest)
                    },
                    getDestinationHash: (dest) => '#',
                    getAnchorUrl: (hash) => hash,
                    setParams: () => { },
                    setHash: () => { },
                    executeNamedAction: (action) => console.log('Action:', action),
                    addLinkAttributes: (link, url, newWindow = true) => {
                        link.href = url;
                        if (newWindow) {
                            link.target = "_blank";
                            link.rel = "noopener noreferrer nofollow";
                        }
                    }
                }

                const annotationLayer = new pdfjsLib.AnnotationLayer({
                    div: annotationLayerDiv,
                    accessibilityManager: null,
                    page: page,
                    viewport: displayViewport,
                })

                await annotationLayer.render({
                    annotations: annotations,
                    viewport: displayViewport,
                    linkService: linkService,
                    div: annotationLayerDiv,
                })
            }
        }

        renderPage()

        return () => {
            if (renderTask) renderTask.cancel()
        }
    }, [pdf, pageNum, scale])

    return (
        <div
            className="page"
            onDoubleClick={(e) => onDoubleClick(e, pageNum)}
            data-page-number={pageNum}
            style={{
                margin: '20px auto',
                backgroundColor: 'white',
                position: 'relative',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                overflow: 'hidden',
                '--scale-factor': scale
            }}
        >
            <div className="canvasWrapper" style={{ position: 'relative', zIndex: 1 }}>
                <canvas ref={canvasRef} />
            </div>
            <div
                ref={textLayerRef}
                className="textLayer"
                style={{ zIndex: 2 }}
            />
            <div
                ref={annotationLayerRef}
                className="annotationLayer"
                style={{ zIndex: 3 }}
            />
        </div>
    )
}

export default Preview
