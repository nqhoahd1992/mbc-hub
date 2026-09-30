import { renderAppIndex } from './appIndex.js';

/**
 * No WebGL: promote the accessible index to the primary view and say why.
 * Nothing is lost except the model itself - every link still works.
 */
export function mountFallback(container, reason) {
  document.body.classList.add('is-fallback');
  renderAppIndex(container);

  const note = document.createElement('p');
  note.className = 'fallback-note';
  note.textContent = reason;
  container.querySelector('.app-index__intro')?.after(note);
}
