import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as path from 'path';

const script = path.join(__dirname, '..', 'review-freshness.sh');
const sha = (c: string) => c.repeat(40);
const commits = ['a', 'b', 'c', 'd'].map((c) => ({ oid: sha(c) }));

function freshness(
  comments: { body: string; createdAt: string }[],
  reviews: { body: string; submittedAt: string }[] = [],
) {
  const pr = { headRefOid: sha('d'), commits, comments, reviews };
  return execFileSync('bash', [script], { input: JSON.stringify(pr) })
    .toString()
    .trim();
}

const review = (s: string, at: string) => ({
  body: `Reviewed up to \`${s}\`\n\nFine.`,
  createdAt: at,
});

describe('review-freshness', () => {
  const none = freshness([{ body: 'Looks good', createdAt: '2026-10-01' }]);
  const atHead = freshness([review(sha('d'), '2026-10-01')]);
  const rebased = freshness([review(sha('e'), '2026-10-01')]);
  const behind = freshness([review(sha('b'), '2026-10-01')]);

  it('tells apart no review, reviewed at the head, commits since, and rebased since', () => {
    expect(new Set([none, atHead, rebased, behind]).size).toBe(4);
  });

  it('counts the commits after the reviewed one', () => {
    expect(behind).toMatch(/\b2\b/);
    expect(behind).toContain('bbbbbbb');
  });

  it('takes the latest review, from a comment or a review', () => {
    expect(freshness([review(sha('b'), '2026-10-01'), review(sha('d'), '2026-10-03')])).toBe(
      atHead,
    );
    expect(
      freshness(
        [review(sha('d'), '2026-10-01')],
        [{ body: review(sha('b'), '').body, submittedAt: '2026-10-02' }],
      ),
    ).toBe(behind);
  });

  it('ignores the line anywhere but the start of the comment', () => {
    expect(
      freshness([{ body: `See\nReviewed up to \`${sha('d')}\``, createdAt: '2026-10-01' }]),
    ).toBe(none);
  });
});
