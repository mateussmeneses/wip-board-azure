// Resolve an actual Azure DevOps board identity from its route, not from
// the user's broad WIP URL keyword. Pure, deterministic and safe for tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WIPBoardIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clean(part) {
    try { return decodeURIComponent(String(part || '')).trim(); }
    catch (_) { return String(part || '').trim(); }
  }

  function resolveBoardScope(location) {
    let url;
    try { url = new URL(String(location)); } catch (_) { return null; }
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    const bits = url.pathname.split('/').filter(Boolean).map(clean);
    let organization;
    let project;
    let path;
    if (host === 'dev.azure.com') {
      if (bits.length < 5) return null;
      [organization, project] = bits;
      path = bits.slice(2);
    } else if (host.endsWith('.visualstudio.com') &&
               host !== 'visualstudio.com') {
      if (bits.length < 4) return null;
      organization = host.slice(0, -'.visualstudio.com'.length);
      project = bits[0];
      path = bits.slice(1);
    } else return null;

    const i = path.findIndex(function (x, idx) {
      return x.toLowerCase() === '_boards' &&
        path[idx + 1] && path[idx + 1].toLowerCase() === 'board';
    });
    if (i < 0) return null;
    const tail = path.slice(i + 2);
    if (tail.length === 0) return null;

    // Include the FULL board route (team + board/backlog ID) so two roadmap
    // boards in one project never collide in chrome.storage.local.
    const identity = tail.map(function (x) { return x.toLowerCase(); }).join('/');
    const team = tail[0] && tail[0].toLowerCase() === 't' && tail[1]
      ? tail[1].toLowerCase() : 'default';

    // These identifiers select a board; temporary filters do not.
    const params = ['boardId', 'board', 'backlogLevel'];
    const persistent = params.filter(function (key) { return url.searchParams.has(key); })
      .map(function (key) { return key.toLowerCase() + '=' + url.searchParams.get(key).toLowerCase(); });
    return {
      organization: organization,
      project: project,
      team: team,
      board: identity + (persistent.length ? '?' + persistent.join('&') : ''),
    };
  }

  return { resolveBoardScope: resolveBoardScope };
});
