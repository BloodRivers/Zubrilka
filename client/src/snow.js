// Снег не должен мешать в конспектах, тестах, тренажёрах и теории ЕГЭ.
const NO_SNOW = [
  /^\/note(?:\/|$)/,
  /^\/test(?:\/|$)/,
  /^\/trainer(?:\/|$)/,
  /^\/use(?:\/|$)/,
  /\/quiz(?:\/|$)/,
  /^\/results(?:\/|$)/,
  /^\/subject\/[^/]+\/new(?:\/|$)/,
];

export function showSnowOn(pathname) {
  const path = (pathname || "").split("?")[0];
  return !NO_SNOW.some((pattern) => pattern.test(path));
}
