export const IMAGE_FORMATS = {
  original: { label: "原始长图", width: 1080, height: null, insetY: 0 },
  post: { label: "IG Post · 4:5", width: 1080, height: 1350, insetY: 0 },
  square: { label: "IG Post · 1:1", width: 1080, height: 1080, insetY: 0 },
  story: { label: "IG Story · 9:16", width: 1080, height: 1920, insetY: 0 },
} as const;
export type ImageFormat = keyof typeof IMAGE_FORMATS;

/** Contain the entire page, including attribution, inside a social canvas. */
export function imagePlacement(
  width: number,
  height: number,
  format: ImageFormat,
) {
  const target = IMAGE_FORMATS[format];
  if (!target.height)
    return { width, height, x: 0, y: 0, drawWidth: width, drawHeight: height };
  const insetX = 0;
  const scale = Math.min(
    (target.width - insetX * 2) / width,
    (target.height - target.insetY * 2) / height,
  );
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    width: target.width,
    height: target.height,
    x: (target.width - drawWidth) / 2,
    y: (target.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  };
}

export function imageBodyHeight(
  format: ImageFormat,
  header: number,
  footer: number,
) {
  const target = IMAGE_FORMATS[format];
  return (
    (target.height ? target.height - 2 * target.insetY : 16000) -
    header -
    footer
  );
}
