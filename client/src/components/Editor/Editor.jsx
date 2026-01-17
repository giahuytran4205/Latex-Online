import { useCodeMirror } from './hooks/useCodeMirror'
import EditorHeader from './EditorHeader'
import './Editor.css'

/**
 * Editor Component
 * 
 * A collaborative LaTeX editor built on CodeMirror 6 with Yjs integration.
 * 
 * @param {Object} props
 * @param {string} props.code - Initial code content
 * @param {Function} props.onChange - Callback when content changes
 * @param {Function} props.onCompile - Callback for compile action (Ctrl+S)
 * @param {string} props.activeFile - Currently active file path
 * @param {Array} props.errors - Array of error objects with line numbers
 * @param {Object} props.jumpToLine - Jump to line configuration
 * @param {string} props.projectId - Project ID for collaboration
 * @param {string} props.userId - Current user ID
 * @param {string} props.userName - Current user name
 * @param {Object} props.yDoc - Yjs document for collaboration
 * @param {Object} props.awareness - Yjs awareness for cursor sync
 * @param {boolean} props.isSynced - Whether Yjs is synced
 * @param {boolean} props.readOnly - Whether editor is read-only
 */
function Editor({
    code,
    onChange,
    onCompile,
    activeFile,
    errors = [],
    jumpToLine,
    projectId,
    userId,
    userName,
    yDoc,
    awareness,
    isSynced = false,
    readOnly = false
}) {
    // Use custom hook for CodeMirror management
    const { editorRef } = useCodeMirror({
        code,
        onChange,
        onCompile,
        activeFile,
        errors,
        jumpToLine,
        yDoc,
        awareness,
        readOnly
    })

    const displayName = activeFile ? activeFile.split('/').pop() : 'main.tex'

    return (
        <div className="editor-panel">
            <EditorHeader displayName={displayName} readOnly={readOnly} />
            <div className="editor-panel__content" ref={editorRef}></div>
        </div>
    )
}

export default Editor
