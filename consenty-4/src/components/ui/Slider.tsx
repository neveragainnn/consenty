"use client";

import { useId } from "react";

/** Ползунок: onChange — живое изменение, onCommit — запись в историю (отпустили палец/мышь/клавишу). */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  onCommit,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange(v: number): void;
  onCommit(): void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={disabled ? "opacity-40" : ""}>
      <div className="flex items-baseline justify-between text-sm">
        <label htmlFor={id} className="text-ink-2">
          {label}
        </label>
        <span className="tabular-nums text-steel">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}
