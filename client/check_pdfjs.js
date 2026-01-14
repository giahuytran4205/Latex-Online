
const pdfjs = require('pdfjs-dist');
console.log('AnnotationLayer:', !!pdfjs.AnnotationLayer);
console.log('renderTextLayer:', !!pdfjs.renderTextLayer);

try {
    const viewer = require('pdfjs-dist/web/pdf_viewer.mjs'); // This might fail if it's ESM only
    console.log('Viewer AnnotationLayer:', !!viewer.AnnotationLayer);
} catch (e) {
    console.log('Cannot require pdf_viewer.mjs:', e.message);
}
