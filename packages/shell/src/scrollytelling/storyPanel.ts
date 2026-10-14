import { firstSentence, type StoryStop } from '@torahmap/stories';

// Minimal markdown-to-HTML for story text: **bold**, *italic*, [links](url),
// paragraphs, and raw HTML (e.g. <span>).
function renderMarkdown(md: string): string {
  return md
    .split(/\n\n+/)
    .map((paragraph) => {
      const html = paragraph
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\n/g, ' ');
      return `<p>${html}</p>`;
    })
    .join('\n');
}

/** What stands for a stop when the story is folded: its title, or else its first sentence. */
export function stopLabel(stop: Pick<StoryStop, 'title' | 'text'>): string {
  return stop.title || (firstSentence(stop) ?? '');
}

export function renderStoryPanel(container: HTMLElement, stops: StoryStop[]): HTMLElement[] {
  container.innerHTML = '';
  const stopElements: HTMLElement[] = [];

  for (const stop of stops) {
    const el = document.createElement('div');
    el.className = 'story-stop';
    el.dataset.stopId = stop.id;

    if (stop.title) {
      const title = document.createElement('h2');
      title.textContent = stop.title;
      el.appendChild(title);
    }

    const textContainer = document.createElement('div');
    textContainer.className = 'story-text';
    textContainer.innerHTML = renderMarkdown(stop.text);
    el.appendChild(textContainer);

    container.appendChild(el);
    stopElements.push(el);
  }

  const ending = document.createElement('button');
  ending.type = 'button';
  ending.className = 'story-leave';
  ending.textContent = 'Explore the map yourself';
  stopElements[stopElements.length - 1]?.appendChild(ending);

  return stopElements;
}
