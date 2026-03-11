import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "P" | "A" | "E" | "I";
  children?: React.ReactNode;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-white hover:bg-primary/80": variant === "default",
          "border-transparent bg-gray-100 text-gray-900 hover:bg-gray-100/80": variant === "secondary",
          "text-gray-950": variant === "outline",
          "border-transparent bg-[#C8102E] text-white": variant === "P",
          "border-transparent bg-[#1D3557] text-white": variant === "A",
          "border-transparent bg-[#E87722] text-white": variant === "E",
          "border-transparent bg-[#2A9D8F] text-white": variant === "I",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
