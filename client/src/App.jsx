import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './components/Toast/Toast'
import { ConfirmProvider } from './components/ConfirmDialog/ConfirmDialog'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login/Login'
import Home from './pages/Home/Home'
import EditorPage from './pages/Editor/EditorPage'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    <ConfirmProvider>
                        <Routes>
                            {/* Public routes */}
                            <Route path="/login" element={<Login />} />

                            {/* Protected routes */}
                            <Route
                                path="/"
                                element={
                                    <ProtectedRoute>
                                        <Home />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/editor/:projectId"
                                element={
                                    <ProtectedRoute>
                                        <EditorPage />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Fallback - redirect to home */}
                            <Route path="*" element={<Login />} />
                        </Routes>
                    </ConfirmProvider>
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App
