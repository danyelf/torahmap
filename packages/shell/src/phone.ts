// Whether the page is laid out for a phone. phone.css decides, with its one
// media query, and says so in --layout; reading it here keeps the script from
// disagreeing with the stylesheet.
export function isPhone(): boolean {
  return getComputedStyle(document.documentElement).getPropertyValue('--layout').trim() === 'phone';
}
