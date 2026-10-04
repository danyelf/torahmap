// A browser's User-Agent cut down to its name, major version and system, such
// as "Chrome 129 Android", for the browser column. Coarse on purpose: enough
// to group errors by, not enough to tell readers apart. Every browser on iOS
// runs Safari's engine, which ships with iOS, so there the system's version is
// the one that matters and is kept.

// First match wins: in-app browsers and Chrome's relatives also say "Chrome"
// or "Safari", so they come before those two.
const BROWSERS: [name: string, pattern: RegExp][] = [
  ['Facebook app', /FBAN|FBAV/],
  ['Instagram app', /Instagram/],
  ['LinkedIn app', /LinkedInApp/],
  ['Edge', /EdgA?\/(\d+)|EdgiOS\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Opera', /OPR\/(\d+)/],
  ['Firefox', /Firefox\/(\d+)|FxiOS\/(\d+)/],
  ['Chrome', /Chrome\/(\d+)|CriOS\/(\d+)/],
  ['Safari', /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari\//],
];

function system(userAgent: string): string {
  const ios = /(?:iPhone|iPad|iPod).* OS (\d+)_(\d+)/.exec(userAgent);
  if (ios) return `iOS ${ios[1]}.${ios[2]}`;
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/CrOS/.test(userAgent)) return 'ChromeOS';
  if (/Mac OS X/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return '';
}

export function browserName(userAgent: string): string {
  const os = system(userAgent);
  for (const [name, pattern] of BROWSERS) {
    const match = pattern.exec(userAgent);
    if (!match) continue;
    const version = match.slice(1).find(Boolean);
    return [name, version, os].filter(Boolean).join(' ');
  }
  return os ? `other ${os}` : 'other';
}
