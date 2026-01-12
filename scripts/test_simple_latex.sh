#!/bin/bash
# A minimal test script that relies purely on the system environment

echo "Checking pdflatex in PATH..."
which pdflatex
pdflatex --version | head -n 1

WORK_DIR=$(mktemp -d)
cd "$WORK_DIR"
echo "Working in $WORK_DIR"

cat > test.tex <<EOF
\documentclass{article}
\begin{document}
Simple Test.
\end{document}
EOF

echo "Running: pdflatex -interaction=nonstopmode test.tex"
pdflatex -interaction=nonstopmode test.tex > compile.log 2>&1

if [ -f "test.pdf" ]; then
    echo "🎉 SUCCESS"
else
    echo "❌ FAILED"
    cat compile.log
fi

cd ..
rm -rf "$WORK_DIR"
