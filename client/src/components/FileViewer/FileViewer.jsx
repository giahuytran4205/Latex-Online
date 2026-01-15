import './FileViewer.css'

const FileViewer = ({ filename, url, onDownload }) => {
    const isImage = /\.(png|jpg|jpeg|gif|ico|svg)$/i.test(filename)
    const isPdf = /\.pdf$/i.test(filename)

    if (isImage) {
        return (
            <div className="file-viewer">
                <div className="file-viewer__content">
                    <img src={url} alt={filename} className="file-viewer__image" />
                </div>
                <div className="file-viewer__footer">
                    <span className="file-viewer__filename">{filename}</span>
                    <button className="btn btn--secondary" onClick={onDownload}>
                        Download
                    </button>
                </div>
            </div>
        )
    }

    if (isPdf) {
        return (
            <div className="file-viewer">
                <div className="file-viewer__content">
                    <iframe src={url + '#toolbar=0'} title={filename} className="file-viewer__pdf" />
                </div>
                <div className="file-viewer__footer">
                    <span className="file-viewer__filename">{filename}</span>
                    <button className="btn btn--secondary" onClick={onDownload}>
                        Download
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="file-viewer file-viewer--unsupported">
            <div className="file-viewer__content">
                <div className="file-viewer__icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                    </svg>
                </div>
                <p>This file type cannot be displayed directly.</p>
                <button className="btn btn--primary" onClick={onDownload}>
                    Download File to View
                </button>
            </div>
            <div className="file-viewer__footer">
                <span className="file-viewer__filename">{filename}</span>
            </div>
        </div>
    )
}

export default FileViewer
