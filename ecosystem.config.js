const fs = require('fs');
const path = require('path');

// Dynamic TeX Live Path Detection
function getTexEnv() {
    const texBase = '/data/data/com.termux/files/usr/share/texlive';
    const usrBin = '/data/data/com.termux/files/usr/bin';
    let env = {
        PATH: `${usrBin}:${usrBin}/texlive:${process.env.PATH}`
    };

    try {
        if (fs.existsSync(texBase)) {
            const dirs = fs.readdirSync(texBase).sort().reverse();
            for (const dir of dirs) {
                if (dir.match(/^\d{4}$/) || dir.match(/^\d{4}\.\d+$/)) {
                    const candidate = path.join(texBase, dir);
                    // Check if critical subdirs exist
                    if (fs.existsSync(path.join(candidate, 'texmf-dist'))) {
                        const texRoot = candidate;
                        const texDist = path.join(texRoot, 'texmf-dist');
                        const tlPkg = path.join(texRoot, 'tlpkg');

                        // Valid Root Found
                        env.TEXMFROOT = texRoot;
                        env.TEXMFDIST = texDist;

                        // Find mktexlsr.pl for PERL5LIB
                        // Usually at texmf-dist/scripts/texlive/mktexlsr.pl
                        const scriptPath = path.join(texDist, 'scripts/texlive');
                        env.PERL5LIB = `${tlPkg}:${scriptPath}`;

                        console.log(`[PM2] Found TeX Live at ${texRoot}`);
                        break;
                    }
                }
            }
        }
    } catch (e) {
        console.error('[PM2] Error detecting TeX paths:', e);
    }
    return env;
}

const texEnv = getTexEnv();

module.exports = {
    apps: [{
        name: "latex-api",
        script: "./server/index.js",
        env: {
            NODE_ENV: "production",
            PORT: 3005,
            ...texEnv
        },
        autorestart: true,
        max_memory_restart: "1G",
        out_file: "./logs/api-out.log",
        error_file: "./logs/api-err.log",
        merge_logs: true
    }]
}
