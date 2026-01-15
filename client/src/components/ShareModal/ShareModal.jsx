import { useState, useEffect } from 'react'
import './ShareModal.css'

function ShareModal({ isOpen, onClose, projectId, projectName }) {
    const [sharingSettings, setSharingSettings] = useState({
        publicAccess: 'private', // private, view, edit
        collaborators: []
    })
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)

    // Placeholder for fetching sharing settings
    useEffect(() => {
        if (isOpen) {
            // In a real app, fetch from backend
            // For now, load from localStorage mockup
            const saved = localStorage.getItem(`share-settings-${projectId}`)
            if (saved) {
                setSharingSettings(JSON.parse(saved))
            }
        }
    }, [isOpen, projectId])

    const handleSave = () => {
        localStorage.setItem(`share-settings-${projectId}`, JSON.stringify(sharingSettings))
        onClose()
    }

    const handleCopyLink = () => {
        const url = window.location.href
        navigator.clipboard.writeText(url)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
    }

    const handleAddCollaborator = (e) => {
        e.preventDefault()
        if (!email) return

        const newCollaborators = [...sharingSettings.collaborators, { email, role: 'edit' }]
        setSharingSettings({ ...sharingSettings, collaborators: newCollaborators })
        setEmail('')
    }

    const removeCollaborator = (emailToRemove) => {
        setSharingSettings({
            ...sharingSettings,
            collaborators: sharingSettings.collaborators.filter(c => c.email !== emailToRemove)
        })
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="share-modal" onClick={e => e.stopPropagation()}>
                <div className="share-modal__header">
                    <h2>Share "{projectName}"</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="share-modal__content">
                    <div className="share-section">
                        <h3>Link Sharing</h3>
                        <div className="share-link-box">
                            <input
                                type="text"
                                readOnly
                                value={window.location.href}
                                className="share-link-input"
                            />
                            <button
                                className={`copy-btn ${copySuccess ? 'copy-btn--success' : ''}`}
                                onClick={handleCopyLink}
                            >
                                {copySuccess ? 'Copied!' : 'Copy Link'}
                            </button>
                        </div>

                        <div className="access-control">
                            <span>Anyone with the link can: </span>
                            <select
                                value={sharingSettings.publicAccess}
                                onChange={e => setSharingSettings({ ...sharingSettings, publicAccess: e.target.value })}
                            >
                                <option value="private">No access</option>
                                <option value="view">View</option>
                                <option value="edit">Edit</option>
                            </select>
                        </div>
                    </div>

                    <div className="share-divider" />

                    <div className="share-section">
                        <h3>Collaborators</h3>
                        <form className="add-collab-form" onSubmit={handleAddCollaborator}>
                            <input
                                type="email"
                                placeholder="Add people by email..."
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                            <button type="submit">Invite</button>
                        </form>

                        <div className="collaborator-list">
                            {sharingSettings.collaborators.length === 0 ? (
                                <p className="empty-list">No collaborators added yet.</p>
                            ) : (
                                sharingSettings.collaborators.map(c => (
                                    <div key={c.email} className="collaborator-item">
                                        <div className="collab-info">
                                            <div className="collab-avatar">{c.email[0].toUpperCase()}</div>
                                            <div className="collab-details">
                                                <span className="collab-name">{c.email}</span>
                                                <span className="collab-role">{c.role}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="remove-collab"
                                            onClick={() => removeCollaborator(c.email)}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="share-modal__footer">
                    <button className="secondary-btn" onClick={onClose}>Cancel</button>
                    <button className="primary-btn" onClick={handleSave}>Done</button>
                </div>
            </div>
        </div>
    )
}

export default ShareModal
