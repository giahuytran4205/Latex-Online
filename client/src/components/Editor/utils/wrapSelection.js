/**
 * Wrap selected text with LaTeX command
 * @param {EditorView} view - CodeMirror editor view
 * @param {string} before - Text to insert before selection
 * @param {string} after - Text to insert after selection
 * @returns {boolean} Always true to indicate command was handled
 */
export function wrapSelection(view, before, after) {
    const { from, to } = view.state.selection.main
    const selectedText = view.state.doc.sliceString(from, to)

    view.dispatch({
        changes: { from, to, insert: before + selectedText + after },
        selection: { anchor: from + before.length, head: from + before.length + selectedText.length }
    })
    return true
}
