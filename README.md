# LaTeX Online Editor

A collaborative LaTeX editor similar to Overleaf, with user authentication and project management.

## Features

- 🔐 **User Authentication** - Firebase Auth for secure login
- 📁 **Project Management** - Create, duplicate, delete, and organize projects
- 📝 **CodeMirror 6 Editor** - LaTeX syntax highlighting, auto-indentation
- 🔄 **Real-time Collaboration** - Yjs CRDT-based, see others' cursors
- 📄 **PDF Preview** - Native browser PDF viewer with interactive links
- 🎨 **Theme Support** - Dark, Light, or System preference
- ⚡ **Multiple Engines** - pdflatex, xelatex, lualatex
- 📱 **Mobile Responsive** - Works on phone browsers
- 💾 **Storage Limits** - Per-user storage quotas defined in Firebase

## Quick Start

### Prerequisites

- Node.js 18+
- TeX Live (pdflatex, xelatex, lualatex)
- Firebase project (for authentication)

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Email/Password** authentication in Authentication > Sign-in method
3. Create a Firestore database
4. Get your Firebase config from Project Settings > General > Your apps

**Firestore Structure for User Limits:**
```
users/
  {userId}/
    email: "user@example.com"
    displayName: "User Name"
    storageLimit: 104857600  // 100MB in bytes
    role: "user"
```

5. Copy `client/.env.example` to `client/.env.local` and fill in your Firebase config:
```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies  
cd ../client
npm install
```

### Development

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start client
cd client  
npm run dev

# Open http://localhost:5173
```

### Production Build

```bash
# Build client
cd client
npm run build

# Start server (serves built client)
cd ../server
npm start

# Open http://localhost:3000
```

## Creating User Accounts

Since registration is disabled, you need to create users manually:

1. Go to Firebase Console > Authentication > Users
2. Click "Add user"
3. Enter email and password
4. (Optional) Add user data in Firestore at `users/{userId}` with:
   - `email`: User's email
   - `displayName`: Display name
   - `storageLimit`: Storage limit in bytes (default: 100MB)
   - `role`: "user" or "admin"

## Termux Setup (Android)

```bash
# 1. Install Termux from F-Droid (not Play Store)

# 2. Update packages
pkg update && pkg upgrade

# 3. Install dependencies
pkg install nodejs-lts texlive-full git

# 4. Clone and setup
git clone <your-repo> latex-online
cd latex-online

# 5. Install and build
cd server && npm install
cd ../client && npm install && npm run build

# 6. Run
cd ../server && npm start

# 7. Access from browser
# http://localhost:3000
# Or access from other devices on same network:
# http://<your-phone-ip>:3000
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite |
| Auth | Firebase Auth |
| Database | Firebase Firestore |
| Editor | CodeMirror 6 + y-codemirror.next |
| Collaboration | Yjs + y-websocket |
| PDF Viewer | Browser Native (iframe) |
| Backend | Node.js + Express |
| LaTeX | TeX Live (pdflatex/xelatex/lualatex) |

## Project Structure

```
latex-online/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── config/          # Firebase config
│   │   ├── contexts/        # Auth context
│   │   ├── pages/           # Page components
│   │   │   ├── Login/       # Login page
│   │   │   ├── Home/        # Project dashboard
│   │   │   └── Editor/      # LaTeX editor
│   │   ├── services/        # API client
│   │   └── App.jsx          # Router & app
│   ├── .env.example         # Environment template
│   └── package.json
├── server/                  # Express backend
│   ├── routes/              # API routes
│   │   ├── compile.js       # LaTeX compilation
│   │   ├── files.js         # File operations
│   │   └── projects.js      # Project management
│   ├── services/            # LaTeX compiler
│   └── index.js             # Server entry
├── projects/                # User projects storage
│   └── {userId}/
│       └── {projectId}/
└── README.md
```

## API Endpoints

### Authentication
All endpoints (except PDF serving) require Bearer token in Authorization header.

### Projects
- `GET /api/projects` - List user's projects
- `GET /api/projects/:id` - Get project info
- `POST /api/projects` - Create new project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/duplicate` - Duplicate project
- `POST /api/projects/:id/share` - Share project (placeholder)

### Files
- `GET /api/files/:projectId` - List project files
- `GET /api/files/:projectId/:filename` - Get file content
- `PUT /api/files/:projectId/:filename` - Save file
- `POST /api/files/:projectId` - Create file/folder
- `DELETE /api/files/:projectId/:filename` - Delete file

### Compilation
- `POST /api/compile` - Compile LaTeX project

## License

MIT
