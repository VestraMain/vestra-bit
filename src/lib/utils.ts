import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDeadline(deadline: string | null): {
  label: string;
  daysLeft: number | null;
  isUrgent: boolean;
} {
  if (!deadline) return { label: "No deadline", daysLeft: null, isUrgent: false };

  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Overdue", daysLeft: diffDays, isUrgent: true };
  } else if (diffDays === 0) {
    return { label: "Due today", daysLeft: 0, isUrgent: true };
  } else if (diffDays === 1) {
    return { label: "Due tomorrow", daysLeft: 1, isUrgent: true };
  } else {
    return {
      label: `${diffDays} days left`,
      daysLeft: diffDays,
      isUrgent: diffDays <= 5,
    };
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
