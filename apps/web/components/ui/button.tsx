import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-lg text-sm font-medium",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&:active]:scale-95 select-none",
  ),
  {
    variants: {
      variant: {
        default: cn(
          "relative isolate overflow-hidden",
          "bg-primary text-primary-foreground",
          "shadow-md",
          "before:absolute before:inset-0 before:-top-1/2",
          "before:translate-y-1/2 before:opacity-50",
          "before:bg-gradient-to-b before:from-white/40 before:to-transparent",
          "before:rounded-full before:blur before:saturate-150",
          "hover:shadow-lg hover:brightness-110",
          "active:scale-95",
        ),
        secondary: cn(
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80",
        ),
        outline: cn(
          "border border-input bg-background text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ),
        ghost: cn(
          "text-muted-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ),
        destructive: cn(
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90",
        ),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-lg": "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
