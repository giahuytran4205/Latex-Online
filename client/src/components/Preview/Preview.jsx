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
    const [scale, setScale] = useState(1.0)
    const [loading, setLoading] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [outline, setOutline] = useState(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [sidebarView, setSidebarView] = useState('thumbnails') // 'thumbnails' | 'outline'

    useEffect(() => {
        if (!pdfUrl) {
            setPdf(null)
            setNumPages(0)
            setOutline(null)
            return
        }

        const loadPdf = async () => {
            setLoading(true)
            try {
                const loadingTask = pdfjsLib.getDocument(pdfUrl)
                const pdfInstance = await loadingTask.promise
                setPdf(pdfInstance)
                setNumPages(pdfInstance.numPages)

                // Get Outline
                const pdfOutline = await pdfInstance.getOutline()
                setOutline(pdfOutline)
            } catch (err) {
                console.error('Error loading PDF:', err)
            } finally {
                setLoading(false)
            }
        }

        loadPdf()
    }, [pdfUrl])

    // Visible page tracking
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pageNum = parseInt(entry.target.getAttribute('data-page-number'))
                    setCurrentPage(pageNum)
                }
            })
        }, {
            root: container,
            threshold: 0.3
        })

        const timer = setTimeout(() => {
            const pages = container.querySelectorAll('.page')
            pages.forEach(page => observer.observe(page))
        }, 800)

        return () => {
            observer.disconnect()
            clearTimeout(timer)
        }
    }, [pdf, numPages, scale])

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

    const scrollToPage = useCallback((pageNum) => {
        if (!containerRef.current) return
        const pageElement = containerRef.current.querySelector(`.page[data-page-number="${pageNum}"]`)
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth' })
        }
    }, [])

    const handleInternalNavigate = useCallback(async (dest) => {
        if (!pdf) return
        try {
            let destArray = dest
            if (typeof dest === 'string') {
                destArray = await pdf.getDestination(dest)
            }

            if (destArray) {
                const pageNum = await pdf.getPageIndex(destArray[0]) + 1
                scrollToPage(pageNum)
            }
        } catch (err) {
            console.error('Internal navigation failed:', err)
        }
    }, [pdf, scrollToPage])

    const handleSyncTeXClick = useCallback((e, pageNum) => {
        if (!onSyncTeX || !containerRef.current) return
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        onSyncTeX(pageNum, clickX / scale, clickY / scale)
    }, [onSyncTeX, scale])

    return (
        <div className={`preview-panel ${isSidebarOpen ? 'sidebar-open' : ''}`}>
            <div className="preview-panel__toolbar">
                <div className="toolbar-left">
                    <button
                        className={`toolbar-btn ${isSidebarOpen ? 'active' : ''}`}
                        title="Toggle Sidebar"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>
                    </button>
                    <div className="toolbar-separator"></div>
                    <div className="toolbar-navigation">
                        <button className="toolbar-btn" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        <div className="page-nav-input-wrapper">
                            <input
                                type="text"
                                className="toolbar-input page-num-input"
                                defaultValue={currentPage}
                                key={currentPage}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = parseInt(e.target.value)
                                        if (val >= 1 && val <= numPages) scrollToPage(val)
                                    }
                                }}
                            />
                            <span className="page-count">of {numPages}</span>
                        </div>
                        <button className="toolbar-btn" onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))} disabled={currentPage >= numPages}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                    </div>
                </div>

                <div className="toolbar-middle">
                    <div className="zoom-controls">
                        <button className="toolbar-btn" title="Zoom Out" onClick={() => setScale(s => Math.max(0.2, s - 0.2))}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="zoom-text">{Math.round(scale * 100)}%</span>
                        <button className="toolbar-btn" title="Zoom In" onClick={() => setScale(s => Math.min(5, s + 0.2))}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="toolbar-right">
                    <button className="toolbar-btn" title="Print" onClick={handlePrint}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                    </button>
                    <button className="toolbar-btn" title="Download" onClick={handleDownload}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="main-viewer-area">
                {isSidebarOpen && (
                    <div className="pdf-sidebar">
                        <div className="sidebar-tabs">
                            <button
                                className={`sidebar-tab ${sidebarView === 'thumbnails' ? 'active' : ''}`}
                                onClick={() => setSidebarView('thumbnails')}
                                title="Page Thumbnails"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                            </button>
                            <button
                                className={`sidebar-tab ${sidebarView === 'outline' ? 'active' : ''}`}
                                onClick={() => setSidebarView('outline')}
                                title="Document Outline"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                            </button>
                        </div>
                        <div className="sidebar-content">
                            {sidebarView === 'thumbnails' ? (
                                <div className="thumbnails-view">
                                    {Array.from({ length: numPages }, (_, i) => (
                                        <Thumbnail
                                            key={i}
                                            pdf={pdf}
                                            pageNum={i + 1}
                                            active={currentPage === i + 1}
                                            onClick={() => scrollToPage(i + 1)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="outline-view">
                                    {outline ? (
                                        <OutlineTree items={outline} onNavigate={handleInternalNavigate} />
                                    ) : (
                                        <div className="sidebar-empty">No outline available</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                                // onDoubleClick={handleSyncTeXClick}
                                // onInternalNavigate={handleInternalNavigate}
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
        </div>
    )
}

function Thumbnail({ pdf, pageNum, active, onClick }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const renderThumb = async () => {
            if (!pdf || !canvasRef.current) return
            try {
                const page = await pdf.getPage(pageNum)
                const viewport = page.getViewport({ scale: 0.15 })
                const canvas = canvasRef.current
                const context = canvas.getContext('2d', { alpha: false })
                canvas.height = viewport.height
                canvas.width = viewport.width
                await page.render({ canvasContext: context, viewport }).promise
            } catch (err) {
                console.error('Thumb render error:', err)
            }
        }
        renderThumb()
    }, [pdf, pageNum])

    return (
        <div className={`thumbnail-item ${active ? 'active' : ''}`} onClick={onClick}>
            <div className="thumbnail-wrapper">
                <canvas ref={canvasRef} />
            </div>
            <span className="thumbnail-label">{pageNum}</span>
        </div>
    )
}

function OutlineTree({ items, onNavigate, depth = 0 }) {
    return (
        <ul className="outline-tree" style={{ paddingLeft: depth > 0 ? '16px' : '0' }}>
            {items.map((item, idx) => (
                <li key={idx}>
                    <div className="outline-item" onClick={() => onNavigate(item.dest)}>
                        {item.title}
                    </div>
                    {item.items && item.items.length > 0 && (
                        <OutlineTree items={item.items} onNavigate={onNavigate} depth={depth + 1} />
                    )}
                </li>
            ))}
        </ul>
    )
}

// Simple Link Service for PDF.js - STRICT Interface
class SimpleLinkService {
    constructor() {
        this.externalLinkTarget = 2 // _blank
        this.externalLinkRel = 'noopener noreferrer nofollow'
        this.externalLinkEnabled = true
        this._params = {}
    }

    getDestinationHash(dest) {
        return '#'
    }

    getAnchorUrl(hash) {
        return hash
    }

    setHash(hash) { }

    executeNamedAction(action) { }

    navigateTo(dest) { }

    addLinkAttributes(link, url, newWindow = true) {
        link.href = url
        link.target = newWindow ? '_blank' : '_self'
        link.rel = this.externalLinkRel
    }
}

function PdfPage({ pdf, pageNum, scale, onDoubleClick, onInternalNavigate }) {
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

                // Create a new LinkService for this page
                const linkService = new SimpleLinkService()

                // Custom override for internal navigate to ensure it uses the prop
                linkService.navigateTo = (dest) => {
                    if (onInternalNavigate) onInternalNavigate(dest)
                }

                const annotationLayer = new pdfjsLib.AnnotationLayer({
                    div: annotationLayerDiv,
                    accessibilityManager: null, // Ensure this isn't undefined if strict
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
