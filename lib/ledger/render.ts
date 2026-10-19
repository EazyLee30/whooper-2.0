import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { parse, type Font } from "opentype.js";
import { decryptArtwork } from "./crypto";
import { sheetGroups, SHEET_POSITIONS } from "./groups";
import { genderLabel } from "@/lib/profile/schema";
import type { ShareSnapshot } from "@/lib/dashboard/types";
let resources: Promise<{ paper: Buffer; hand: Font; cjk: Font }> | undefined;
function load() {
  return (resources ??= Promise.all([
    readFile(join(process.cwd(), "assets/ledger-paper.enc")),
    readFile(join(process.cwd(), "public/workout/fonts/Kalam-Regular.ttf")),
    readFile(join(process.cwd(), "assets/NotoSansCJKsc-Regular.otf")),
  ])
    .then(([paper, hand, cjk]) => ({
      paper: decryptArtwork(paper),
      hand: parse(Uint8Array.from(hand).buffer),
      cjk: parse(Uint8Array.from(cjk).buffer),
    }))
    .catch((error) => {
      resources = undefined;
      throw error;
    }));
}
export async function renderLedgerCard(snapshot: ShareSnapshot, page: number) {
  const { paper, hand, cjk } = await load();
  const groups = sheetGroups(snapshot.strength?.exercises ?? []);
  const pageCount = Math.max(1, Math.ceil(groups.length / 10));
  if (!Number.isInteger(page) || page < 0 || page >= pageCount) return null;
  const fontFor = (char: string) => (hand.charToGlyphIndex(char) ? hand : cjk);
  const advance = (value: string, size: number) =>
    Array.from(value).reduce(
      (width, char) => width + fontFor(char).getAdvanceWidth(char, size),
      0,
    );
  const ink: string[] = [];
  function line(
    value: string,
    x: number,
    y: number,
    size: number,
    maxWidth: number,
    center = false,
  ) {
    const width = advance(value, size);
    if (width > maxWidth) size *= maxWidth / width;
    if (center) x -= Math.min(width, maxWidth) / 2;
    for (const char of value) {
      const font = fontFor(char);
      ink.push(font.getPath(char, x, y, size).toSVG(2));
      x += font.getAdvanceWidth(char, size);
    }
  }
  line(snapshot.profile?.displayName ?? "", 178, 326, 42, 345);
  line(
    snapshot.profile ? genderLabel(snapshot.profile.gender) : "",
    650,
    326,
    43,
    55,
    true,
  );
  const parsed = new Date(`${snapshot.workout.date}T12:00:00Z`);
  const date = Number.isNaN(parsed.getTime())
    ? snapshot.workout.date
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
        .format(parsed)
        .toUpperCase();
  line(date, 811, 326, 33, 203);
  for (const [index, group] of groups
    .slice(page * 10, page * 10 + 10)
    .entries()) {
    const y = (SHEET_POSITIONS[index] / 100) * 1448 + 52;
    const words: string[] = [];
    let current = "";
    for (const char of group.name) {
      if (advance(current + char, 29) > 264 && current) {
        words.push(current);
        current = "";
      }
      current += char;
    }
    if (current) words.push(current);
    const nameSize = Math.min(29, 69 / Math.max(1, words.length));
    words.forEach((word, i) => {
      const baseline = y - ((words.length - 1) * nameSize) / 2 + i * nameSize;
      line(word, 76, baseline, nameSize, 264);
      line(word, 753, baseline, nameSize, 264);
    });
    const weight =
      group.weight === null
        ? "未记录"
        : (group.units === "kg"
            ? group.weight * 2.2046226218
            : group.weight
          ).toLocaleString("en-US", { maximumFractionDigits: 1 });
    line(String(group.count), 411, y, 36, 85, true);
    line(weight, 543, y, 36, 139, true);
    line(String(group.reps), 680, y, 36, 100, true);
  }
  if (!groups.length)
    line(snapshot.workout.name + " · 无动作明细", 78, 502, 28, 910);
  if (pageCount > 1)
    line(`${page + 1} / ${pageCount}`, 1014, 1375, 16, 90, true);
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1086" height="1448"><g fill="#070706">${ink.join("")}</g></svg>`,
  );
  return sharp(paper)
    .resize(1086, 1448, { fit: "fill" })
    .composite([{ input: overlay }])
    .png()
    .toBuffer();
}
