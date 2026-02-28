// Firebase configuration
// Replace these values with your actual Firebase project config
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyCLb2jX1SXv3cyDloxS2ZpI9cM4qh0M_qM",
    authDomain: "latex-online-3d301.firebaseapp.com",
    projectId: "latex-online-3d301",
    storageBucket: "latex-online-3d301.firebasestorage.app",
    messagingSenderId: "733871439444",
    appId: "1:733871439444:web:6ff5dd9c18437c843077c1",
    measurementId: "G-THGZXTGMFR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)

export default app
