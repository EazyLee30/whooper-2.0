"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Download, Share2, LoaderCircle, ImagePlus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { TemplateId } from "@/lib/presentation";
import { IMAGE_FORMATS, type ImageFormat } from "@/lib/image-formats";
import { downloadImage } from "@/lib/image-files";

type PreparedImage = { file: File; url: string };

export function ImageExport({
  root,
  template,
  date,
  disabled,
}: {
  root: RefObject<HTMLDivElement | null>;
  template: TemplateId;
  date: string;
  disabled: boolean;
}) {
  const [format, setFormat] = useState<ImageFormat>("post");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [canShare, setCanShare] = useState(false);
  const generation = useRef(0);
  const reduced = useReducedMotion();
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useEffect(
    () => () => images.forEach((image) => URL.revokeObjectURL(image.url)),
    [images],
  );

  function changeFormat(value: ImageFormat) {
    generation.current += 1;
    setFormat(value);
    setImages([]);
    setBusy(false);
    setMessage("");
  }
  async function prepare() {
    if (!root.current || busy || disabled) return;
    const request = ++generation.current;
    setBusy(true);
    setMessage("");
    try {
      const { prepareWorkoutImages } = await import("@/lib/export-workout");
      const files = await prepareWorkoutImages(
        root.current,
        template,
        date,
        format,
      );
      if (request !== generation.current) return;
      setImages(
        files.map((file) => ({ file, url: URL.createObjectURL(file) })),
      );
      setCanShare(!!navigator.canShare?.({ files }));
      setMessage(
        `已生成 ${files.length} 张图片。可逐张保存，或通过系统分享菜单发送。`,
      );
    } catch (error) {
      if (request === generation.current)
        setMessage(
          error instanceof Error ? error.message : "图片生成失败，请重试。",
        );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function share() {
    try {
      // Keep this call directly in the click handler: file sharing needs user activation.
      await navigator.share({ files: images.map((image) => image.file) });
      setMessage("已交给系统分享菜单，请在目标应用中确认发布。");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage(
        "当前设备无法分享这些文件。请逐张保存图片，再到 Instagram 选择 Post 或 Story。",
      );
    }
  }
  return (
    <section className="dash-image-export" aria-label="导出分享图片">
      <div className="dash-export-toolbar">
        <label>
          图片规格
          <select
            value={format}
            onChange={(event) =>
              changeFormat(event.target.value as ImageFormat)
            }
          >
            {Object.entries(IMAGE_FORMATS).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
                {item.height ? ` · ${item.width} × ${item.height}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          className="dash-text-button"
          disabled={disabled || busy}
          onClick={prepare}
        >
          {busy ? (
            <LoaderCircle size={16} className="dash-spin" />
          ) : (
            <ImagePlus size={16} />
          )}
          {busy ? "正在生成…" : images.length ? "重新生成图片" : "生成分享图片"}
        </button>
      </div>
      <p className="dash-preview-note">
        Post 可用于单图或轮播；Story
        预留上下留白。长记录自动分张，保留动作、组数和素材署名。
      </p>
      {images.length ? (
        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="dash-export-results"
        >
          <div className="dash-export-gallery">
            {images.map(({ file, url }, index) => (
              <figure key={url}>
                {/* Generated local PNGs use blob URLs and cannot go through the image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`分享图片预览，第 ${index + 1} 张`} />
                <figcaption>
                  <span>
                    {index + 1} / {images.length}
                  </span>
                  <button
                    className="dash-text-button"
                    disabled={disabled}
                    onClick={() => downloadImage(file)}
                  >
                    <Download size={14} />
                    保存图片 {index + 1}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          {canShare ? (
            <button
              className="dash-primary-button"
              disabled={disabled}
              onClick={share}
            >
              <Share2 size={16} />
              通过系统分享图片
            </button>
          ) : null}
          <p className="dash-preview-note">
            保存后，在 Instagram 新建 Post / Story
            并选择图片。系统分享菜单中的应用由设备决定。
          </p>
        </motion.div>
      ) : null}
      <p className="dash-action-message" role="status">
        {message}
      </p>
    </section>
  );
}
