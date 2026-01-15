import { useRef, useEffect, useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import './Preview.css'

// Configure worker
// Use CDN worker to avoid version mismatches and bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function Preview({ pdfUrl, onSyncTeX }) {
    const containerRef = useRef(null)
    const [numPages, setNumPages] = useState(0)
    const [pdfDocument, setPdfDocument] = useState(null)
    const [scale, setScale] = useState(1.0)
    const [currentPage, setCurrentPage] = useState(1)
    const [outline, setOutline] = useState(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [sidebarView, setSidebarView] = useState('thumbnails') // 'thumbnails' | 'outline'

    // Callback when document loads successfully
    function onDocumentLoadSuccess(pdf) {
        setNumPages(pdf.numPages)
        setPdfDocument(pdf)
        setPageNumber(1)

        // Get Outline
        pdf.getOutline().then(pdfOutline => {
            setOutline(pdfOutline)
        }).catch(err => {
            console.error('Error retrieving outline:', err)
            setOutline(null)
        })
    }

    // Callback for loading errors
    function onDocumentLoadError(error) {
        console.error('Error loading PDF Document:', error)
        setNumPages(0)
        setPdfDocument(null)
        setOutline(null)
    }

    // Scroll helper
    const scrollToPage = useCallback((pageNum) => {
        if (!containerRef.current) return
        const pageElement = containerRef.current.querySelector(`.page-wrapper[data-page-number="${pageNum}"]`)
        if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'smooth' })
        }
    }, [])

    // Set Page Number helper (just wraps scrollToPage for clarity in some contexts)
    const setPageNumber = (num) => {
        scrollToPage(num)
    }

    // Internal Navigation (Outline/Links)
    const handleInternalNavigate = useCallback(async (dest) => {
        if (!pdfDocument) return
        try {
            let destArray = dest
            if (typeof dest === 'string') {
                destArray = await pdfDocument.getDestination(dest)
            }

            if (destArray) {
                const pageIndex = await pdfDocument.getPageIndex(destArray[0])
                scrollToPage(pageIndex + 1)
            }
        } catch (err) {
            console.error('Internal navigation failed:', err)
        }
    }, [pdfDocument, scrollToPage])

    // Track visible page on scroll
    useEffect(() => {
        const container = containerRef.current
        if (!container || !pdfDocument) return

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const pageNum = parseInt(entry.target.getAttribute('data-page-number'))
                    if (!isNaN(pageNum)) {
                        setCurrentPage(pageNum)
                    }
                }
            })
        }, {
            root: container,
            threshold: 0.3
        })

        // Slight delay to ensure DOM is ready
        const timer = setTimeout(() => {
            const pages = container.querySelectorAll('.page-wrapper')
            pages.forEach(page => observer.observe(page))
        }, 500)

        return () => {
            observer.disconnect()
            clearTimeout(timer)
        }
    }, [pdfDocument, numPages, scale]) // Re-observe when pages change

    // SyncTeX Handler
    const handleDoubleClick = useCallback((e, pageNum) => {
        if (!onSyncTeX) return
        const rect = e.currentTarget.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top
        onSyncTeX(pageNum, clickX / scale, clickY / scale)
    }, [onSyncTeX, scale])

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
                    <div className="page-navigation">
                        <button className="toolbar-btn" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        <div className="page-nav-input-wrapper">
                            <input
                                type="text"
                                className="toolbar-input page-num-input"
                                value={currentPage}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val)) setCurrentPage(val);
                                }}
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
                                    {pdfDocument ? (
                                        Array.from({ length: numPages }, (_, i) => (
                                            <Thumbnail
                                                key={i}
                                                pdf={pdfDocument}
                                                pageNum={i + 1}
                                                active={currentPage === i + 1}
                                                onClick={() => scrollToPage(i + 1)}
                                            />
                                        ))
                                    ) : (
                                        <div className="sidebar-empty">No PDF loaded</div>
                                    )}
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
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            onLoadError={onDocumentLoadError}
                            loading={<div className="preview-loading"><div className="loading-spinner"></div></div>}
                            className="pdf-document"
                        >
                            {Array.from({ length: numPages }, (_, i) => (
                                <div
                                    key={`page-${i + 1}`}
                                    className="page-wrapper"
                                    data-page-number={i + 1}
                                    style={{
                                        margin: '20px auto',
                                        width: 'fit-content',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                                        backgroundColor: 'white'
                                    }}
                                    onDoubleClick={(e) => handleDoubleClick(e, i + 1)}
                                >
                                    <Page
                                        pageNumber={i + 1}
                                        scale={scale}
                                        renderTextLayer={true}
                                        renderAnnotationLayer={true}
                                        loading={null}
                                    />
                                </div>
                            ))}
                        </Document>
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

export default Preview