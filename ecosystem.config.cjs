module.exports = {
    apps: [{
        name: "latex-online-server",
        script: "./server/index.js",
        env: {
            NODE_ENV: "production",
            PORT: 3000,
            // Ensure Termux paths are preserved
            PATH: "/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:" + process.env.PATH,
            TEXMFROOT: '/data/data/com.termux/files/usr/share/texlive/2025.0',
            TEXMFDIST: '/data/data/com.termux/files/usr/share/texlive/2025.0/texmf-dist',
            TEXMFLOCAL: '/data/data/com.termux/files/usr/share/texlive/texmf-local',
        },
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        out_file: "./server.log",
        error_file: "./server.log",
        merge_logs: true
    }]
}
