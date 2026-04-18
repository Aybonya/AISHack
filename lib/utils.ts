import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const now = Date.now();
  const target = new Date(value).getTime();
  const diffMinutes = Math.round((target - now) / 60000);
  const formatter = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?;:()"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => normalizeText(value).includes(normalizeText(pattern)));
}

export function withTime(baseDate: Date, time: string, dayOffset = 0) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function getWeekdayIndex(value: string) {
  const day = new Date(value).getDay();
  return day === 0 ? 7 : day;
}

export const WEEKDAY_LABELS = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Вс",
];

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
