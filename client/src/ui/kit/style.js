/**
 * Shared HUD styling, the same kit as the studio's +1 Slide Downhill. Sizes are in
 * reference-layout pixels (a 1920x1080 screen) and scaled by the --px CSS variable, so
 * the whole HUD keeps its proportions on any screen.
 */

/** `u(48)` -> a CSS length equal to 48 reference pixels. */
export const u = (n) => `calc(var(--px) * ${n})`

export const GRADIENTS = {
  gold: 'linear-gradient(180deg, #fffaa8 0%, #ffd52a 45%, #ff9c00 100%)',
  goldButton: 'linear-gradient(180deg, #fff27a 0%, #ffcb1f 48%, #ff9a0a 100%)',
  blueButton: 'linear-gradient(180deg, #8ff0ff 0%, #2fb8ff 50%, #1677ff 100%)',
  purpleButton: 'linear-gradient(180deg, #ff9cf4 0%, #dc52ff 50%, #9a2bff 100%)',
  greenButton: 'linear-gradient(180deg, #b6ff6a 0%, #57e83a 50%, #19b52a 100%)',
  greyButton: 'linear-gradient(180deg, #e2e6ea 0%, #a9b0b8 55%, #7d858e 100%)',
  redButton: 'linear-gradient(180deg, #ff8a7a 0%, #ff3b3b 50%, #d4142a 100%)',
  orangeButton: 'linear-gradient(180deg, #ffd99a 0%, #ffa53a 50%, #f07a12 100%)',
  pinkButton: 'linear-gradient(180deg, #ffb8c6 0%, #ff5f86 50%, #d92b5a 100%)',
  skyButton: 'linear-gradient(180deg, #b4efff 0%, #4cb8ff 50%, #2477e8 100%)',
  rainbow:
    'linear-gradient(90deg, #ff3b5c 0%, #ff9a1f 18%, #ffe53b 34%, #4ef05a 50%, #2fc6ff 66%, #6a5cff 82%, #ff4fd8 100%)',
  pass: 'linear-gradient(135deg, #ff5fd2 0%, #8a5cff 35%, #2fb8ff 70%, #5cff9a 100%)',
  barFill: 'linear-gradient(180deg, #ffe76b 0%, #ffc21a 50%, #ff9500 100%)',
  levelFill: 'linear-gradient(180deg, #8fe8ff 0%, #33b6ff 45%, #1a7cf0 100%)',
  purpleText: 'linear-gradient(180deg, #ffd6ff 0%, #e27bff 50%, #a93cf0 100%)',
  priceShort: 'linear-gradient(180deg, #ffc2b8 0%, #ff6a55 50%, #e2242c 100%)',
  slate: 'linear-gradient(180deg, #7c8cb0 0%, #4a5778 50%, #2c344d 100%)',
  panel: 'linear-gradient(180deg, rgba(30, 33, 38, 0.94), rgba(18, 20, 24, 0.94))',
}
