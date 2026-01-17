/**
 * EditorHeader - Tab bar and shortcuts display for the editor
 */
function EditorHeader({ displayName, readOnly }) {
    return (
        <div className="editor-panel__header">
            <div className="editor-panel__tabs">
                <button className="editor-tab editor-tab--active">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                    </svg>
                    {displayName}
                </button>
                {readOnly && <span className="read-only-badge">Read Only</span>}
            </div>
            {!readOnly && (
                <div className="editor-panel__shortcuts">
                    <span className="shortcut-hint" title="Bold">Ctrl+B</span>
                    <span className="shortcut-hint" title="Italic">Ctrl+I</span>
                    <span className="shortcut-hint" title="Save & Compile">Ctrl+S</span>
                </div>
            )}
        </div>
    )
}

export default EditorHeader
