/** Put the app at a link, without navigating. `query` is "?a=b" or "". */
export function setLink(query: string): void {
  history.replaceState(null, '', `/${query}`);
}
