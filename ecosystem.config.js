module.exports = {
    apps: [{
        name: "latex-api",
        script: "./server/index.js",
        env: {
            NODE_ENV: "production",
            PORT: 3005,
            // Force Termux paths to be available to the process
            PATH: "/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:" + process.env.PATH
        },
        autorestart: true,
        max_memory_restart: "1G",
        out_file: "./logs/api-out.log",
        error_file: "./logs/api-err.log",
        merge_logs: true
    }]
}
