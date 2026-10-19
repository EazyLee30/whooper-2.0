import type { TemplateId } from "@/lib/presentation";
import {
  imagePlacement,
  imageBodyHeight,
  type ImageFormat,
} from "./image-formats";
type ImageSink = (canvas: HTMLCanvasElement, filename: string) => Promise<void>;

type Ink = {
  background: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
};
type SetRow = {
  label: string[];
  reps: string[];
  load: string[];
  height: number;
};
type MovementCard = {
  title: string[];
  rows: SetRow[];
  image: HTMLImageElement | null;
  height: number;
  contentTop: number;
};

const WIDTH = 1080;
const HEADER = 270;
const FOOTER = 180;
const CARD_GAP = 24;
const cleanText = (element: Element | null) =>
  element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法创建图片画布，请尝试打印。");
  return { canvas, context };
}

// Break long words and CJK text as well as ordinary space-separated names.
function wrap(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    if (!word) continue;
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function setFont(
  context: CanvasRenderingContext2D,
  size: number,
  family = "WPJetBrains, monospace",
) {
  context.font = `400 ${size}px ${family}`;
}

function text(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  context.fillStyle = color;
  context.textBaseline = "top";
  context.textAlign = "left";
  setFont(context, size);
  context.fillText(value, x, y);
}

async function imageFrom(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = source;
  await image.decode();
  return image;
}

// Only use vendored, same-origin SVG assets. Their vector paint follows the theme,
// just as the page's CSS masks do; there are no external export dependencies.
async function localSvg(
  source: string,
  color: string,
): Promise<HTMLImageElement> {
  const url = new URL(source, location.href);
  if (
    url.origin !== location.origin ||
    !/^\/workout(?:-guide)?\//.test(url.pathname)
  )
    throw new Error("Unsupported image source");
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error("Unable to load local artwork");
  const xml = new DOMParser().parseFromString(
    await response.text(),
    "image/svg+xml",
  );
  const svg = xml.documentElement;
  if (svg.localName !== "svg" || xml.querySelector("parsererror"))
    throw new Error("Invalid SVG artwork");
  svg
    .querySelectorAll("script, foreignObject")
    .forEach((node) => node.remove());
  svg.querySelectorAll("[href], [xlink\\:href]").forEach((node) => {
    for (const attribute of ["href", "xlink:href"]) {
      const value = node.getAttribute(attribute);
      if (value && !value.startsWith("#")) node.removeAttribute(attribute);
    }
  });
  svg.querySelectorAll("[fill], [stroke]").forEach((node) => {
    for (const attribute of ["fill", "stroke"]) {
      const value = node.getAttribute(attribute);
      if (value && value !== "none") node.setAttribute(attribute, color);
    }
  });
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("color", color);
  const serialized = new XMLSerializer()
    .serializeToString(svg)
    .replaceAll("currentColor", color);
  return imageFrom(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`,
  );
}

async function imageFile(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("图片导出失败，请重试。")),
      "image/png",
    ),
  );
  return new File([blob], filename, { type: "image/png" });
}

function drawSheetText(
  context: CanvasRenderingContext2D,
  element: HTMLElement,
  bounds: DOMRect,
  ratio: number,
) {
  const box = element.getBoundingClientRect();
  const css = getComputedStyle(element);
  const size = parseFloat(css.fontSize) * ratio;
  context.font = `${css.fontStyle} ${css.fontWeight} ${size}px ${css.fontFamily}`;
  context.fillStyle = css.color;
  context.strokeStyle = css.color;
  context.textBaseline = "middle";
  context.textAlign = css.textAlign === "center" ? "center" : "left";
  context.lineJoin = "round";
  const stroke = parseFloat(css.webkitTextStrokeWidth) * ratio || 0;
  if (stroke > 0) context.lineWidth = stroke;
  if ("letterSpacing" in context)
    context.letterSpacing = `${parseFloat(css.letterSpacing) * ratio || 0}px`;
  const left = (box.left - bounds.left + parseFloat(css.paddingLeft)) * ratio;
  const width =
    (box.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)) *
    ratio;
  const value =
    css.textTransform === "uppercase"
      ? cleanText(element).toUpperCase()
      : cleanText(element);
  const lines = wrap(context, value, width);
  const computedLine = parseFloat(css.lineHeight);
  const lineHeight = Number.isFinite(computedLine)
    ? computedLine * ratio
    : size * 1.2;
  const middle = (box.top - bounds.top + box.height / 2) * ratio;
  lines.forEach((line, index) => {
    const x = left + (context.textAlign === "center" ? width / 2 : 0);
    const y = middle + (index - (lines.length - 1) / 2) * lineHeight;
    if (stroke > 0) context.strokeText(line, x, y);
    context.fillText(line, x, y);
  });
  if ("letterSpacing" in context) context.letterSpacing = "0px";
}

async function exportLedger(
  root: HTMLElement,
  date: string,
  output: ImageSink,
) {
  await document.fonts.load("400 38px WPTrainingHand");
  await document.fonts.ready;
  const sheets = Array.from(
    root.querySelectorAll<HTMLElement>(".wp-original-sheet"),
  );
  if (!sheets.length) throw new Error("找不到完整训练单，请重新打开预览。");
  for (const [index, sheet] of sheets.entries()) {
    const original = sheet.querySelector<HTMLImageElement>(
      ".wp-original-sheet-image",
    );
    if (!original) throw new Error("训练单底图尚未准备好。");
    await original.decode();
    const bounds = sheet.getBoundingClientRect();
    if (bounds.width <= 0) throw new Error("请打开完整预览后再保存图片。");
    // The 1086 × 1448 artwork remains at its original resolution. A separate
    // footer retains unit and template-identity context outside the photograph.
    const { canvas, context } = makeCanvas(
      original.naturalWidth,
      original.naturalHeight + 108,
    );
    context.fillStyle = "#f3ecd9";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(original, 0, 0);
    const ratio = original.naturalWidth / bounds.width;
    sheet
      .querySelectorAll<HTMLElement>(
        ".wp-sheet-date, .wp-sheet-entry > span, .wp-sheet-empty, .wp-sheet-page",
      )
      .forEach((element) => drawSheetText(context, element, bounds, ratio));
    const unitCaption =
      cleanText(
        root.querySelector(".wp-original-source > div:first-child small"),
      ) ||
      "WEIGHT IN LBS · KG × 2.2046 · 0 = ZERO RECORDED LOAD · 未记录 = UNKNOWN";
    const identityCaption = cleanText(root.querySelector(".wp-sheet-art-note"));
    const footerTop = original.naturalHeight + 18;
    setFont(context, 13);
    const captions = [
      ...wrap(context, unitCaption, canvas.width - 64),
      ...wrap(context, identityCaption, canvas.width - 64),
    ];
    captions.forEach((line, lineIndex) =>
      text(context, line, 32, footerTop + lineIndex * 19, 13, "#74624c"),
    );
    await output(
      canvas,
      `whooper-workout-${date}-ledger${sheets.length > 1 ? `-${index + 1}` : ""}.png`,
    );
  }
}

function colors(root: HTMLElement): Ink {
  const css = getComputedStyle(root);
  const variable = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    background: variable("--dash-bg", "#fffcf0"),
    text: css.color || "#25221e",
    muted: variable("--dash-muted", "#7b776d"),
    accent: variable("--dash-accent", "#205ea6"),
    line: variable("--dash-line", "#dcd6c9"),
  };
}

async function movementArt(card: HTMLElement, accent: string) {
  const frames = Array.from(
    card.querySelectorAll<HTMLElement>(".wp-movement-frame"),
  );
  const frame =
    frames.find((node) => Number(getComputedStyle(node).opacity) >= 0.5) ??
    frames[0];
  if (!frame) return null;
  const mask = getComputedStyle(frame).getPropertyValue("--wp-frame");
  const source = mask.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
  if (!source) return null;
  try {
    return await localSvg(source, accent);
  } catch {
    return null;
  }
}

async function movementCards(
  root: HTMLElement,
  context: CanvasRenderingContext2D,
  ink: Ink,
  bodyHeight: number,
): Promise<MovementCard[]> {
  const result: MovementCard[] = [];
  for (const card of root.querySelectorAll<HTMLElement>(".wp-original-card")) {
    setFont(context, 28);
    const title = wrap(context, cleanText(card.querySelector("h4")), 908);
    const rows = Array.from(
      card.querySelectorAll(".wp-original-sets > li"),
    ).map((row) => {
      setFont(context, 20);
      const label = wrap(
        context,
        cleanText(row.querySelector(".wp-original-set-n")),
        190,
      );
      setFont(context, 22);
      const reps = wrap(
        context,
        cleanText(row.querySelector(".wp-original-set-r")),
        210,
      );
      const load = wrap(
        context,
        cleanText(row.querySelector(".wp-original-set-w")),
        216,
      );
      return {
        label,
        reps,
        load,
        height: Math.max(
          46,
          Math.max(label.length, reps.length, load.length) * 28 + 12,
        ),
      };
    });
    const image = await movementArt(card, ink.accent);
    // A long session may span several PNGs. Split only between full set rows;
    // every continuation repeats the exercise name and artwork.
    let offset = 0;
    do {
      const continuedTitle = offset > 0 ? [...title, "(continued)"] : title;
      const contentTop = 24 + continuedTitle.length * 36 + 22;
      const rowBudget = bodyHeight - contentTop - 52;
      if (rowBudget < 180)
        throw new Error("动作名称过长，无法生成图片；请使用打印保存完整记录。");
      const chunk: SetRow[] = [];
      let rowHeight = 0;
      while (
        offset < rows.length &&
        rowHeight + rows[offset].height <= rowBudget
      ) {
        rowHeight += rows[offset].height;
        chunk.push(rows[offset++]);
      }
      if (!chunk.length && offset < rows.length)
        throw new Error("单组记录过长，无法生成图片；请使用打印保存完整记录。");
      result.push({
        title: continuedTitle,
        rows: chunk,
        image,
        contentTop,
        height: contentTop + Math.max(180, rowHeight) + 26,
      });
    } while (offset < rows.length);
  }
  return result;
}

async function exportIllustrated(
  root: HTMLElement,
  date: string,
  output: ImageSink,
  format: ImageFormat,
) {
  await Promise.all([
    document.fonts.load("400 28px WPJetBrains"),
    document.fonts.load("400 28px WPGeist"),
  ]);
  await document.fonts.ready;
  const ink = colors(root);
  const measurement = makeCanvas(WIDTH, 1);
  const bodyHeight = imageBodyHeight(format, HEADER, FOOTER);
  const cards = await movementCards(root, measurement.context, ink, bodyHeight);
  measurement.canvas.width = measurement.canvas.height = 0;
  const pages: MovementCard[][] = [[]];
  let pageHeight = 0;
  for (const card of cards) {
    if (
      pages.at(-1)!.length &&
      pageHeight + card.height + CARD_GAP > bodyHeight
    ) {
      pages.push([]);
      pageHeight = 0;
    }
    pages.at(-1)!.push(card);
    pageHeight += card.height + CARD_GAP;
  }
  const metrics = Array.from(root.querySelectorAll(".wp-original-meta > span"))
    .slice(1)
    .map(cleanText);
  let logo: HTMLImageElement | null = null;
  try {
    logo = await localSvg("/workout/whoop/wordmark-black.svg", ink.text);
  } catch {
    /* Text credit below remains available. */
  }
  for (const [pageIndex, page] of pages.entries()) {
    const body = page.reduce(
      (height, card) => height + card.height + CARD_GAP,
      0,
    );
    const { canvas, context } = makeCanvas(
      WIDTH,
      HEADER + (body || 250) + FOOTER,
    );
    context.fillStyle = ink.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    text(context, "WHOOPER / WORKOUT", 60, 55, 34, ink.text);
    text(
      context,
      `${date}${pages.length > 1 ? ` · ${pageIndex + 1} / ${pages.length}` : ""}`,
      60,
      108,
      24,
      ink.muted,
    );
    metrics.forEach((value, index) =>
      text(context, value, 60, 158 + index * 36, 20, ink.text),
    );
    let y = HEADER;
    if (!page.length) {
      const title =
        cleanText(root.querySelector(".wp-no-exercises h4")) || "Workout";
      setFont(context, 28);
      wrap(context, title, 960).forEach((line, index) =>
        text(context, line, 60, y + index * 38, 28, ink.text),
      );
      text(
        context,
        "此运动没有已记录的 Strength Trainer 动作明细。",
        60,
        y + 120,
        20,
        ink.muted,
      );
      y += 250;
    }
    for (const card of page) {
      context.strokeStyle = ink.line;
      context.lineWidth = 2;
      context.strokeRect(60, y, 960, card.height);
      card.title.forEach((line, index) =>
        text(context, line, 86, y + 24 + index * 36, 28, ink.text),
      );
      const top = y + card.contentTop;
      if (card.image) context.drawImage(card.image, 86, top, 180, 180);
      else text(context, "·", 160, top + 60, 46, ink.muted);
      let rowY = top + 6;
      for (const row of card.rows) {
        row.label.forEach((line, index) =>
          text(context, line, 310, rowY + index * 28, 20, ink.muted),
        );
        row.reps.forEach((line, index) =>
          text(context, line, 535, rowY + index * 28, 22, ink.text),
        );
        row.load.forEach((line, index) =>
          text(context, line, 790, rowY + index * 28, 22, ink.accent),
        );
        rowY += row.height;
      }
      y += card.height + CARD_GAP;
    }
    text(
      context,
      logo ? "DATA FROM" : "DATA FROM WHOOP",
      60,
      y + 16,
      15,
      ink.muted,
    );
    if (logo)
      context.drawImage(
        logo,
        60,
        y + 44,
        140,
        (140 * logo.naturalHeight) / logo.naturalWidth,
      );
    text(
      context,
      "Exercise art: Bryl Lim / Workout Guide + Everkinetic · CC BY-SA 4.0",
      60,
      y + 100,
      13,
      ink.muted,
    );
    text(
      context,
      "github.com/bryllim/workout-guide · creativecommons.org/licenses/by-sa/4.0",
      60,
      y + 123,
      12,
      ink.muted,
    );
    text(
      context,
      "Artwork recolored for the selected theme. Workout records are unchanged.",
      60,
      y + 146,
      12,
      ink.muted,
    );
    await output(
      canvas,
      `whooper-workout-${date}-movement${pages.length > 1 ? `-${pageIndex + 1}` : ""}.png`,
    );
  }
}

/** Save a full private preview locally. No workout data is sent to a service. */
export async function prepareWorkoutImages(
  element: HTMLElement,
  template: TemplateId,
  date: string,
  format: ImageFormat = "original",
): Promise<File[]> {
  if (template !== "ledger" && template !== "illustrated")
    throw new Error("这个模板暂不支持 PNG 导出，请使用打印。");
  const root = element.matches(".wp")
    ? element
    : element.querySelector<HTMLElement>(".wp");
  if (!root || root.classList.contains("wp-compact"))
    throw new Error("请打开完整预览后再保存图片。");
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "session";
  const files: File[] = [];
  const output: ImageSink = async (source, filename) => {
    const placement = imagePlacement(source.width, source.height, format);
    const { canvas, context } = makeCanvas(placement.width, placement.height);
    context.fillStyle =
      template === "ledger" ? "#f3ecd9" : colors(root).background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      source,
      placement.x,
      placement.y,
      placement.drawWidth,
      placement.drawHeight,
    );
    files.push(
      await imageFile(canvas, filename.replace(".png", `-${format}.png`)),
    );
    source.width = source.height = canvas.width = canvas.height = 0;
  };
  if (template === "ledger") await exportLedger(root, safeDate, output);
  else await exportIllustrated(root, safeDate, output, format);
  return files;
}
