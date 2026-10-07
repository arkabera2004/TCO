import { icons, type IconName } from "@/components/icons/registry";
import { cn } from "@/lib/utils";

/**
 * Reusable AppIcon primitive.
 *
 * Sizing is governed by the --icon-size-* token scale defined in styles.css:
 *   xs: 12px, sm: 14px, md: 16px, lg: 18px, xl: 20px, 2xl: 24px, 3xl: 28px
 *
 * Color tokens support semantic tones:
 *   primary, secondary, tertiary, quaternary, on-color,
 *   success, info, warning, error
 */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

export type IconTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary"
  | "on-color"
  | "success"
  | "info"
  | "warning"
  | "error";

const SIZE_VAR: Record<IconSize, string> = {
  xs: "var(--icon-size-xs)", // 12px — breadcrumbs, inline status
  sm: "var(--icon-size-sm)", // 14px — table actions, small buttons
  md: "var(--icon-size-md)", // 16px — standard button icon, search
  lg: "var(--icon-size-lg)", // 18px — sidebar navigation
  xl: "var(--icon-size-xl)", // 20px — section headers
  "2xl": "var(--icon-size-2xl)", // 24px — empty states
  "3xl": "var(--icon-size-3xl)", // 28px — feature icons
};

const TONE_CLASS: Record<IconTone, string> = {
  primary: "text-icon-primary",
  secondary: "text-icon-secondary",
  tertiary: "text-icon-tertiary",
  quaternary: "text-icon-quaternary",
  "on-color": "text-icon-on-color",
  success: "text-feedback-success-icon",
  info: "text-feedback-info-icon",
  warning: "text-feedback-warning-icon",
  error: "text-feedback-error-icon",
};

export interface AppIconProps {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
  className?: string;
  /** Accessible label for screen readers. If provided, role='img' is set. */
  "aria-label"?: string;
  /** Whether the icon is decorative. Defaults to true when aria-label is omitted. */
  "aria-hidden"?: boolean | "true" | "false";
  title?: string;
}

export function AppIcon({
  name,
  size = "md",
  tone,
  className,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  title,
}: AppIconProps) {
  // Decorative unless the caller provides an accessible label
  const hidden = (ariaHidden ?? !ariaLabel) !== false && ariaHidden !== "false";
  const dimension = SIZE_VAR[size] ?? SIZE_VAR.md;
  const Glyph = icons[name];

  if (!Glyph) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[AppIcon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  return (
    <Glyph
      className={cn(
        "shrink-0 inline-flex items-center justify-center align-middle",
        tone && TONE_CLASS[tone],
        className,
      )}
      style={{ width: dimension, height: dimension }}
      aria-hidden={hidden || undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
    </Glyph>
  );
}
