const isTermux = process.env.PREFIX && process.env.PREFIX.includes('com.termux');

// Common environment variables
const commonEnv = {
    NODE_ENV: "production",
    // These will be overridden by deploy_runner.sh or shell exports
    TEXMFROOT: process.env.TEXMFROOT || '/data/data/com.termux/files/usr/share/texlive/2025.0',
    TEXMFDIST: process.env.TEXMFDIST || '/data/data/com.termux/files/usr/share/texlive/2025.0/texmf-dist',
    TEXMFLOCAL: process.env.TEXMFLOCAL || '/data/data/com.termux/files/usr/share/texlive/texmf-local',
    TEXMFSYSVAR: process.env.TEXMFSYSVAR || '/data/data/com.termux/files/usr/share/texlive/2025.0/texmf-var',
    TEXMFSYSCONFIG: process.env.TEXMFSYSCONFIG || '/data/data/com.termux/files/usr/share/texlive/2025.0/texmf-config',
    PERL5LIB: process.env.PERL5LIB || '',
    PATH: process.env.PATH
};

module.exports = {
    apps: [
        {
            name: "latex-backend",
            script: "./server/index.js",
            cwd: "./",
            env: {
                ...commonEnv,
                PORT: 3000
            },
            autorestart: true,
            max_memory_restart: "1G",
            out_file: "./logs/backend-out.log",
            error_file: "./logs/backend-err.log",
            merge_logs: true
        },
        {
            name: "latex-frontend",
            // We use a simple node script to serve the frontend separately
            // so the user can manage it as a separate PM2 process
            script: "npx",
            args: "serve -s client/dist -l 3001",
            cwd: "./",
            env: {
                NODE_ENV: "production"
            },
            autorestart: true,
            out_file: "./logs/frontend-out.log",
            error_file: "./logs/frontend-err.log",
            merge_logs: true
        }
    ]
};
