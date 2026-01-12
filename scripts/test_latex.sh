#!/bin/bash

# --- CONFIGURATION FROM DEPLOY SCRIPT ---
export PATH="/data/data/com.termux/files/usr/bin:/data/data/com.termux/files/usr/bin/texlive:$PATH"
export LC_ALL=C

# Dynamic TeX Live Detection
TEXLIVE_BASE="/data/data/com.termux/files/usr/share/texlive"
if [ -d "$TEXLIVE_BASE" ]; then
    for YEAR_DIR in $(ls "$TEXLIVE_BASE" 2>/dev/null | grep -E "^20[0-9]{2}" | sort -r); do
        if [ -d "$TEXLIVE_BASE/$YEAR_DIR/texmf-dist" ]; then
            echo "✅ Found valid TeX Live version: $YEAR_DIR"
            export TEXMFROOT="$TEXLIVE_BASE/$YEAR_DIR"
            export TEXMFDIST="$TEXMFROOT/texmf-dist"
            export PERL5LIB="$TEXMFROOT/tlpkg:$TEXMFDIST/scripts/texlive"
            break
        fi
    done
    
    if [ -z "$TEXMFROOT" ]; then
        echo "⚠️  TeX Live found but no valid version directory detected."
    fi
else
    echo "⚠️  TeX Live base directory not found at $TEXLIVE_BASE"
fi

echo "🔍 Checking pdflatex..."
if command -v pdflatex &> /dev/null; then
    echo "✅ pdflatex found at: $(which pdflatex)"
    pdflatex --version | head -n 1
else
    echo "❌ pdflatex NOT found in PATH"
    echo "Current PATH: $PATH"
fi

# --- TEST COMPILATION ---
WORK_DIR=$(mktemp -d)
cd "$WORK_DIR"
echo "📂 Working in temp directory: $WORK_DIR"

echo "📝 Creating test.tex..."
cat > test.tex <<EOF
\documentclass{article}
\begin{document}
Hello World from Termux LaTeX!
\end{document}
EOF

echo "⚙️  Compiling..."
pdflatex -interaction=nonstopmode test.tex > compile.log 2>&1

if [ -f "test.pdf" ]; then
    echo "🎉 SUCCESS: PDF generated successfully!"
    ls -lh test.pdf
else
    echo "❌ FAILURE: PDF was not generated."
    echo "--- COMPILATION LOG ---"
    cat compile.log
    echo "-----------------------"
fi

# Cleanup
cd ..
rm -rf "$WORK_DIR"
