import { useState, useEffect } from 'react'
import './Toolbar.css'

function Toolbar({
    engine,
    onEngineChange,
    onCompile,
    isCompiling,
    theme,
    onThemeChange,
    collaborators = [],
    pdfUrl,
    projectName,
    onRenameProject,
    onBackToHome,
    onShare,
    onJumpToUser,
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [newName, setNewName] = useState(projectName || '')

    useEffect(() => {
        setNewName(projectName || '')
    }, [projectName])

    const handleRenameSubmit = async () => {
        if (newName.trim() && newName !== projectName) {
            const success = await onRenameProject(newName.trim())
            if (success) setIsEditing(false)
            else setNewName(projectName) // Reset on failure
        } else {
            setIsEditing(false)
            setNewName(projectName)
        }
    }
    const handleDownload = () => {
        if (pdfUrl) {
            const a = document.createElement('a')
            a.href = pdfUrl
            a.download = 'document.pdf'
            a.click()
        }
    }

    return (
        <header className="toolbar">
            <div className="toolbar__left">
                {/* Back to Home Button */}
                {onBackToHome && (
                    <button
                        className="btn btn--icon toolbar__back-btn"
                        onClick={onBackToHome}
                        title="Back to Projects"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}

                <div className="toolbar__logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                        <path d="M9 15l2 2 4-4" />
                    </svg>
                    {isEditing ? (
                        <input
                            type="text"
                            className="toolbar__project-input"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit()
                                if (e.key === 'Escape') {
                                    setIsEditing(false)
                                    setNewName(projectName)
                                }
                            }}
                            autoFocus
                        />
                    ) : (
                        <div
                            className="toolbar__project-name-container"
                            onClick={() => setIsEditing(true)}
                            title="Click to rename project"
                        >
                            <span className="toolbar__project-name">{projectName || 'LaTeX Online'}</span>
                            <svg className="toolbar__edit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>

            <div className="toolbar__actions">
                {/* Collaborators */}
                {collaborators.length > 0 && (
                    <div className="collaborators">
                        {collaborators
                            .filter(collab => !collab.isSelf)
                            .slice(0, 5)
                            .map((collab, i) => (
                                <div
                                    key={i}
                                    className="collaborator-avatar"
                                    style={{
                                        border: `2px solid ${collab.color}`,
                                        cursor: 'pointer'
                                    }}
                                    title={`${collab.name} ${collab.activeFile ? `(in ${collab.activeFile})` : '(connecting...)'}`}
                                    onClick={() => onJumpToUser?.(collab)}
                                >
                                    <span style={{ color: collab.color, fontWeight: 'bold' }}>
                                        {collab.name[0].toUpperCase()}
                                    </span>
                                </div>
                            ))}
                        {collaborators.filter(c => !c.isSelf).length > 5 && (
                            <div className="collaborator-avatar" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                                <span style={{ fontSize: '0.7rem' }}>+{collaborators.filter(c => !c.isSelf).length - 5}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Engine Selector */}
                <select
                    className="toolbar__engine-select"
                    value={engine}
                    onChange={(e) => onEngineChange(e.target.value)}
                >
                    <option value="pdflatex">pdflatex</option>
                    <option value="xelatex">xelatex</option>
                    <option value="lualatex">lualatex</option>
                </select>

                {/* Share Button */}
                <button
                    className="btn btn--secondary toolbar__share-btn"
                    onClick={onShare}
                    title="Share project"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span>Share</span>
                </button>

                {/* Compile Button */}
                <button
                    className="btn btn--primary"
                    onClick={onCompile}
                    disabled={isCompiling}
                >
                    {isCompiling ? (
                        <>
                            <div className="spinner"></div>
                            Compiling...
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                            Compile
                        </>
                    )}
                </button>

                {/* Download Button */}
                <button
                    className="btn btn--secondary"
                    onClick={handleDownload}
                    disabled={!pdfUrl}
                    title="Download PDF"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7,10 12,15 17,10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                </button>

                {/* Theme Switcher */}
                <div className="theme-switcher">
                    <button
                        className={`theme-switcher__btn ${theme === 'light' ? 'theme-switcher__btn--active' : ''}`}
                        onClick={() => onThemeChange('light')}
                        title="Light theme"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    </button>
                    <button
                        className={`theme-switcher__btn ${theme === 'dark' ? 'theme-switcher__btn--active' : ''}`}
                        onClick={() => onThemeChange('dark')}
                        title="Dark theme"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    </button>
                    <button
                        className={`theme-switcher__btn ${theme === 'system' ? 'theme-switcher__btn--active' : ''}`}
                        onClick={() => onThemeChange('system')}
                        title="System theme"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>
    )
}

export default Toolbar
