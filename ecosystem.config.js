const fs = require('fs');
const path = require('path');

// Dynamic TeX Live Path Detection
function getTexEnv() {
    const texBase = '/data/data/com.termux/files/usr/share/texlive';
    const usrBin = '/data/data/com.termux/files/usr/bin';
    let env = {
        PATH: `${usrBin}:${usrBin}/texlive:${process.env.PATH || ''}`
    };

    try {
        let bestRoot = null;

        // 1. Try to find explicitly correct directory
        if (fs.existsSync(texBase)) {
            const dirs = fs.readdirSync(texBase).sort().reverse();
            for (const dir of dirs) {
                // Skip suspiciously explicitly bad names if possible, but trust content check
                const match = dir.match(/^(\d{4})(\.\d+)?$/);
                if (match) {
                    const candidate = path.join(texBase, dir);
                    // CRITICAL: verify mktexlsr.pl exists here
                    const mktexlsr = path.join(candidate, 'texmf-dist/scripts/texlive/mktexlsr.pl');
                    if (fs.existsSync(mktexlsr)) {
                        console.log(`[PM2] Validated TeX Root: ${candidate}`);
                        bestRoot = candidate;
                        break;
                    }
                }
            }
        }

        // 2. Fallback to hardcoded '2025' if detection failed but it exists
        if (!bestRoot && fs.existsSync(path.join(texBase, '2025/texmf-dist'))) {
            bestRoot = path.join(texBase, '2025');
            console.log(`[PM2] Using fallback TeX Root: ${bestRoot}`);
        }

        // 3. Set Envs if found
        if (bestRoot) {
            env.TEXMFROOT = bestRoot;
            env.TEXMFDIST = path.join(bestRoot, 'texmf-dist');
            env.TEXMFLOCAL = path.join(bestRoot, 'texmf-local');
            env.TEXMFSYSVAR = path.join(bestRoot, 'texmf-var');
            env.TEXMFSYSCONFIG = path.join(bestRoot, 'texmf-config');

            const tlPkg = path.join(bestRoot, 'tlpkg');
            const scriptPath = path.join(bestRoot, 'texmf-dist/scripts/texlive');
            env.PERL5LIB = `${tlPkg}:${scriptPath}`;
        } else {
            console.warn('[PM2] WARNING: No valid TeX Live root found!');
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
    }, {
        name: "latex-watcher",
        script: "bash",
        args: "./scripts/git-watcher.sh",
        autorestart: true,
        cwd: "./",
        out_file: "./logs/watcher-out.log",
        error_file: "./logs/watcher-err.log"
    }]
}
