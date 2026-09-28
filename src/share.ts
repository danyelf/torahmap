// Sending a link: the system share sheet where one exists, otherwise the clipboard.

/** What became of a share attempt. */
export type ShareOutcome = 'copied' | 'share_sheet' | 'cancelled' | 'failed';

export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  writeText: (text: string) => Promise<void>;
  coarsePointer: boolean;
}

/** Send a link: the system share sheet on a touch screen that has one, otherwise the clipboard. */
export async function shareLink(url: string, title: string, env: ShareEnv): Promise<ShareOutcome> {
  if (env.share && env.coarsePointer) {
    try {
      await env.share({ url, title });
      return 'share_sheet';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await env.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** After `ms`, close the menu if it is still open. */
export function closeAfterConfirming(isOpen: () => boolean, close: () => void, ms: number): void {
  setTimeout(() => {
    if (isOpen()) close();
  }, ms);
}
