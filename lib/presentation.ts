export const THEMES = [
  {
    id: "whooper",
    name: "Whooper",
    background: "#f6f7f0",
    ink: "#18372d",
    accent: "#18372d",
    dark: false,
  },
  {
    id: "flexoki",
    name: "Flexoki",
    background: "#fffcf0",
    ink: "#100f0f",
    accent: "#205ea6",
    dark: false,
  },
  {
    id: "monochrome",
    name: "Monochrome",
    background: "#f7f7f7",
    ink: "#181818",
    accent: "#181818",
    dark: false,
  },
  {
    id: "latte",
    name: "Latte",
    background: "#eff1f5",
    ink: "#4c4f69",
    accent: "#8839ef",
    dark: false,
  },
  {
    id: "tokyo",
    name: "Tokyo Night",
    background: "#1a1b26",
    ink: "#c0caf5",
    accent: "#7aa2f7",
    dark: true,
  },
  {
    id: "gruvbox",
    name: "Gruvbox",
    background: "#282828",
    ink: "#ebdbb2",
    accent: "#d8a657",
    dark: true,
  },
  {
    id: "nord",
    name: "Nord",
    background: "#2e3440",
    ink: "#eceff4",
    accent: "#88c0d0",
    dark: true,
  },
  {
    id: "rose",
    name: "Rosé Pine",
    background: "#191724",
    ink: "#e0def4",
    accent: "#ebbcba",
    dark: true,
  },
  {
    id: "matrix",
    name: "Matrix",
    background: "#050a06",
    ink: "#c5f3c8",
    accent: "#00ff70",
    dark: true,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const isThemeId = (value: unknown): value is ThemeId =>
  THEMES.some((theme) => theme.id === value);

export const TEMPLATES = [
  {
    id: "ledger",
    name: "功夫训练单",
    english: "The training ledger",
    category: "复古手写",
    description: "李小龙训练单启发。纸张、墨迹，专注每一次重复。",
    number: "01",
  },
  {
    id: "illustrated",
    name: "动作图鉴",
    english: "The movement guide",
    category: "动作插画",
    description: "Workout Guide 插画，让每一个动作都有画面。",
    number: "02",
  },
  {
    id: "journal",
    name: "训练日志",
    english: "The daily journal",
    category: "个人记录",
    description: "延续 github.io 的排版，留下一页自己的训练记录。",
    number: "03",
  },
  {
    id: "pulse",
    name: "数字脉搏",
    english: "The performance card",
    category: "数据卡片",
    description: "用醒目的数字，分享这一次的投入。",
    number: "04",
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];
export const isTemplateId = (value: unknown): value is TemplateId =>
  TEMPLATES.some((template) => template.id === value);
