import { useState, useEffect } from 'react'
import { getProjectInfo, shareProject } from '../../services/api'
import { useToast } from '../Toast/Toast'
import './ShareModal.css'

function ShareModal({ isOpen, onClose, projectId, projectName, sid }) {
    const [sharingSettings, setSharingSettings] = useState({
        publicAccess: 'private', // private, view, edit
        collaborators: [],
        shares: { view: '', edit: '' }
    })
    const [linkLevel, setLinkLevel] = useState('view') // 'view' or 'edit'
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copySuccess, setCopySuccess] = useState(false)

    const toast = useToast()

    useEffect(() => {
        if (isOpen && projectId) {
            const fetchSettings = async () => {
                try {
                    const data = await getProjectInfo(projectId, sid)
                    setSharingSettings({
                        publicAccess: data.publicAccess || 'private',
                        collaborators: data.collaborators || [],
                        shares: data.shares || { view: '', edit: '' }
                    })
                } catch (err) {
                    console.error('Failed to fetch settings:', err)
                }
            }
            fetchSettings()
        }
    }, [isOpen, projectId])

    const handleSave = async () => {
        setIsLoading(true)
        try {
            await shareProject(projectId, sharingSettings, sid)
            toast.success('Sharing settings updated')
            onClose()
        } catch (err) {
            toast.error('Failed to update sharing: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const getShareUrl = () => {
        const sid = sharingSettings.shares?.[linkLevel]
        if (!sid) return ''
        return `${window.location.origin}/s/${sid}`
    }

    const handleCopyLink = async () => {
        const url = getShareUrl()
        if (!url) return

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(url)
                setCopySuccess(true)
                setTimeout(() => setCopySuccess(false), 2000)
            } else {
                throw new Error('Clipboard API unavailable')
            }
        } catch (err) {
            // Fallback
            const input = document.createElement('input')
            input.value = url
            document.body.appendChild(input)
            input.select()
            try {
                document.execCommand('copy')
                setCopySuccess(true)
                setTimeout(() => setCopySuccess(false), 2000)
            } catch (e) {
                toast.error('Failed to copy link')
            }
            document.body.removeChild(input)
        }
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
                        <div className="share-link-selector">
                            <button
                                className={`level-tab ${linkLevel === 'view' ? 'active' : ''}`}
                                onClick={() => setLinkLevel('view')}
                            >
                                View Link
                            </button>
                            <button
                                className={`level-tab ${linkLevel === 'edit' ? 'active' : ''}`}
                                onClick={() => setLinkLevel('edit')}
                            >
                                Edit Link
                            </button>
                        </div>
                        <div className="share-link-box">
                            <input
                                type="text"
                                readOnly
                                value={getShareUrl() || 'Generating link...'}
                                className="share-link-input"
                                placeholder="Generating shareable link..."
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
                    <button className="secondary-btn" onClick={onClose} disabled={isLoading}>Cancel</button>
                    <button className="primary-btn" onClick={handleSave} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ShareModal
