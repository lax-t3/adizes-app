import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "secondary" | "leap";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "rounded-md bg-primary text-white hover:bg-primary-dark": variant === "default",
            "rounded-md border border-gray-200 bg-white hover:bg-gray-100 hover:text-gray-900": variant === "outline",
            "rounded-md hover:bg-gray-100 hover:text-gray-900": variant === "ghost",
            "rounded-md bg-red-500 text-white hover:bg-red-600": variant === "danger",
            "rounded-md bg-gray-100 text-gray-900 hover:bg-gray-200": variant === "secondary",
            "rounded-xl bg-leap text-white hover:bg-leap-dark shadow-sm hover:shadow-md": variant === "leap",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-md px-3": size === "sm",
            "h-11 rounded-md px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
