"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight, Check, Palette, X } from "lucide-react";
import { THEMES, isThemeId, type ThemeId } from "@/lib/presentation";

const STORAGE_KEY = "whooper-theme-v1";
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("whooper-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("whooper-theme", callback);
  };
};
const readTheme = (): ThemeId => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isThemeId(value) ? value : "flexoki";
  } catch {
    return "flexoki";
  }
};
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "flexoki" as ThemeId,
  );
  const setTheme = (value: ThemeId) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* Storage may be disabled. */
    }
    window.dispatchEvent(new Event("whooper-theme"));
  };
  return { theme, setTheme };
}

export function ThemePicker({
  theme,
  onChange,
}: {
  theme: ThemeId;
  onChange: (theme: ThemeId) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(0);
  const current = THEMES.find((item) => item.id === theme)!;
  const open = () => {
    setSelected(THEMES.findIndex((item) => item.id === theme));
    dialog.current?.showModal();
  };
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof Element &&
          event.target.closest(
            'input,textarea,select,[contenteditable="true"]',
          ))
      )
        return;
      if (
        event.key.toLowerCase() === "t" &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  });
  const step = (direction: number) =>
    setSelected((index) => (index + direction + THEMES.length) % THEMES.length);
  const apply = () => {
    onChange(THEMES[selected].id);
    dialog.current?.close();
  };
  return (
    <>
      <button
        className="dash-theme-trigger"
        onClick={open}
        title="切换主题 · T"
      >
        <Palette size={16} />
        <span>{current.name}</span>
        <kbd>T</kbd>
      </button>
      <dialog
        ref={dialog}
        className="dash-theme-dialog"
        aria-label="选择外观主题"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            step(event.key === "ArrowLeft" ? -1 : 1);
          }
          if (event.key === "Enter" && event.target === event.currentTarget) {
            event.preventDefault();
            apply();
          }
        }}
      >
        <div className="dash-dialog-top">
          <span>MAKE IT YOURS / 选择主题</span>
          <button
            className="dash-icon-button"
            aria-label="关闭主题选择"
            onClick={() => dialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        <div className="dash-theme-deck">
          {THEMES.map((item, index) => {
            let distance = (index - selected + THEMES.length) % THEMES.length;
            if (distance > THEMES.length / 2) distance -= THEMES.length;
            return (
              <button
                key={item.id}
                className="dash-theme-preview"
                tabIndex={Math.abs(distance) > 2 ? -1 : 0}
                aria-hidden={Math.abs(distance) > 2}
                aria-pressed={index === selected}
                aria-label={item.name}
                style={
                  {
                    "--distance": distance,
                    "--preview-bg": item.background,
                    "--preview-ink": item.ink,
                    "--preview-accent": item.accent,
                    zIndex: 10 - Math.abs(distance),
                  } as CSSProperties
                }
                onClick={() => {
                  if (selected === index) apply();
                  else setSelected(index);
                }}
              >
                <span className="dash-theme-mini">
                  <span>
                    whooper <small>YOUR DAILY CONTEXT</small>
                  </span>
                  <strong>
                    Move.
                    <br />
                    Recover.
                    <br />
                    <i>Repeat.</i>
                  </strong>
                  <span className="dash-theme-mini-bars">
                    {[35, 65, 45, 90, 75, 50, 80].map((height, n) => (
                      <i key={n} style={{ height: `${height}%` }} />
                    ))}
                  </span>
                </span>
                {theme === item.id ? (
                  <Check className="dash-theme-check" size={18} />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="dash-theme-caption">
          <button
            className="dash-icon-button"
            aria-label="上一个主题"
            onClick={() => step(-1)}
          >
            <ArrowLeft size={18} />
          </button>
          <span aria-live="polite">{THEMES[selected].name}</span>
          <button
            className="dash-icon-button"
            aria-label="下一个主题"
            onClick={() => step(1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <button className="dash-button" onClick={apply}>
          应用主题 <span>↵</span>
        </button>
        <p className="dash-theme-hint">← → 浏览 · Enter 应用 · Esc 关闭</p>
      </dialog>
    </>
  );
}
