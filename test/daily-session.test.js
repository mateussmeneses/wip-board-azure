const { test } = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../src/data/daily-session.js');

const scope = { organization:'org', project:'proj', team:'team', board:'board' };
const snap = (id, t, s=scope) => ({id,scope:s,capturedAt:{epochMs:t}});
const commitment = (id, baseSnapshotId) => ({id,baseSnapshotId});
test('each planning snapshot selects only its own commitment', () => {
  const c=[commitment('y','s2'),commitment('x','s1')];
  assert.equal(Session.matchingCommitment(c,snap('s1',1)).id,'x');
  assert.equal(Session.matchingCommitment(c,snap('s3',3)),null);
});
test('active session anchors the newest compatible plan to its exact baseline', () => {
  const s=Session.activeSession([commitment('new','s2'),commitment('old','s1')],[snap('s3',3),snap('s2',2),snap('s1',1)]);
  assert.equal(s.commitment.id,'new');assert.equal(s.base.id,'s2');
});
test('deleted baseline never binds to a different snapshot', () => {
  assert.equal(Session.activeSession([commitment('x','deleted')],[snap('other',1)]),null);
});
test('invalid newest commitment does not corrupt an older valid session', () => {
  const s=Session.activeSession([commitment('x','missing'),commitment('y','valid')],[snap('valid',1)]);
  assert.equal(s.commitment.id,'y');
});
test('later comparison requires matching board identity and strictly later time', () => {
  assert.equal(Session.isValidLaterSnapshot(snap('a',1),snap('b',2)),true);
  assert.equal(Session.isValidLaterSnapshot(snap('a',2),snap('b',2)),false);
  assert.equal(Session.isValidLaterSnapshot(snap('a',3),snap('b',2)),false);
  assert.equal(Session.isValidLaterSnapshot(snap('a',1),snap('b',2,{...scope,board:'other'})),false);
});
test('no implicit session when no commitment exists', () => {
  assert.equal(Session.activeSession([], [snap('a',1)]),null);
  assert.equal(Session.matchingCommitment([],snap('a',1)),null);
});
