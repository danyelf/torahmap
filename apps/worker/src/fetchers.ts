// The chat apps whose link previews are worth counting, and the User-Agent
// substring that names each one. Order matters: iMessage's fetcher carries
// both Facebook's and Twitter's tokens, so its entry has to come first;
// Telegram's User-Agent string contains "TwitterBot", so its entry has to
// come before Twitter's.
const FETCHERS: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['imessage', /facebookexternalhit.*Twitterbot/i],
  ['telegram', /TelegramBot/i],
  ['slack', /Slackbot/i],
  ['whatsapp', /WhatsApp/i],
  ['discord', /Discordbot/i],
  ['linkedin', /LinkedInBot/i],
  ['twitter', /Twitterbot/i],
  ['facebook', /facebookexternalhit/i],
];

/** The chat app's preview fetcher a User-Agent names, or null for anything else. */
export function previewFetcher(userAgent: string): string | null {
  for (const [name, pattern] of FETCHERS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}
