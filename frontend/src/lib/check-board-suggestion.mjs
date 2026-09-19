import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const opsSrc = fs.readFileSync(path.join(root, 'board-suggestion-ops.ts'), 'utf8');
const mapSrc = fs.readFileSync(path.join(root, 'board-suggestion.ts'), 'utf8');

assert.match(opsSrc, /export type ShapeOp/);
assert.match(opsSrc, /kind: 'add_geo'/);
assert.match(opsSrc, /kind: 'add_note'/);
assert.match(opsSrc, /kind: 'update_label'/);
assert.match(opsSrc, /kind: 'delete_shape'/);
assert.match(opsSrc, /export interface BoardSuggestion/);
assert.match(opsSrc, /export function assertShapeOp/);
assert.match(opsSrc, /export function assertBoardSuggestion/);
assert.match(opsSrc, /export function partitionPending/);
assert.match(opsSrc, /export function journeyStageSuggestion/);
assert.match(opsSrc, /PENDING_META_KEY/);
assert.match(opsSrc, /unknown kind/);

assert.match(mapSrc, /export function suggestionToPartials/);
assert.match(mapSrc, /const _exhaustive: never/);
assert.match(mapSrc, /from '\.\/board-suggestion-ops'/);

const opsUrl = pathToFileURL(path.join(root, 'board-suggestion-ops.ts')).href;
const runner = `
import assert from 'node:assert/strict';
import {
  assertShapeOp,
  assertBoardSuggestion,
  partitionPending,
  journeyStageSuggestion,
  PENDING_META_KEY,
} from ${JSON.stringify(opsUrl)};

const journey = journeyStageSuggestion('sug-test');
assert.equal(journey.ops.length, 5);
assert.deepEqual(
  journey.ops.map((op) => (op.kind === 'add_geo' ? op.label : null)),
  ['Discover', 'Decide', 'Onboard', 'Adopt', 'Expand'],
);

assert.throws(() => assertShapeOp({ kind: 'warp_drive' }, 0), /unknown kind/);
assert.throws(() => assertBoardSuggestion({ id: 'x', ops: [{ kind: 'nope' }] }), /unknown kind/);

const parts = partitionPending(
  [
    { id: 'a', meta: { [PENDING_META_KEY]: 'sug-test' } },
    { id: 'b', meta: {} },
    { id: 'c', meta: { [PENDING_META_KEY]: 'other' } },
  ],
  'sug-test',
);
assert.deepEqual(parts.pendingIds, ['a']);
assert.deepEqual(parts.otherIds, ['b', 'c']);

const t0 = performance.now();
for (let i = 0; i < 200; i++) {
  journeyStageSuggestion('s' + i);
  partitionPending([{ id: 'a', meta: { [PENDING_META_KEY]: 's' + i } }], 's' + i);
}
const perCall = (performance.now() - t0) / 200;
assert.ok(perCall < 5, 'mapper budget ' + perCall);
console.log('board-suggestion ok');
console.log('mapper_ms=' + perCall.toFixed(3));
`;

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', runner],
  { encoding: 'utf8' },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || 'ops runner failed\n');
  process.exit(result.status || 1);
}
process.stdout.write(result.stdout);
