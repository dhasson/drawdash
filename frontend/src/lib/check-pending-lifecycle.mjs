import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const opsUrl = pathToFileURL(path.join(root, 'board-suggestion-ops.ts')).href;

const runner = `
import assert from 'node:assert/strict';
import {
  PENDING_META_KEY,
  mockSuggestionFromPrompt,
  partitionPending,
  swimlaneSuggestion,
} from ${JSON.stringify(opsUrl)};

const lanes = swimlaneSuggestion(['Passenger', 'Aircraft', 'Suitcase'], 'sug-lanes');
assert.equal(lanes.ops.length, 3);

const fromPrompt = mockSuggestionFromPrompt('aircraft passenger suitcase as swimlanes');
assert.equal(fromPrompt.ops.length, 3);

const shapes = [
  { id: 'stage-1', meta: {} },
  { id: 'lane-1', meta: { [PENDING_META_KEY]: 'sug-lanes' } },
  { id: 'lane-2', meta: { [PENDING_META_KEY]: 'sug-lanes' } },
];
const before = partitionPending(shapes, 'sug-lanes');
assert.deepEqual(before.pendingIds, ['lane-1', 'lane-2']);
assert.deepEqual(before.otherIds, ['stage-1']);

// Commit clears pending meta; reject would delete pending ids
const afterCommit = shapes.map((s) =>
  before.pendingIds.includes(s.id)
    ? { id: s.id, meta: {} }
    : s,
);
const committed = partitionPending(afterCommit, 'sug-lanes');
assert.deepEqual(committed.pendingIds, []);
assert.deepEqual(committed.otherIds.sort(), ['lane-1', 'lane-2', 'stage-1'].sort());

const afterReject = shapes.filter((s) => !before.pendingIds.includes(s.id));
const rejected = partitionPending(afterReject, 'sug-lanes');
assert.deepEqual(rejected.pendingIds, []);
assert.deepEqual(rejected.otherIds, ['stage-1']);

console.log('pending-lifecycle ok');
`;

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', runner],
  { encoding: 'utf8' },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'pending lifecycle failed\n');
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
