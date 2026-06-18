import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode
} from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export type IconButtonProps = Omit<ButtonProps, "children" | "leadingIcon" | "trailingIcon"> & {
  "aria-label": string;
  icon: ReactNode;
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  status: string;
  label?: string;
};

export type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "aside" | "div";
  density?: "normal" | "compact";
};

export type PanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "between" | "end";
};

export type TabsProps = HTMLAttributes<HTMLDivElement> & {
  tabs: Array<{ id: string; label: ReactNode; count?: number }>;
  activeId: string;
  onSelect?: (id: string) => void;
};

export type ListRowProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
};

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export type NoticeProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  actions?: ReactNode;
};

export type MetricProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
};
