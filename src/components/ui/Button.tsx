"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ios-blue text-white hover:bg-ios-blueHover active:opacity-90 disabled:opacity-50",
  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:active:bg-slate-700/80 disabled:opacity-50",
  ghost:
    "bg-transparent text-ios-blue hover:bg-ios-blue/10 active:bg-ios-blue/15 disabled:opacity-50",
  destructive:
    "bg-ios-red/10 text-ios-red hover:bg-ios-red/15 active:bg-ios-red/20 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-3 text-[12px] rounded-md font-medium",
  md: "h-9 px-4 text-[13px] rounded-lg font-medium",
  lg: "h-11 px-5 text-[14px] rounded-xl font-semibold",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue/40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
});

export default Button;
