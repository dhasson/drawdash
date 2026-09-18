import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const templatesSrc = fs.readFileSync(path.join(root, 'workshop-templates.ts'), 'utf8');
const exportSrc = fs.readFileSync(path.join(root, 'leavebehind-export.ts'), 'utf8');

const ids = [...templatesSrc.matchAll(/id: '(journey|prioritization-2x2|sticky-cluster|service-map)'/g)].map(
  (m) => m[1],
);
assert.equal(ids.length, 4, 'expected four template ids');
assert.equal(new Set(ids).size, 4, 'template ids must be unique');
assert.match(templatesSrc, /export function buildWorkshopTemplateShapes/);
assert.match(templatesSrc, /case 'journey':/);
assert.match(templatesSrc, /case 'prioritization-2x2':/);
assert.match(templatesSrc, /case 'sticky-cluster':/);
assert.match(templatesSrc, /case 'service-map':/);
assert.match(templatesSrc, /const _exhaustive: never/);

assert.match(exportSrc, /export function downloadPngFromBase64/);
assert.match(exportSrc, /export function openPdfPrintFromBase64/);
assert.match(exportSrc, /export function assertExportablePngBase64/);

function assertExportablePngBase64(base64) {
  if (!base64 || base64.length < 32) throw new Error('Empty board export');
  return base64;
}
assert.throws(() => assertExportablePngBase64(null), /Empty board/);
assert.throws(() => assertExportablePngBase64('short'), /Empty board/);
assert.equal(assertExportablePngBase64('a'.repeat(64)).length, 64);

console.log('ok workshop template + export static unit gate');
