import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { EditorView } from 'codemirror'

/**
 * LaTeX syntax highlighting style using CSS variables for theming
 */
export const latexHighlightStyle = HighlightStyle.define([
    { tag: [t.keyword, t.function, t.className, t.tagName, t.processingInstruction], color: 'var(--syntax-keyword)' },
    { tag: t.atom, color: 'var(--syntax-atom)' },
    { tag: [t.variableName, t.propertyName, t.attributeName], color: 'var(--syntax-variable)' },
    { tag: t.number, color: 'var(--syntax-number)' },
    { tag: t.string, color: 'var(--syntax-string)' },
    { tag: t.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
    { tag: [t.punctuation, t.bracket, t.operator], color: 'var(--syntax-punctuation)' },
    { tag: t.meta, color: 'var(--syntax-keyword)' },
])

/**
 * CodeMirror editor theme configuration
 */
export const createEditorTheme = () => EditorView.theme({
    '&': {
        height: '100%',
        fontSize: '14px',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
    },
    '&.cm-focused': {
        outline: 'none',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--text-primary)',
    },
    '.cm-scroller': {
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
        lineHeight: '1.6',
    },
    '.cm-content': {
        padding: '12px 0',
    },
    '.cm-gutters': {
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'var(--accent-light)',
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--accent-light)',
    },
    '.cm-tooltip': {
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--accent-light)',
        color: 'var(--accent)',
    },
    '.cm-line-error': {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    '.cm-error-underline': {
        textDecoration: 'underline 2px var(--error)',
        textUnderlineOffset: '4px',
    },
    '.cm-error-gutter-marker': {
        color: 'var(--error)',
        fontSize: '12px',
        paddingLeft: '4px',
        display: 'block',
    },
    '.cm-ySelectionInfo': {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'absolute',
        top: '-20px',
        left: '0',
        fontWeight: '600',
        zIndex: 100,
        pointerEvents: 'none',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        color: '#fff', // Ensure text is readable on colored bg
        lineHeight: '1.2'
    },
    // Remote cursor line (static, no animation)
    '.cm-ySelectionCaret': {
        position: 'relative',
        borderLeft: '2px solid',
        marginLeft: '-1px',
        marginRight: '-1px',
        boxSizing: 'border-box',
        zIndex: 10
    },

    // Remote selection highlight
    '.cm-ySelection': {
        opacity: 0.3,
        padding: '0.1px 0', // Fix for tiny gaps between lines specific to some renderers
        // Removed mixBlendMode to ensure consistent style across all lines
    },
    // Remote cursor head (the colored bar)
    '.cm-yLineSelection': {
        padding: '0',
        margin: '0'
    }
})


// User colors for collaboration cursors
export const USER_COLORS = [
    '#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352',
    '#9ac2c9', '#8acb88', '#1be7ff', '#6eeb83', '#e4ff1a',
    '#e8aa14', '#ff5714', '#ea9ab2', '#7fb069', '#31afb4'
]
