import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { resolveShareId } from '../../services/api'
import { useToast } from '../../components/Toast/Toast'

function ShareRedirect() {
    const { shareId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()

    useEffect(() => {
        if (!shareId) {
            navigate('/')
            return
        }

        const resolve = async () => {
            try {
                const data = await resolveShareId(shareId)
                // Redirect to editor with shareId in query
                navigate(`/editor/${data.projectId}?sid=${shareId}`, { replace: true })
            } catch (err) {
                toast.error('Invalid or expired share link')
                navigate('/')
            }
        }

        resolve()
    }, [shareId, navigate, toast])

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '20px'
        }}>
            <div className="loading-spinner"></div>
            <p>Resolving share link...</p>
        </div>
    )
}

export default ShareRedirect
