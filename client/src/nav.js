export const TAB_ROOTS = ["/", "/library", "/settings", "/account"];

const RETURN_KEY = "zubrilka:returnTo";
let quizActive = false;
const quizListeners = new Set();

export function setQuizActive(v) {
  quizActive = Boolean(v);
  for (const fn of quizListeners) fn(quizActive);
}

export function isQuizActive() {
  return quizActive;
}

export function onQuizActive(fn) {
  quizListeners.add(fn);
  fn(quizActive);
  return () => quizListeners.delete(fn);
}

export function setReturnTo(path) {
  if (path) sessionStorage.setItem(RETURN_KEY, path);
  else sessionStorage.removeItem(RETURN_KEY);
}

export function peekReturnTo() {
  return sessionStorage.getItem(RETURN_KEY);
}

export function consumeReturnTo() {
  const p = peekReturnTo();
  sessionStorage.removeItem(RETURN_KEY);
  return p;
}

export function tabOf(pathname) {
  if (pathname.startsWith("/library") || pathname.startsWith("/user")) return "/library";
  if (pathname.startsWith("/settings")) return "/settings";
  if (pathname.startsWith("/account")) return "/account";
  if (
    pathname === "/"
    || pathname.startsWith("/subject")
    || pathname.startsWith("/note")
    || pathname.startsWith("/test")
    || pathname.startsWith("/trainer")
    || pathname.startsWith("/results")
  )
    return "/";
  return null;
}

function isHub(pathname) {
  return (
    pathname === "/"
    || /^\/subject\/[^/]+$/.test(pathname)
    || pathname === "/library"
    || pathname === "/settings"
    || pathname === "/account"
  );
}

export function rememberTab(pathname) {
  const root = tabOf(pathname);
  if (root && isHub(pathname)) sessionStorage.setItem(`zubrilka:tab:${root}`, pathname);
}

export function resumeTab(root) {
  const saved = sessionStorage.getItem(`zubrilka:tab:${root}`);
  return saved && isHub(saved) ? saved : root;
}

export function backOf(pathname, state) {
  if (state?.from) return state.from;
  const ret = peekReturnTo();
  if (ret && /^\/(note|test|results)/.test(pathname)) return ret;

  // /note/:id/quiz → обратно к конспекту
  const noteQuiz = pathname.match(/^\/note\/([^/]+)\/quiz/);
  if (noteQuiz) return `/note/${noteQuiz[1]}`;

  if (/^\/trainer\//.test(pathname)) return resumeTab("/library") ?? "/library";

  const sc = pathname.match(/^\/subject\/([^/]+)\//);
  if (sc) return `/subject/${sc[1]}`;
  if (/^\/subject\//.test(pathname)) return "/";
  if (/^\/(note|test|results)/.test(pathname)) return resumeTab("/");
  if (/^\/user\//.test(pathname)) return "/library";
  return null;
}

const titleListeners = new Set();
let screenTitle = null;
export function setScreenTitle(t) {
  screenTitle = t;
  for (const fn of titleListeners) fn(t);
}
export function onScreenTitle(fn) {
  titleListeners.add(fn);
  return () => titleListeners.delete(fn);
}
