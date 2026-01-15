import './FileViewer.css'

const FileViewer = ({ filename, url }) => {
    const isImage = /\.(png|jpg|jpeg|gif|ico|svg)$/i.test(filename)
    const isPdf = /\.pdf$/i.test(filename)

    if (isImage) {
        return (
            <div className="file-viewer">
                <div className="file-viewer__content">
                    <img src={url} alt={filename} className="file-viewer__image" />
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
                <p className="file-viewer__hint">Right-click the file in the sidebar to download it.</p>
                <div className="file-viewer__filename-hint">{filename}</div>
            </div>
        </div>
    )
}

export default FileViewer
