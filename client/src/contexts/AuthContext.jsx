import { createContext, useContext, useState, useEffect } from 'react'
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

const AuthContext = createContext(null)

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // Set basic user info and stop global loading immediately
            setUser(firebaseUser)
            setLoading(false)

            if (firebaseUser) {
                // Fetch user profile from Firestore in the background
                try {
                    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data())
                    } else {
                        // Default profile if not found
                        setUserProfile({
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                            storageLimit: 100 * 1024 * 1024, // 100MB default
                            role: 'user'
                        })
                    }
                } catch (error) {
                    console.error('Error fetching user profile:', error)
                    setUserProfile({
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        storageLimit: 100 * 1024 * 1024,
                        role: 'user'
                    })
                }
            } else {
                setUserProfile(null)
            }
        })

        return () => unsubscribe()
    }, [])

    const login = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password)
            return { success: true, user: result.user }
        } catch (error) {
            let message = 'Login failed'
            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'No account found with this email'
                    break
                case 'auth/wrong-password':
                    message = 'Incorrect password'
                    break
                case 'auth/invalid-email':
                    message = 'Invalid email address'
                    break
                case 'auth/user-disabled':
                    message = 'This account has been disabled'
                    break
                case 'auth/too-many-requests':
                    message = 'Too many failed attempts. Please try again later'
                    break
                default:
                    message = error.message
            }
            return { success: false, error: message }
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    const value = {
        user,
        userProfile,
        loading,
        login,
        logout,
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
