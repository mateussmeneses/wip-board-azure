// Daily session selection — pure helpers for associating daily commitments
// with their immutable planning snapshots. No DOM, Chrome or network access.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WIPBoardDailySession = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function matchingCommitment(commitments, baseSnapshot) {
    if (!baseSnapshot || baseSnapshot.id == null) return null;
    const baseId = String(baseSnapshot.id);
    return (Array.isArray(commitments) ? commitments : []).find(function (c) {
      return c && c.baseSnapshotId != null && String(c.baseSnapshotId) === baseId;
    }) || null;
  }

  // Commitments are returned newest-first by the store. A commitment whose
  // baseline was pruned is NOT paired with an unrelated snapshot.
  function activeSession(commitments, snapshots) {
    const byId = new Map((Array.isArray(snapshots) ? snapshots : [])
      .filter(function (s) { return s && s.id != null; })
      .map(function (s) { return [String(s.id), s]; }));
    for (const commitment of (Array.isArray(commitments) ? commitments : [])) {
      if (!commitment || commitment.baseSnapshotId == null) continue;
      const base = byId.get(String(commitment.baseSnapshotId));
      if (base) return { commitment: commitment, base: base };
    }
    return null;
  }

  function isValidLaterSnapshot(initial, later) {
    if (!initial || !later || !initial.scope || !later.scope) return false;
    const fields = ['organization', 'project', 'team', 'board'];
    if (!fields.every(function (f) { return initial.scope[f] === later.scope[f]; })) return false;
    const epoch = function (s) {
      if (!s.capturedAt) return NaN;
      return Number(s.capturedAt.epochMs ?? Date.parse(s.capturedAt.iso));
    };
    return Number.isFinite(epoch(initial)) && Number.isFinite(epoch(later))
      && epoch(later) > epoch(initial);
  }

  return { matchingCommitment: matchingCommitment, activeSession: activeSession,
    isValidLaterSnapshot: isValidLaterSnapshot };
});
