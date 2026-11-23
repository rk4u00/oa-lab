/**
 * Top-of-page progress for navigations and the data they load. A busy period starts on a link click (or
 * `progress.begin()` before a slow action) and ends once the new route has rendered and every API request
 * started during the period has settled. Requests outside a busy period (polling, autosave) are not tracked.
 */
type Listener = (busy: boolean) => void;

// The first page load is a busy period from the start, so requests fired before any component mounts count.
let busy = typeof window !== 'undefined';
let navPending = false;
let pending = 0;
let settle: ReturnType<typeof setTimeout> | undefined;
let cap: ReturnType<typeof setTimeout> | undefined = busy ? setTimeout(() => finish(), 15_000) : undefined;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l(busy));

function finish() {
  clearTimeout(settle);
  clearTimeout(cap);
  navPending = false;
  pending = 0;
  if (busy) {
    busy = false;
    emit();
  }
}

function check() {
  clearTimeout(settle);
  // Short grace period: a page often fires its next request right after the previous one resolves.
  if (busy && !navPending && pending === 0) settle = setTimeout(finish, 120);
}

export const progress = {
  subscribe(l: Listener) {
    listeners.add(l);
    l(busy);
    return () => void listeners.delete(l);
  },
  /** Start (or extend) a busy period. `navigation` keeps it open until `routeChanged()`. */
  begin(navigation = false) {
    clearTimeout(settle);
    navPending = navPending || navigation;
    if (!busy) {
      busy = true;
      emit();
    }
    clearTimeout(cap);
    cap = setTimeout(finish, 15_000);
  },
  routeChanged() {
    navPending = false;
    // Let the new page mount and issue its requests before deciding it is done.
    setTimeout(check, 50);
  },
  /** Called by the API client for every request; only counts while a busy period is open. */
  track<T>(p: Promise<T>): Promise<T> {
    if (!busy) return p;
    pending++;
    clearTimeout(settle);
    return p.finally(() => {
      pending = Math.max(0, pending - 1);
      check();
    });
  },
  done: finish,
};
