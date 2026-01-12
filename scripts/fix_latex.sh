#!/bin/bash
echo "🔧 Starting LaTeX Environment Repair..."

# 1. Force install texlive (Skip if already checking/debugging)
# pkg install -y texlive

# 2. Source the improved detection logic
setup_latex_env() {
    export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
    
    # Reset variables
    unset TEXMFROOT
    unset TEXMFDIST
    unset PERL5LIB
    
    echo "🔍 probing TeX Live paths..."
    
    if command -v kpsewhich &> /dev/null; then
        export TEXMFROOT=$(kpsewhich -var-value=TEXMFROOT)
        export TEXMFDIST=$(kpsewhich -var-value=TEXMFDIST)
        echo "   Found via kpsewhich: $TEXMFROOT"
    else
        TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
        if [ -d "$TEXLIVE_BASE" ]; then
            # Find the latest year directory that actually contains texmf-dist
            # Prioritize directories that are NOT .0 if possible, or just check content
            for YEAR_DIR in $(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r); do
                CANDIDATE="$TEXLIVE_BASE/$YEAR_DIR"
                if [ -d "$CANDIDATE/texmf-dist" ]; then
                    echo "   ✅ Found valid TeX root: $CANDIDATE"
                    TL_YEAR="$YEAR_DIR"
                    export TEXMFROOT="$CANDIDATE"
                    export TEXMFDIST="$CANDIDATE/texmf-dist"
                    break
                else
                    echo "   ⚠️  Skipping empty/invalid dir: $CANDIDATE"
                fi
            done
        fi
    fi

    if [ -n "$TEXMFROOT" ]; then
        MKTEXLSR_PATH=$(find "$TEXMFROOT" "$TEXMFDIST" -name "mktexlsr.pl" 2>/dev/null | head -n 1)
        if [ -n "$MKTEXLSR_PATH" ]; then
            MKTEXLSR_DIR=$(dirname "$MKTEXLSR_PATH")
            export PERL5LIB="$TEXMFROOT/tlpkg:$MKTEXLSR_DIR"
            echo "✅ PERL5LIB set to: $PERL5LIB"
        else
            echo "❌ Could not find mktexlsr.pl inside $TEXMFROOT"
        fi
    else
        echo "❌ Could not verify TEXMFROOT"
    fi
}

setup_latex_env

# 3. Rebuild formats
echo "⚙️  Rebuilding formats (this might take a minute)..."
fmtutil-sys --all || fmtutil --all

# 4. Verify
echo "🔍 Verification:"
pdflatex --version | head -n 1
kpsewhich pdflatex.fmt
