#!/bin/bash
echo "🔧 Starting LaTeX Environment Repair..."

# 1. Check/Install binaries
echo "📦 Checking TeX Live binaries..."
if command -v pdflatex &> /dev/null; then
    echo "✅ pdflatex is already installed."
else
    echo "⚠️  pdflatex not found. Installing texlive-bin..."
    pkg install -y texlive-bin
fi

# 2. Source the improved detection logic
setup_latex_env() {
    export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
    
    # Reset variables
    unset TEXMFROOT
    unset TEXMFDIST
    unset PERL5LIB
    
    echo "🔍 probing TeX Live paths..."
    
    if command -v kpsewhich &> /dev/null; then
        VAL_ROOT=$(kpsewhich -var-value=TEXMFROOT)
        VAL_DIST=$(kpsewhich -var-value=TEXMFDIST)
        if [ -n "$VAL_ROOT" ]; then
            export TEXMFROOT="$VAL_ROOT"
            export TEXMFDIST="$VAL_DIST"
            echo "   ✅ Found via kpsewhich: $TEXMFROOT"
        fi
    fi
    
    # If kpsewhich failed or gave empty results, search manually
    if [ -z "$TEXMFROOT" ]; then
        TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
        if [ -d "$TEXLIVE_BASE" ]; then
            for YEAR_DIR in $(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r); do
                CANDIDATE="$TEXLIVE_BASE/$YEAR_DIR"
                if [ -d "$CANDIDATE/texmf-dist" ]; then
                    echo "   ✅ Found valid TeX root: $CANDIDATE"
                    export TEXMFROOT="$CANDIDATE"
                    export TEXMFDIST="$CANDIDATE/texmf-dist"
                    break
                fi
            done
        fi
    fi

    # CRITICAL: Fix Perl Library Paths
    if [ -n "$TEXMFROOT" ]; then
        # Find where mktexlsr.pl actually is
        # It's usually in texmf-dist/scripts/texlive/mktexlsr.pl
        MKTEXLSR_PATH=$(find "$TEXMFROOT" "$TEXMFDIST" -name "mktexlsr.pl" 2>/dev/null | head -n 1)
        
        if [ -n "$MKTEXLSR_PATH" ]; then
            MKTEXLSR_DIR=$(dirname "$MKTEXLSR_PATH")
            # We also need 'tlpkg' which is often in TEXMFROOT/tlpkg
            export PERL5LIB="$TEXMFROOT/tlpkg:$MKTEXLSR_DIR"
            echo "✅ PERL5LIB set to: $PERL5LIB"
        else
            echo "❌ Could not find mktexlsr.pl inside $TEXMFROOT"
            echo "   Trying global search..."
            MKTEXLSR_PATH=$(find /data/data/com.termux/files/usr -name "mktexlsr.pl" 2>/dev/null | head -n 1)
            if [ -n "$MKTEXLSR_PATH" ]; then
                 MKTEXLSR_DIR=$(dirname "$MKTEXLSR_PATH")
                 export PERL5LIB="$MKTEXLSR_DIR"
                 echo "   ✅ Found at $MKTEXLSR_PATH, PERL5LIB=$PERL5LIB"
            fi
        fi
    else
        echo "❌ Could not verify TEXMFROOT"
    fi
}

setup_latex_env

# 3. Test Dependencies
echo "🔍 Checking missing dependencies..."
if ! command -v touch &> /dev/null; then pkg install -y coreutils; fi

# 4. Rebuild formats
echo "⚙️  Rebuilding formats..."
# Capture output to see error if it fails
fmtutil-sys --all > fmt.log 2>&1 || fmtutil --all > fmt.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Formats built successfully."
else
    echo "❌ Format build failed. Log:"
    cat fmt.log | tail -n 20
fi

# 5. Final Verify
echo "🔍 Final Verification:"
pdflatex --version | head -n 1
kpsewhich pdflatex.fmt
