// Main Editor component
export { default } from './Editor'
export { default as Editor } from './Editor'

// Sub-components
export { default as EditorHeader } from './EditorHeader'

// Config
export { latexCommands, latexEnvironments, latexCompletions } from './config/latexCommands'
export { latexHighlightStyle, createEditorTheme, USER_COLORS } from './config/theme'
export { createKeybindings } from './config/keybindings'

// Utils
export { wrapSelection } from './utils/wrapSelection'
export { errorMark, errorGutterMarker, setErrors, errorField, errorGutter } from './utils/errorDecorations'

// Hooks
export { useCodeMirror } from './hooks/useCodeMirror'
