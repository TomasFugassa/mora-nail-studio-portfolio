// The showcase has one presentation, with motion enabled on the normal URL.
class ShowcaseMotion extends EventTarget {
  readonly matches: boolean = false;
}
export const motionPreference = new ShowcaseMotion();
document.documentElement.dataset.motion = 'full';

// Old preview links and saved choices now resolve to that same presentation.
try { localStorage.removeItem('mora:motion'); } catch { /* Storage is optional. */ }
const url = new URL(location.href);
if (url.searchParams.has('motion')) {
  url.searchParams.delete('motion');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
