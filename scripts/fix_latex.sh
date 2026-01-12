#!/bin/bash
echo "🔧 Starting LaTeX Environment Repair (Aggressive Mode)..."

# Function to check if a directory looks like a valid TexLive root
is_valid_root() {
    if [ -d "$1/texmf-dist" ] && [ -d "$1/tlpkg" ]; then
        return 0
    else
        return 1
    fi
}

# 1. SEARCH FOR VALID ROOT
echo "🔍 Searching for valid TeX Live root..."
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
REAL_ROOT=""

# Check manual search first (Trust file system over kpsewhich for now)
if [ -d "$TEXLIVE_BASE" ]; then
    # Sort to ensure we check all likely years
    for YEAR_DIR in $(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r); do
        CANDIDATE="$TEXLIVE_BASE/$YEAR_DIR"
        if is_valid_root "$CANDIDATE"; then
            echo "   ✅ Found valid root on disk: $CANDIDATE"
            REAL_ROOT="$CANDIDATE"
            break
        elif [ -d "$CANDIDATE" ]; then
             echo "   ⚠️  Skipping broken/empty dir: $CANDIDATE"
        fi
    done
fi

# Fallback/Check against kpsewhich
if command -v kpsewhich &> /dev/null; then
    KPSE_ROOT=$(kpsewhich -var-value=TEXMFROOT)
    echo "   ℹ️  kpsewhich reports: $KPSE_ROOT"
    
    # If we haven't found a root yet, try kpsewhich's suggestion
    if [ -z "$REAL_ROOT" ]; then
        if is_valid_root "$KPSE_ROOT"; then
            REAL_ROOT="$KPSE_ROOT"
        else
            echo "   ⚠️  kpsewhich path seems invalid/empty."
        fi
    fi
fi

if [ -z "$REAL_ROOT" ]; then
    echo "❌ CRITICAL: Could not find any valid TeX Live root in $TEXLIVE_BASE"
    echo "   Listing base dir content:"
    ls -l "$TEXLIVE_BASE"
    exit 1
fi

# 2. EXPORT PATHS
export TEXMFROOT="$REAL_ROOT"
export TEXMFDIST="$REAL_ROOT/texmf-dist"
export TEXMFLOCAL="$REAL_ROOT/texmf-local"
export TEXMFSYSVAR="$REAL_ROOT/texmf-var"
export TEXMFSYSCONFIG="$REAL_ROOT/texmf-config"

echo "   Exported TEXMFROOT=$TEXMFROOT"

# 3. SETUP PERL5LIB
echo "🔍 configuring perl libraries..."
MKTEXLSR_PATH=$(find "$TEXMFROOT" "$TEXMFDIST" -name "mktexlsr.pl" 2>/dev/null | head -n 1)

if [ -z "$MKTEXLSR_PATH" ]; then 
    echo "   ⚠️  mktexlsr.pl not found in root. Searching global..."
    MKTEXLSR_PATH=$(find /data/data/com.termux/files/usr -name "mktexlsr.pl" 2>/dev/null | head -n 1)
fi

if [ -n "$MKTEXLSR_PATH" ]; then
    MKTEXLSR_DIR=$(dirname "$MKTEXLSR_PATH")
    # Include both tlpkg and the script dir
    export PERL5LIB="$TEXMFROOT/tlpkg:$MKTEXLSR_DIR"
    echo "   ✅ Found $MKTEXLSR_PATH"
    echo "   ✅ PERL5LIB=$PERL5LIB"
else
    echo "❌ FATAL: Could not find mktexlsr.pl anywhere."
fi

# 4. FIX FORMATS
echo "⚙️  Rebuilding formats..."
# We explicitly pass the environment variables to fmtutil
fmtutil-sys --all --cnffile "$TEXMFDIST/web2c/fmtutil.cnf" > fmt.log 2>&1

if [ $? -eq 0 ]; then
    echo "🎉 SUCCESS: Formats rebuilt!"
    kpsewhich pdflatex.fmt
else
    echo "❌ FAILURE: fmtutil-sys failed."
    echo "--- LAST 20 LINES OF LOG ---"
    tail -n 20 fmt.log
    echo "----------------------------"
    
    # Emergency fallback
    echo "⚠️ Trying fallback manual format generation..."
    pdflatex -ini -jobname=pdflatex -progname=pdflatex -etex pdflatex.ini > fallback.log 2>&1
    if [ $? -eq 0 ]; then
         echo "   ✅ Manual partial generation worked? (Unlikely to be fully functional but trying)"
    fi
fi
