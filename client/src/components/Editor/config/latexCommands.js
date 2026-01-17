/**
 * LaTeX autocomplete commands and environments data
 */

// LaTeX commands for autocomplete
export const latexCommands = [
    // Document structure
    { label: '\\documentclass', type: 'keyword', info: 'Define document class', apply: '\\documentclass{article}' },
    { label: '\\usepackage', type: 'keyword', info: 'Import package', apply: '\\usepackage{}' },
    { label: '\\begin', type: 'keyword', info: 'Begin environment', apply: '\\begin{}' },
    { label: '\\end', type: 'keyword', info: 'End environment', apply: '\\end{}' },
    { label: '\\title', type: 'keyword', info: 'Document title', apply: '\\title{}' },
    { label: '\\author', type: 'keyword', info: 'Document author', apply: '\\author{}' },
    { label: '\\date', type: 'keyword', info: 'Document date', apply: '\\date{}' },
    { label: '\\maketitle', type: 'keyword', info: 'Render title' },

    // Sections
    { label: '\\section', type: 'function', info: 'Section heading', apply: '\\section{}' },
    { label: '\\subsection', type: 'function', info: 'Subsection heading', apply: '\\subsection{}' },
    { label: '\\subsubsection', type: 'function', info: 'Subsubsection', apply: '\\subsubsection{}' },
    { label: '\\paragraph', type: 'function', info: 'Paragraph heading', apply: '\\paragraph{}' },
    { label: '\\chapter', type: 'function', info: 'Chapter heading', apply: '\\chapter{}' },

    // Text formatting
    { label: '\\textbf', type: 'function', info: 'Bold text', apply: '\\textbf{}' },
    { label: '\\textit', type: 'function', info: 'Italic text', apply: '\\textit{}' },
    { label: '\\underline', type: 'function', info: 'Underlined text', apply: '\\underline{}' },
    { label: '\\emph', type: 'function', info: 'Emphasized text', apply: '\\emph{}' },
    { label: '\\texttt', type: 'function', info: 'Typewriter text', apply: '\\texttt{}' },
    { label: '\\textsc', type: 'function', info: 'Small caps', apply: '\\textsc{}' },

    // Math
    { label: '\\frac', type: 'function', info: 'Fraction', apply: '\\frac{}{}' },
    { label: '\\sqrt', type: 'function', info: 'Square root', apply: '\\sqrt{}' },
    { label: '\\sum', type: 'function', info: 'Summation' },
    { label: '\\int', type: 'function', info: 'Integral' },
    { label: '\\prod', type: 'function', info: 'Product' },
    { label: '\\lim', type: 'function', info: 'Limit' },
    { label: '\\infty', type: 'constant', info: 'Infinity symbol' },
    { label: '\\alpha', type: 'constant', info: 'Greek alpha' },
    { label: '\\beta', type: 'constant', info: 'Greek beta' },
    { label: '\\gamma', type: 'constant', info: 'Greek gamma' },
    { label: '\\delta', type: 'constant', info: 'Greek delta' },
    { label: '\\theta', type: 'constant', info: 'Greek theta' },
    { label: '\\lambda', type: 'constant', info: 'Greek lambda' },
    { label: '\\pi', type: 'constant', info: 'Greek pi' },
    { label: '\\sigma', type: 'constant', info: 'Greek sigma' },
    { label: '\\omega', type: 'constant', info: 'Greek omega' },
    { label: '\\times', type: 'constant', info: 'Multiplication' },
    { label: '\\cdot', type: 'constant', info: 'Dot product' },
    { label: '\\leq', type: 'constant', info: 'Less or equal' },
    { label: '\\geq', type: 'constant', info: 'Greater or equal' },
    { label: '\\neq', type: 'constant', info: 'Not equal' },
    { label: '\\rightarrow', type: 'constant', info: 'Right arrow' },
    { label: '\\Rightarrow', type: 'constant', info: 'Double right arrow' },

    // References
    { label: '\\label', type: 'function', info: 'Create label', apply: '\\label{}' },
    { label: '\\ref', type: 'function', info: 'Reference label', apply: '\\ref{}' },
    { label: '\\cite', type: 'function', info: 'Citation', apply: '\\cite{}' },

    // Figures and tables
    { label: '\\includegraphics', type: 'function', info: 'Include image', apply: '\\includegraphics[width=\\textwidth]{}' },
    { label: '\\caption', type: 'function', info: 'Figure/table caption', apply: '\\caption{}' },
    { label: '\\centering', type: 'keyword', info: 'Center content' },

    // Lists
    { label: '\\item', type: 'keyword', info: 'List item' },

    // Spacing
    { label: '\\newline', type: 'keyword', info: 'New line' },
    { label: '\\newpage', type: 'keyword', info: 'New page' },
    { label: '\\noindent', type: 'keyword', info: 'No indentation' },

    // Footnotes
    { label: '\\footnote', type: 'function', info: 'Footnote', apply: '\\footnote{}' },
]

// LaTeX environments for autocomplete
export const latexEnvironments = [
    { label: 'document', info: 'Main document body' },
    { label: 'figure', info: 'Figure environment' },
    { label: 'table', info: 'Table environment' },
    { label: 'tabular', info: 'Tabular data' },
    { label: 'itemize', info: 'Bulleted list' },
    { label: 'enumerate', info: 'Numbered list' },
    { label: 'equation', info: 'Numbered equation' },
    { label: 'align', info: 'Aligned equations' },
    { label: 'center', info: 'Centered content' },
]

/**
 * LaTeX autocomplete function for CodeMirror
 */
export function latexCompletions(context) {
    const word = context.matchBefore(/\\[\w]*/)
    const envMatch = context.matchBefore(/\\begin\{[\w]*/)
    const endEnvMatch = context.matchBefore(/\\end\{[\w]*/)

    if (envMatch) {
        const prefix = envMatch.text.replace('\\begin{', '')
        return {
            from: envMatch.from + 7,
            options: latexEnvironments
                .filter(e => e.label.startsWith(prefix))
                .map(e => ({
                    label: e.label,
                    type: 'type',
                    info: e.info,
                    apply: e.label + '}\n\n\\end{' + e.label + '}'
                }))
        }
    }

    if (endEnvMatch) {
        const prefix = endEnvMatch.text.replace('\\end{', '')
        return {
            from: endEnvMatch.from + 5,
            options: latexEnvironments
                .filter(e => e.label.startsWith(prefix))
                .map(e => ({
                    label: e.label,
                    type: 'type',
                    info: e.info,
                    apply: e.label + '}'
                }))
        }
    }

    if (!word) return null

    return {
        from: word.from,
        options: latexCommands.filter(cmd =>
            cmd.label.toLowerCase().startsWith(word.text.toLowerCase())
        )
    }
}
