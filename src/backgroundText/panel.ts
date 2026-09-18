// Throwaway dev panel for the background text prototype. Edits every setting
// live, keeps them in localStorage across reloads, and copies them as JSON so a
// combination that works can be pasted into a conversation.

import { DEFAULT_SETTINGS, PRESETS, type BackgroundTextSettings } from './model.ts';

const STORAGE_KEY = 'bgtext-settings';

export function loadSettings(): BackgroundTextSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Private mode or blocked storage: fall through to the defaults.
  }
  return { ...DEFAULT_SETTINGS };
}

type Key = keyof BackgroundTextSettings;

export function createBackgroundTextPanel(
  initial: BackgroundTextSettings,
  onChange: (next: BackgroundTextSettings) => void,
): HTMLDivElement {
  let settings: BackgroundTextSettings = { ...initial };
  const panel = document.createElement('div');
  panel.id = 'bgtext-panel';
  const inputs = new Map<Key, HTMLInputElement | HTMLSelectElement>();
  const outputs = new Map<Key, HTMLOutputElement>();

  function commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable; the panel still works for this page load.
    }
    onChange({ ...settings });
  }

  function set(key: Key, value: string | number | boolean): void {
    settings = { ...settings, [key]: value } as BackgroundTextSettings;
    commit();
  }

  function refreshInputs(): void {
    for (const [key, el] of inputs) el.value = String(settings[key]);
    for (const [key, out] of outputs) out.textContent = String(settings[key]);
  }

  function row(label: string, control: HTMLElement): void {
    const r = document.createElement('label');
    const text = document.createElement('span');
    text.textContent = label;
    r.append(text, control);
    panel.appendChild(r);
  }

  function select(key: Key, choices: string[]): HTMLSelectElement {
    const s = document.createElement('select');
    for (const c of choices) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      s.appendChild(opt);
    }
    s.value = String(settings[key]);
    s.addEventListener('change', () => set(key, s.value));
    inputs.set(key, s);
    return s;
  }

  function range(key: Key, min: number, max: number, step: number): HTMLElement {
    const i = document.createElement('input');
    i.type = 'range';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(settings[key]);
    const out = document.createElement('output');
    out.textContent = i.value;
    i.addEventListener('input', () => {
      out.textContent = i.value;
      set(key, Number(i.value));
    });
    inputs.set(key, i);
    outputs.set(key, out);
    const wrap = document.createElement('span');
    wrap.className = 'bgtext-range';
    wrap.append(i, out);
    return wrap;
  }

  const presets = document.createElement('div');
  presets.className = 'bgtext-presets';
  for (const name of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => {
      settings = { ...settings, ...PRESETS[name] };
      refreshInputs();
      commit();
    });
    presets.appendChild(b);
  }
  const copy = document.createElement('button');
  copy.textContent = 'copy';
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
  });
  presets.appendChild(copy);
  panel.appendChild(presets);

  row('layer', select('layer', ['behind', 'above']));
  row('anchor', select('anchor', ['viewport', 'square']));
  row('parallax', range('parallax', 0, 1, 0.05));
  row('content', select('content', ['center', 'window', 'fill']));
  row('neighbours', range('neighbours', 1, 20, 1));
  row('width em', range('widthEm', 10, 120, 5));
  row('min font', range('minFont', 6, 40, 1));
  row('max font', range('maxFont', 6, 80, 1));
  row('opacity', range('opacity', 0, 1, 0.05));
  row('lit opacity', range('litOpacity', 0, 1, 0.05));
  row('blend', select('blend', ['normal', 'difference', 'exclusion', 'overlay']));
  row('font', select('font', ['noto', 'frank', 'david']));
  row('marks', select('marks', ['all', 'no-trop', 'letters']));
  row('hysteresis', range('hysteresis', 0, 30, 1));
  row('settle ms', range('settleMs', 0, 1000, 50));
  row('crossfade ms', range('crossfadeMs', 0, 2000, 50));
  const snap = document.createElement('input');
  snap.type = 'checkbox';
  snap.checked = settings.snapLines;
  snap.addEventListener('change', () => set('snapLines', snap.checked));
  row('snap lines', snap);

  return panel;
}
