import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-background",
        "px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none",
        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
