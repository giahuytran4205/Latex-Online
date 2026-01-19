import { keymap } from '@codemirror/view'
import { indentWithTab, insertTab } from '@codemirror/commands'
import { completionStatus, acceptCompletion, startCompletion } from '@codemirror/autocomplete'
import { wrapSelection } from '../utils/wrapSelection'

/**
 * Create editor keybindings with callback refs for compile action
 * @param {React.MutableRefObject} onCompileRef - Ref to the onCompile callback
 * @returns {Extension} CodeMirror keymap extension
 */
export function createKeybindings(onCompileRef) {
    return keymap.of([
        {
            key: 'Tab',
            run: (view) => {
                if (completionStatus(view.state)) {
                    return acceptCompletion(view)
                }
                // Use insertTab to simply insert a tab/spaces at cursor
                // instead of indenting the whole line logic
                return insertTab(view)
            }
        },
        { key: 'Ctrl-Space', run: startCompletion },
        { key: 'Ctrl-b', run: (view) => wrapSelection(view, '\\textbf{', '}') },
        { key: 'Ctrl-i', run: (view) => wrapSelection(view, '\\textit{', '}') },
        { key: 'Ctrl-u', preventDefault: true, run: (view) => wrapSelection(view, '\\underline{', '}') },
        { key: 'Ctrl-e', run: (view) => wrapSelection(view, '\\emph{', '}') },
        { key: 'Ctrl-m', run: (view) => wrapSelection(view, '$', '$') },
        { key: 'Ctrl-Shift-m', run: (view) => wrapSelection(view, '\\[\n', '\n\\]') },
        {
            key: 'Ctrl-s',
            preventDefault: true,
            run: () => { onCompileRef.current?.(); return true }
        },
        {
            key: 'Ctrl-Enter',
            run: () => { onCompileRef.current?.(); return true }
        },
    ])
}
