const keys = new Set<string>();

export function initInput(): void {
  window.addEventListener('keydown', e => {
    keys.add(e.code);
    // Prevent arrow keys from scrolling the page
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  // FUTURE: add 'Space' for item interaction
  // FUTURE: add 'Escape' for pause menu
}

export function isKeyDown(code: string): boolean {
  return keys.has(code);
}
