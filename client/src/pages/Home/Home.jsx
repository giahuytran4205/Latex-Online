import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
    getProjects,
    createProject,
    deleteProject,
    duplicateProject,
    getUserStorageInfo
} from '../../services/api'
import './Home.css'

function Home() {
    const { user, userProfile, logout } = useAuth()
    const navigate = useNavigate()
    const [projects, setProjects] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [showNewProjectModal, setShowNewProjectModal] = useState(false)
    const [newProjectName, setNewProjectName] = useState('')
    const [newProjectTemplate, setNewProjectTemplate] = useState('blank')
    const [isCreating, setIsCreating] = useState(false)
    const [storageInfo, setStorageInfo] = useState({ used: 0, limit: 100 * 1024 * 1024 })
    const [contextMenu, setContextMenu] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('updatedAt')
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('latex-theme') || 'dark'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('latex-theme', theme)
    }, [theme])

    useEffect(() => {
        loadProjects()
        loadStorageInfo()
    }, [user])

    const loadProjects = async () => {
        try {
            setIsLoading(true)
            const data = await getProjects()
            setProjects(data.projects || [])
        } catch (error) {
            console.error('Failed to load projects:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const loadStorageInfo = async () => {
        try {
            const info = await getUserStorageInfo()
            setStorageInfo({
                used: info.used || 0,
                limit: userProfile?.storageLimit || info.limit || 100 * 1024 * 1024
            })
        } catch (error) {
            console.error('Failed to load storage info:', error)
        }
    }

    const handleCreateProject = async (e) => {
        e.preventDefault()
        if (!newProjectName.trim()) return

        setIsCreating(true)
        try {
            const result = await createProject(newProjectName.trim(), newProjectTemplate)
            if (result.success) {
                setShowNewProjectModal(false)
                setNewProjectName('')
                setNewProjectTemplate('blank')
                navigate(`/editor/${result.projectId}`)
            }
        } catch (error) {
            alert('Failed to create project: ' + error.message)
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteProject = async (projectId, projectName) => {
        if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
            return
        }

        try {
            await deleteProject(projectId)
            await loadProjects()
            await loadStorageInfo()
        } catch (error) {
            alert('Failed to delete project: ' + error.message)
        }
    }

    const handleDuplicateProject = async (projectId) => {
        try {
            const result = await duplicateProject(projectId)
            if (result.success) {
                await loadProjects()
                await loadStorageInfo()
            }
        } catch (error) {
            alert('Failed to duplicate project: ' + error.message)
        }
    }

    const handleContextMenu = (e, project) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            project
        })
    }

    const closeContextMenu = () => setContextMenu(null)

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const formatDate = (date) => {
        const d = new Date(date)
        const now = new Date()
        const diff = now - d

        if (diff < 60000) return 'Just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`

        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const filteredProjects = projects
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            if (sortBy === 'updatedAt') return new Date(b.updatedAt) - new Date(a.updatedAt)
            if (sortBy === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt)
            return 0
        })

    const storagePercentage = Math.min(100, (storageInfo.used / storageInfo.limit) * 100)

    return (
        <div className="home-page" onClick={closeContextMenu}>
            {/* Header */}
            <header className="home-header">
                <div className="home-header__left">
                    <div className="home-logo">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <path d="M9 15l2 2 4-4" />
                        </svg>
                        <span>LaTeX Online</span>
                    </div>
                </div>

                <div className="home-header__right">
                    <button
                        className="btn btn--icon"
                        title="Toggle Theme"
                        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                    >
                        {theme === 'dark' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>

                    <div className="user-menu">
                        <div className="user-avatar">
                            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="user-info">
                            <span className="user-name">{userProfile?.displayName || user?.email}</span>
                            <span className="user-email">{user?.email}</span>
                        </div>
                        <button className="btn btn--secondary btn--sm" onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="home-main">
                {/* Sidebar */}
                <aside className="home-sidebar">
                    <button
                        className="btn btn--primary btn--new-project"
                        onClick={() => setShowNewProjectModal(true)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        New Project
                    </button>

                    <nav className="home-nav">
                        <a href="#" className="home-nav__item home-nav__item--active">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                            All Projects
                            <span className="badge">{projects.length}</span>
                        </a>
                        {/* Future: Shared with me, Trash, etc */}
                    </nav>

                    <div className="storage-info">
                        <div className="storage-info__header">
                            <span>Storage</span>
                            <span>{formatBytes(storageInfo.used)} / {formatBytes(storageInfo.limit)}</span>
                        </div>
                        <div className="storage-bar">
                            <div
                                className={`storage-bar__fill ${storagePercentage > 90 ? 'danger' : storagePercentage > 70 ? 'warning' : ''}`}
                                style={{ width: `${storagePercentage}%` }}
                            />
                        </div>
                    </div>
                </aside>

                {/* Projects Grid */}
                <div className="home-content">
                    <div className="home-content__header">
                        <h1>Your Projects</h1>
                        <div className="home-content__actions">
                            <div className="search-box">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <select
                                className="sort-select"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="updatedAt">Last Modified</option>
                                <option value="createdAt">Date Created</option>
                                <option value="name">Name</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="projects-loading">
                            <div className="spinner"></div>
                            <span>Loading projects...</span>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="projects-empty">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <h2>No projects yet</h2>
                            <p>Create your first LaTeX project to get started</p>
                            <button
                                className="btn btn--primary"
                                onClick={() => setShowNewProjectModal(true)}
                            >
                                Create Project
                            </button>
                        </div>
                    ) : (
                        <div className="projects-grid">
                            {filteredProjects.map(project => (
                                <div
                                    key={project.id}
                                    className="project-card"
                                    onClick={() => navigate(`/editor/${project.id}`)}
                                    onContextMenu={(e) => handleContextMenu(e, project)}
                                >
                                    <div className="project-card__preview">
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                        </svg>
                                    </div>
                                    <div className="project-card__info">
                                        <h3 className="project-card__name">{project.name}</h3>
                                        <span className="project-card__date">
                                            {formatDate(project.updatedAt)}
                                        </span>
                                    </div>
                                    <div className="project-card__actions">
                                        <button
                                            className="btn btn--icon btn--sm"
                                            title="More actions"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleContextMenu(e, project)
                                            }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="1" />
                                                <circle cx="12" cy="5" r="1" />
                                                <circle cx="12" cy="19" r="1" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="modal-overlay" onClick={() => setShowNewProjectModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal__header">
                            <h2>Create New Project</h2>
                            <button
                                className="btn btn--icon"
                                onClick={() => setShowNewProjectModal(false)}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateProject}>
                            <div className="modal__body">
                                <div className="form-group">
                                    <label htmlFor="projectName">Project Name</label>
                                    <input
                                        type="text"
                                        id="projectName"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder="My LaTeX Project"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Template</label>
                                    <div className="template-options">
                                        <label className={`template-option ${newProjectTemplate === 'blank' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="template"
                                                value="blank"
                                                checked={newProjectTemplate === 'blank'}
                                                onChange={(e) => setNewProjectTemplate(e.target.value)}
                                            />
                                            <div className="template-option__content">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                                <span>Blank Document</span>
                                            </div>
                                        </label>
                                        <label className={`template-option ${newProjectTemplate === 'article' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="template"
                                                value="article"
                                                checked={newProjectTemplate === 'article'}
                                                onChange={(e) => setNewProjectTemplate(e.target.value)}
                                            />
                                            <div className="template-option__content">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                    <line x1="16" y1="13" x2="8" y2="13" />
                                                    <line x1="16" y1="17" x2="8" y2="17" />
                                                </svg>
                                                <span>Article</span>
                                            </div>
                                        </label>
                                        <label className={`template-option ${newProjectTemplate === 'report' ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="template"
                                                value="report"
                                                checked={newProjectTemplate === 'report'}
                                                onChange={(e) => setNewProjectTemplate(e.target.value)}
                                            />
                                            <div className="template-option__content">
                                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                                </svg>
                                                <span>Report</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal__footer">
                                <button
                                    type="button"
                                    className="btn btn--secondary"
                                    onClick={() => setShowNewProjectModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn--primary"
                                    disabled={isCreating || !newProjectName.trim()}
                                >
                                    {isCreating ? 'Creating...' : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="context-menu-overlay" onClick={closeContextMenu} />
                    <div
                        className="context-menu"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button onClick={() => {
                            navigate(`/editor/${contextMenu.project.id}`)
                            closeContextMenu()
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Open
                        </button>
                        <button onClick={() => {
                            handleDuplicateProject(contextMenu.project.id)
                            closeContextMenu()
                        }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Duplicate
                        </button>
                        <div className="context-menu__divider"></div>
                        <button
                            className="danger"
                            onClick={() => {
                                handleDeleteProject(contextMenu.project.id, contextMenu.project.name)
                                closeContextMenu()
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default Home
