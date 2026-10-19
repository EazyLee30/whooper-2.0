import test from "node:test";
import assert from "node:assert/strict";
import {
  imagePlacement,
  imageBodyHeight,
  IMAGE_FORMATS,
} from "../lib/image-formats";

test("Instagram canvases contain complete pages with no clipping, including very tall originals", () => {
  for (const format of ["post", "square", "story"] as const) {
    for (const [width, height] of [
      [1086, 1556],
      [1080, 16000],
      [1080, 700],
    ]) {
      const box = imagePlacement(width, height, format);
      const target = IMAGE_FORMATS[format];
      assert.equal(box.width, 1080);
      assert.equal(box.height, target.height);
      assert.ok(box.x >= 0 - 1e-8);
      assert.ok(box.y >= target.insetY - 1e-8);
      assert.ok(box.x + box.drawWidth <= box.width + 1e-8);
      assert.ok(box.y + box.drawHeight <= box.height - target.insetY + 1e-8);
      assert.ok(
        Math.abs(box.drawWidth / box.drawHeight - width / height) < 1e-8,
      );
    }
  }
});

test("movement pagination budgets preserve header, credits without extra decorative padding", () => {
  assert.equal(imageBodyHeight("post", 270, 180), 900);
  assert.equal(imageBodyHeight("square", 270, 180), 630);
  assert.equal(imageBodyHeight("story", 270, 180), 1470);
  assert.equal(imageBodyHeight("original", 270, 180), 15550);
  assert.deepEqual(imagePlacement(1086, 1556, "original"), {
    width: 1086,
    height: 1556,
    x: 0,
    y: 0,
    drawWidth: 1086,
    drawHeight: 1556,
  });
});
