---
name: React Component Architecture
description: Guidelines for structuring React components in this project
---

# React Component Architecture Skill

## Project Structure

```
client/src/
├── components/          # Reusable UI components
│   ├── ComponentName/
│   │   ├── ComponentName.jsx
│   │   ├── ComponentName.css
│   │   └── index.js     # (optional) re-export
│   └── ...
├── hooks/               # Custom React hooks
│   └── useHookName.js
├── contexts/            # React Context providers
│   └── ContextName.jsx
├── services/            # API calls and external services
│   └── api.js
├── pages/               # Page-level components
│   └── PageName/
│       ├── PageName.jsx
│       └── PageName.css
└── utils/               # Utility functions
    └── helpers.js
```

## Component Guidelines

### 1. Component Structure
Each component should have its own folder with:
- `ComponentName.jsx` - Main component logic
- `ComponentName.css` - Component styles
- `index.js` (optional) - Clean re-exports

### 2. Separation of Concerns
- **UI Components**: Focus on rendering, minimal logic
- **Container Components**: Handle state and data fetching
- **Hooks**: Extract reusable stateful logic
- **Utilities**: Pure functions, no React dependencies

### 3. Component Size Guidelines
- Keep components under **200 lines** when possible
- If a component exceeds 300 lines, consider splitting
- Extract reusable parts into sub-components

### 4. Splitting Large Components

When splitting a large component like `Editor.jsx`:

#### Step 1: Identify Logical Sections
- Configuration/Constants → `config/` or `constants/`
- Utility functions → `utils/`
- Sub-components → Own component files
- Custom hooks → `hooks/`

#### Step 2: Create Sub-component Structure
```
components/Editor/
├── Editor.jsx           # Main orchestrating component
├── Editor.css           # Styles
├── EditorHeader.jsx     # Tab bar, shortcuts display
├── EditorContent.jsx    # CodeMirror wrapper
├── config/
│   ├── latexCommands.js # LaTeX autocomplete data
│   ├── keybindings.js   # Editor keybindings
│   └── theme.js         # Editor theme configuration
├── utils/
│   ├── errorDecorations.js  # Error marking utilities
│   └── wrapSelection.js     # Text wrapping helper
└── hooks/
    └── useCodeMirror.js # CodeMirror initialization hook
```

#### Step 3: Extract Constants
Move static data to config files:
```javascript
// config/latexCommands.js
export const latexCommands = [
    { label: '\\documentclass', type: 'keyword', ... },
    // ...
]

export const latexEnvironments = [
    { label: 'document', info: 'Main document body' },
    // ...
]
```

#### Step 4: Extract Hooks
Custom hooks should handle complex stateful logic:
```javascript
// hooks/useCodeMirror.js
export function useCodeMirror({ code, onChange, extensions }) {
    const editorRef = useRef(null)
    const viewRef = useRef(null)
    
    useEffect(() => {
        // CodeMirror initialization...
    }, [dependencies])
    
    return { editorRef, viewRef }
}
```

### 5. Import/Export Patterns

Use named exports for utilities and constants:
```javascript
// utils/wrapSelection.js
export function wrapSelection(view, before, after) { ... }
```

Use default exports for components:
```javascript
// Editor.jsx
export default function Editor(props) { ... }
```

### 6. Props and State Management

- Keep props interface clean and documented
- Use destructuring with defaults
- Consider prop-types or TypeScript for type safety

```javascript
function Editor({
    code,
    onChange,
    onCompile,
    activeFile,
    errors = [],
    readOnly = false
}) {
    // Component logic
}
```

### 7. Performance Optimization

- Use `useMemo` for expensive computations
- Use `useCallback` for functions passed as props
- Use `React.memo` for pure components
- Avoid creating objects/arrays in render

### 8. CSS Best Practices

- Use BEM-like naming: `.component__element--modifier`
- Use CSS custom properties for theming
- Keep styles scoped to component

## Example: Refactoring Editor Component

### Before (monolithic):
```
Editor.jsx (565 lines)
├── Constants (100 lines)
├── Utility functions (50 lines)
├── Hook definitions (250 lines)
└── Component render (165 lines)
```

### After (modular):
```
Editor/
├── Editor.jsx (150 lines)           # Main component
├── EditorHeader.jsx (40 lines)      # Header with tabs
├── config/
│   ├── latexCommands.js (80 lines)  # Autocomplete data
│   ├── keybindings.js (30 lines)    # Key mappings
│   └── theme.js (60 lines)          # CodeMirror theme
├── utils/
│   ├── errorDecorations.js (50 lines)
│   └── latex.js (20 lines)
└── hooks/
    └── useCodeMirror.js (150 lines) # CM initialization
```

## Quick Commands

### Create new component
```bash
mkdir -p client/src/components/NewComponent
touch client/src/components/NewComponent/NewComponent.jsx
touch client/src/components/NewComponent/NewComponent.css
```

### Create new hook
```bash
touch client/src/hooks/useNewHook.js
```
