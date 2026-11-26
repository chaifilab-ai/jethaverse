/* The "Recommended" list: episodes picked by hand. This is the only file to edit.
 *
 *   label     the word shown on the filter chip and on the star badges ("Recommended", "Best", "Funniest", ...)
 *   episodes  the episode numbers. They are always shown in episode order, so the order here does not matter.
 *
 * While the list is empty there is no chip and no badge. A number that is not an episode of the guide, or that
 * is listed twice, fails the tests (npm test), so a typo is caught before the site is published. */
window.GG_BEST = {
  label: "Recommended",
  episodes: [30, 50, 225, 373, 387, 414, 554, 881]
};
