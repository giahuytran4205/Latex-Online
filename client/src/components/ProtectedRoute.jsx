import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <span>Loading...</span>
            </div>
        )
    }

    if (!isAuthenticated) {
        // Redirect to login, but save the attempted URL
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return children
}

export default ProtectedRoute
