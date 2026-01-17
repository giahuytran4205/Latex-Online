import { EditorView } from 'codemirror'
import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, gutter, GutterMarker } from '@codemirror/view'

/**
 * Line decoration for error highlighting
 */
export const errorMark = Decoration.line({
    attributes: { class: 'cm-line-error' }
})

/**
 * Gutter marker for error lines
 */
export const errorGutterMarker = new class extends GutterMarker {
    toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-error-gutter-marker'
        span.innerHTML = '●'
        span.title = 'LaTeX Error'
        return span
    }
}

/**
 * State effect for setting error decorations
 */
export const setErrors = StateEffect.define()

/**
 * State field for managing error decorations
 */
export const errorField = StateField.define({
    create() {
        return Decoration.none
    },
    update(underlines, tr) {
        underlines = underlines.map(tr.changes)
        for (let e of tr.effects) {
            if (e.is(setErrors)) {
                underlines = e.value
            }
        }
        return underlines
    },
    provide: f => EditorView.decorations.from(f)
})

/**
 * Error gutter extension
 */
export const errorGutter = gutter({
    class: 'cm-error-gutter',
    renderEmptyElements: false,
    markers: view => view.state.field(errorField)
})
