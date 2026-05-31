import test from "node:test";
import assert from "node:assert/strict";

/** Espelho da regra em apps/web/src/lib/compressReceiptImages.js */
function canSkipJpegReencode({ size, width, height, maxSide, maxBytes = 4 * 1024 * 1024 }) {
  if (!Number.isFinite(size) || size > maxBytes) return false;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  return Math.max(width, height) <= maxSide;
}

test("canSkipJpegReencode: ignora JPEG leve dentro da resolução", () => {
  assert.equal(canSkipJpegReencode({ size: 2 * 1024 * 1024, width: 1920, height: 1080, maxSide: 1920 }), true);
});

test("canSkipJpegReencode: reencoda JPEG leve mas muito grande em pixels", () => {
  assert.equal(canSkipJpegReencode({ size: 3 * 1024 * 1024, width: 4032, height: 3024, maxSide: 1920 }), false);
});

test("canSkipJpegReencode: reencoda JPEG acima do teto em bytes", () => {
  assert.equal(canSkipJpegReencode({ size: 5 * 1024 * 1024, width: 1600, height: 1200, maxSide: 2560 }), false);
});
