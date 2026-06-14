// Forest ambient audio — CC0, from OpenGameArt "Forest Ambience" by TinyWorlds.
// Browsers block autoplay until the user interacts, so playback starts on the
// first keydown or click then never pauses again.
export function initAudio(): void {
  const audio = new Audio('/assets/forest-ambient.mp3');
  audio.loop = true;
  audio.volume = 0.9;

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    audio.play().catch(() => {
      // User may have revoked permission — silently ignore.
    });
    window.removeEventListener('keydown', start);
    window.removeEventListener('click', start);
  };

  window.addEventListener('keydown', start);
  window.addEventListener('click', start);
}
