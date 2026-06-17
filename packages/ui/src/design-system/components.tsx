import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode
} from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function Button({
  children,
  className,
  disabled,
  leadingIcon,
  loading = false,
  size = "md",
  trailingIcon,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "pf-button",
        `pf-button-${variant}`,
        `pf-button-${size}`,
        loading && "is-loading",
        className
      )}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? <span className="pf-spinner" aria-hidden="true" /> : leadingIcon}
      <span className="pf-button-label">{children}</span>
      {trailingIcon}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "children" | "leadingIcon" | "trailingIcon"> & {
  "aria-label": string;
  icon: ReactNode;
};

export function IconButton({
  className,
  icon,
  size = "md",
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <Button
      className={cx("pf-icon-button", className)}
      size={size}
      variant={variant}
      {...props}
    >
      {icon}
    </Button>
  );
}

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={cx("pf-badge", `pf-tone-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}

export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  status: string;
  label?: string;
};

export function StatusChip({ className, label, status, ...props }: StatusChipProps) {
  return (
    <span
      className={cx("pf-status-chip", `pf-status-${normalizeStatus(status)}`, className)}
      {...props}
    >
      <span className="pf-status-dot" aria-hidden="true" />
      {label ?? humanizeStatus(status)}
    </span>
  );
}

export type PanelProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "aside" | "div";
  density?: "normal" | "compact";
};

export function Panel({
  as: Component = "section",
  children,
  className,
  density = "normal",
  ...props
}: PanelProps) {
  return (
    <Component className={cx("pf-panel", `pf-panel-${density}`, className)} {...props}>
      {children}
    </Component>
  );
}

export type PanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PanelHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
  ...props
}: PanelHeaderProps) {
  return (
    <div className={cx("pf-panel-header", className)} {...props}>
      <div className="pf-panel-heading">
        {eyebrow ? <div className="pf-eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="pf-panel-actions">{actions}</div> : null}
    </div>
  );
}

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "between" | "end";
};

export function Toolbar({ align = "between", children, className, ...props }: ToolbarProps) {
  return (
    <div className={cx("pf-toolbar", `pf-toolbar-${align}`, className)} {...props}>
      {children}
    </div>
  );
}

export type TabsProps = HTMLAttributes<HTMLDivElement> & {
  tabs: Array<{ id: string; label: ReactNode; count?: number }>;
  activeId: string;
  onSelect?: (id: string) => void;
};

export function Tabs({ activeId, className, onSelect, tabs, ...props }: TabsProps) {
  return (
    <div className={cx("pf-tabs", className)} role="tablist" {...props}>
      {tabs.map((tab) => (
        <button
          aria-selected={tab.id === activeId}
          className="pf-tab"
          key={tab.id}
          onClick={() => onSelect?.(tab.id)}
          role="tab"
          type="button"
        >
          <span>{tab.label}</span>
          {typeof tab.count === "number" ? <span className="pf-tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export type ListRowProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
};

export function ListRow({
  className,
  description,
  leading,
  meta,
  selected = false,
  title,
  trailing,
  ...props
}: ListRowProps) {
  return (
    <div className={cx("pf-list-row", selected && "is-selected", className)} {...props}>
      {leading ? <div className="pf-list-leading">{leading}</div> : null}
      <div className="pf-list-main">
        <div className="pf-list-title">{title}</div>
        {description ? <div className="pf-list-description">{description}</div> : null}
        {meta ? <div className="pf-list-meta">{meta}</div> : null}
      </div>
      {trailing ? <div className="pf-list-trailing">{trailing}</div> : null}
    </div>
  );
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

export function EmptyState({
  actions,
  className,
  description,
  icon,
  title,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cx("pf-empty-state", className)} {...props}>
      {icon ? <div className="pf-empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="pf-empty-actions">{actions}</div> : null}
    </div>
  );
}

export type NoticeProps = HTMLAttributes<HTMLDivElement> & {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  actions?: ReactNode;
};

export function Notice({
  actions,
  children,
  className,
  title,
  tone = "info",
  ...props
}: NoticeProps) {
  return (
    <div className={cx("pf-notice", `pf-tone-${tone}`, className)} role="status" {...props}>
      <div className="pf-notice-body">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {actions ? <div className="pf-notice-actions">{actions}</div> : null}
    </div>
  );
}

export type MetricProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
};

export function Metric({
  className,
  hint,
  label,
  tone = "neutral",
  value,
  ...props
}: MetricProps) {
  return (
    <div className={cx("pf-metric", `pf-tone-${tone}`, className)} {...props}>
      <span className="pf-metric-value">{value}</span>
      <span className="pf-metric-label">{label}</span>
      {hint ? <span className="pf-metric-hint">{hint}</span> : null}
    </div>
  );
}

export function WorkspaceFrame({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("pf-workspace-frame", className)} {...props}>
      {children}
    </div>
  );
}

export function Sidebar({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside className={cx("pf-sidebar", className)} {...props}>
      {children}
    </aside>
  );
}

export function MainSurface({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main className={cx("pf-main-surface", className)} {...props}>
      {children}
    </main>
  );
}

export function InspectorPanel({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside className={cx("pf-inspector-panel", className)} {...props}>
      {children}
    </aside>
  );
}

export function SplitLayout({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("pf-split-layout", className)} {...props}>
      {children}
    </div>
  );
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function humanizeStatus(status: string): string {
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
