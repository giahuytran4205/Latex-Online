# LaTeX Online Editor

A collaborative LaTeX editor similar to Overleaf, optimized for hosting on Termux (Android).

## Features

- 📝 **CodeMirror 6 Editor** - LaTeX syntax highlighting, auto-indentation
- 🔄 **Real-time Collaboration** - Yjs CRDT-based, see others' cursors
- 📄 **PDF Preview** - Powered by PDF.js with zoom and navigation
- 🎨 **Theme Support** - Dark, Light, or System preference
- ⚡ **Multiple Engines** - pdflatex, xelatex, lualatex
- 📱 **Mobile Responsive** - Works on phone browsers

## Quick Start

### Prerequisites

- Node.js 18+
- TeX Live (pdflatex, xelatex, lualatex)

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
| Editor | CodeMirror 6 + y-codemirror.next |
| Collaboration | Yjs + y-websocket |
| PDF Viewer | PDF.js |
| Backend | Node.js + Express |
| LaTeX | TeX Live (pdflatex/xelatex/lualatex) |

## Project Structure

```
latex-online/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── services/    # API client
│   │   └── App.jsx      # Main app
│   └── package.json
├── server/              # Express backend
│   ├── routes/          # API routes
│   ├── services/        # LaTeX compiler
│   └── index.js         # Server entry
└── README.md
```

## License

MIT
