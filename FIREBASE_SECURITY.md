# Firebase Security Setup Guide

## 1. Restrict API Key (Recommended)

Go to Google Cloud Console > APIs & Services > Credentials:

1. Find your Firebase API key
2. Click Edit
3. Under "Application restrictions":
   - Select "HTTP referrers (websites)"
   - Add your domains:
     - `localhost:*` (for development)
     - `yourdomain.com/*` (for production)
4. Under "API restrictions":
   - Select "Restrict key"
   - Only enable: Firebase Auth API, Cloud Firestore API

## 2. Firestore Security Rules

In Firebase Console > Firestore > Rules, use:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - only own document
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only admin can write
    }
    
    // Projects collection (if using Firestore for projects)
    match /projects/{projectId} {
      allow read, write: if request.auth != null 
        && resource.data.owner == request.auth.uid;
    }
  }
}
```

## 3. Authentication Settings

In Firebase Console > Authentication > Settings:

1. **Authorized domains**: Only add your actual domains
2. **User account linking**: Enable "Link accounts that use the same email"

## 4. Disable Self-Registration

Since you want admin-only user creation:
- Don't expose any signup form in your app ✅ (already done)
- Create users only through Firebase Console

## 5. Monitor Usage

In Firebase Console > Usage and Billing:
- Set up budget alerts
- Monitor Authentication, Firestore, and API usage

---

**Remember**: The client-side Firebase config (API key, project ID, etc.) is designed to be public. 
Security comes from Firebase Security Rules and Authentication, NOT from hiding the config.
