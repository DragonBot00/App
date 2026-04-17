/**
 * Web browsers have a tab title and favicon which can be updated to show there are unread comments
 *
 * FIX for #86679: Document title flickers when navigating
 *
 * Three changes from original:
 * 1. Gate document.title = '' behind popstate flag â€” only clear on back/forward nav
 *    (the Chrome bug this works around). Normal navigation skips the blank intermediate.
 * 2. Coalesce rapid calls via requestAnimationFrame â€” multiple triggers during a single
 *    navigation transition produce one frame-level write instead of N competing setTimeout(0)s.
 * 3. Skip no-op writes â€” if the computed title matches current document.title, don't touch it.
 */
import CONFIG from '@src/CONFIG';
import type UpdateUnread from './types';

let unreadTotalCount = 0;
let currentPageTitle = '';

// rAF coalescing state
let pendingRAF: number | null = null;

// Only set true by popstate (actual back/forward navigation),
// which is the only case the Chrome title-reversion workaround is needed for.
let isPopstateNavigation = false;

/**
 * Compute the target title from current state
 */
function getTargetTitle(): string {
    const hasUnread = unreadTotalCount !== 0;
    const baseTitle = currentPageTitle || CONFIG.SITE_TITLE;
    return hasUnread ? `(${unreadTotalCount}) ${baseTitle}` : baseTitle;
}

/**
 * Commit title + favicon in a single rAF callback.
 * Multiple scheduleCommit() calls within the same frame produce one write.
 */
function commitTitleAndFavicon() {
    pendingRAF = null;
    const target = getTargetTitle();

    // Only apply the Chrome back-nav workaround when we actually came from popstate
    if (isPopstateNavigation) {
        document.title = '';
        isPopstateNavigation = false;
    }

    // Skip no-op writes â€” prevents unnecessary paint cycles
    if (target !== document.title) {
        document.title = target;
    }

    // Update favicon
    const hasUnread = unreadTotalCount !== 0;
    const favicon = document.getElementById('favicon');
    if (favicon instanceof HTMLLinkElement) {
        favicon.href = hasUnread ? CONFIG.FAVICON.UNREAD : CONFIG.FAVICON.DEFAULT;
    }
}

/**
 * Schedule a single rAF-coalesced title commit.
 * If already scheduled, the pending one is cancelled â€” only the latest state wins.
 */
function scheduleCommit() {
    if (pendingRAF !== null) {
        cancelAnimationFrame(pendingRAF);
    }
    pendingRAF = requestAnimationFrame(commitTitleAndFavicon);
}

/**
 * Set the current page-specific title (called by useDocumentTitle hook)
 * @param title - The page-specific title
 */
function setPageTitle(title: string) {
    currentPageTitle = title;
    scheduleCommit();
}

/**
 * Update unread count and schedule a title commit
 */
const updateUnread: UpdateUnread = (totalCount) => {
    unreadTotalCount = totalCount;
    scheduleCommit();
};

/**
 * Popstate handler â€” only this path triggers the Chrome workaround.
 * Non-route-changing popstates are harmless (no-op if title unchanged).
 */
window.addEventListener('popstate', () => {
    isPopstateNavigation = true;
    updateUnread(unreadTotalCount);
});

export default updateUnread;
export {setPageTitle};
