import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "signal" | "ghost" | "outline" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-ink text-alu hover:bg-ink-2",
  signal: "bg-signal text-ink hover:brightness-95",
  ghost: "text-ink hover:bg-ink/5",
  outline: "border border-ink/25 text-ink hover:border-ink",
  danger: "text-danger hover:bg-danger/10",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "px-3 py-2 text-sm" : size === "lg" ? "px-6 py-3.5 text-base" : "px-4 py-2.5 text-sm";
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${sz} ${className}`}
    />
  );
}
