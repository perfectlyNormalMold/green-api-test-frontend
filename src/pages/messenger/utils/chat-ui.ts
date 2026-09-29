import type { Chat } from "@/entities/chat/model";

const timeFormatter = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

export function formatTime(timestamp: number) {
  return timeFormatter.format(timestamp);
}

export function formatDay(timestamp: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (timestamp >= today.getTime()) return "Сегодня";
  if (timestamp >= yesterday.getTime()) return "Вчера";
  return dayFormatter.format(timestamp);
}

export function isSameDay(first: number, second: number) {
  return new Date(first).toDateString() === new Date(second).toDateString();
}

export function getInitials(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getLastMessage(chat: Chat) {
  return chat.messages.at(-1);
}
