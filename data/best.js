/* The "Best" list: episodes picked by hand. This is the only file to edit.
 *
 *   label     the word shown on the filter chip and on the ★ badges: "Best", "Funniest", "Recommended", ...
 *   episodes  the episode numbers, in the order you want them listed (when nobody is searching, the Best chip
 *             shows them in this order; with a search they follow the search).
 *
 * While the list is empty there is no Best chip and no badge. A number that is not an episode of the guide, or
 * that is listed twice, fails the tests (npm test), so a typo is caught before the site is published. */
window.GG_BEST = {
  label: "Best",
  episodes: []
};
