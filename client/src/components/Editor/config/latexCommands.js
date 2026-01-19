import { snippet } from '@codemirror/autocomplete'

/**
 * LaTeX autocomplete commands and environments data
 */

// LaTeX commands for autocomplete
export const latexCommands = [
    // Document structure
    { label: '\\documentclass', type: 'keyword', info: 'Define document class', apply: '\\documentclass{${article}}' },
    { label: '\\usepackage', type: 'keyword', info: 'Import package', apply: '\\usepackage{${1}}' },
    { label: '\\begin', type: 'keyword', info: 'Begin environment', apply: '\\begin{${1}}' },
    { label: '\\end', type: 'keyword', info: 'End environment', apply: '\\end{${1}}' },
    { label: '\\title', type: 'keyword', info: 'Document title', apply: '\\title{${1}}' },
    { label: '\\author', type: 'keyword', info: 'Document author', apply: '\\author{${1}}' },
    { label: '\\date', type: 'keyword', info: 'Document date', apply: '\\date{${1}}' },
    { label: '\\maketitle', type: 'keyword', info: 'Render title' },

    // Sections
    { label: '\\section', type: 'function', info: 'Section heading', apply: '\\section{${1}}' },
    { label: '\\subsection', type: 'function', info: 'Subsection heading', apply: '\\subsection{${1}}' },
    { label: '\\subsubsection', type: 'function', info: 'Subsubsection', apply: '\\subsubsection{${1}}' },
    { label: '\\paragraph', type: 'function', info: 'Paragraph heading', apply: '\\paragraph{${1}}' },
    { label: '\\chapter', type: 'function', info: 'Chapter heading', apply: '\\chapter{${1}}' },

    // Text formatting
    { label: '\\textbf', type: 'function', info: 'Bold text', apply: '\\textbf{${1}}' },
    { label: '\\textit', type: 'function', info: 'Italic text', apply: '\\textit{${1}}' },
    { label: '\\underline', type: 'function', info: 'Underlined text', apply: '\\underline{${1}}' },
    { label: '\\emph', type: 'function', info: 'Emphasized text', apply: '\\emph{${1}}' },
    { label: '\\texttt', type: 'function', info: 'Typewriter text', apply: '\\texttt{${1}}' },
    { label: '\\textsc', type: 'function', info: 'Small caps', apply: '\\textsc{${1}}' },

    // Math
    { label: '\\frac', type: 'function', info: 'Fraction', apply: '\\frac{${1}}{${2}}' },
    { label: '\\sqrt', type: 'function', info: 'Square root', apply: '\\sqrt{${1}}' },
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
    { label: '\\label', type: 'function', info: 'Create label', apply: '\\label{${1}}' },
    { label: '\\ref', type: 'function', info: 'Reference label', apply: '\\ref{${1}}' },
    { label: '\\cite', type: 'function', info: 'Citation', apply: '\\cite{${1}}' },

    // Figures and tables
    { label: '\\includegraphics', type: 'function', info: 'Include image', apply: '\\includegraphics[width=\\textwidth]{${1}}' },
    { label: '\\caption', type: 'function', info: 'Figure/table caption', apply: '\\caption{${1}}' },
    { label: '\\centering', type: 'keyword', info: 'Center content' },

    // Lists
    { label: '\\item', type: 'keyword', info: 'List item' },

    // Spacing
    { label: '\\newline', type: 'keyword', info: 'New line' },
    { label: '\\newpage', type: 'keyword', info: 'New page' },
    { label: '\\noindent', type: 'keyword', info: 'No indentation' },

    // Footnotes
    { label: '\\footnote', type: 'function', info: 'Footnote', apply: '\\footnote{${1}}' },
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

// Special math snippets
const mathSnippets = [
    { label: '$$', info: 'Display Math', apply: '$$ ${1} $$' },
    { label: '$', info: 'Inline Math', apply: '$${1}$' },
    { label: '\\[', info: 'Display Math (LaTeX)', apply: '\\[\n\t${1}\n\\]' },
]

/**
 * LaTeX autocomplete function for CodeMirror
 */
export function latexCompletions(context) {
    const word = context.matchBefore(/(\\[\w]*|\$\$?|\\\[)/)
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
                    // Use apply for snippet-based insertion (with cursor inside)
                    apply: snippet(e.label + '}\n\t${1}\n\\end{' + e.label + '}')
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
                    apply: e.label + '}' // No snippet needed here usually, just closing
                }))
        }
    }

    if (!word) return null

    // Combine standard commands with math snippets
    const allOptions = [
        ...latexCommands,
        ...mathSnippets
    ]

    return {
        from: word.from,
        options: allOptions
            .filter(cmd => cmd.label.toLowerCase().startsWith(word.text.toLowerCase()))
            .map(cmd => ({
                label: cmd.label,
                type: cmd.type || 'keyword',
                info: cmd.info,
                // Wrap in snippet() if apply text is provided, otherwise standard completion
                apply: cmd.apply ? snippet(cmd.apply) : undefined
            }))
    }
}
