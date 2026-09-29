import { describe, expect, it } from 'vitest';
import { previewFetcher } from '../../../worker/fetchers.ts';

describe('previewFetcher', () => {
  it('names each chat app by its User-Agent', () => {
    expect(previewFetcher('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)')).toBe(
      'slack',
    );
    expect(previewFetcher('WhatsApp/2.23.20.0')).toBe('whatsapp');
    expect(previewFetcher('Discordbot/2.0')).toBe('discord');
    expect(previewFetcher('TelegramBot (like TwitterBot)')).toBe('telegram');
    expect(previewFetcher('LinkedInBot/1.0')).toBe('linkedin');
    expect(previewFetcher('Twitterbot/1.0')).toBe('twitter');
    expect(previewFetcher('facebookexternalhit/1.1')).toBe('facebook');
  });

  it('answers null for an ordinary browser', () => {
    expect(
      previewFetcher(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      ),
    ).toBeNull();
    expect(
      previewFetcher(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBeNull();
    expect(
      previewFetcher('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'),
    ).toBeNull();
  });
});
