module.exports = {
    apps: [{
        name: "latex-api",
        script: "./server/index.js",
        env: {
            NODE_ENV: "production",
            PORT: 3000,
            // Paths will be injected by the deploy script or found at runtime
        },
        autorestart: true,
        max_memory_restart: "1G",
        out_file: "./logs/api-out.log",
        error_file: "./logs/api-err.log",
        merge_logs: true
    }]
}
