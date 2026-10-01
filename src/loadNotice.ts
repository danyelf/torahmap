// What a place shows while the reader waits on a file: that it is loading, or
// that it failed, with a × that closes the warning.
import './styles/load-notice.css';

export const LOADING = 'Loading…';
const FAILED = "Couldn't load — please reload and try again";

export function loadNotice(state: 'loading' | 'failed', onClose: () => void): HTMLElement {
  const notice = document.createElement('span');
  notice.className = 'load-notice';
  notice.dataset.state = state;
  notice.textContent = state === 'loading' ? LOADING : FAILED;
  if (state === 'failed') {
    notice.setAttribute('role', 'alert');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'load-notice-close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', onClose);
    notice.append(close);
  }
  return notice;
}
