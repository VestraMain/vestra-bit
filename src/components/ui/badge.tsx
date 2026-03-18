import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-navy/10 text-navy",
        draft: "bg-gray-100 text-gray-600",
        extracting: "bg-blue-100 text-blue-700",
        review: "bg-yellow-100 text-yellow-700",
        generating: "bg-purple-100 text-purple-700",
        complete: "bg-green/10 text-green",
        archived: "bg-gray-100 text-gray-500",
        urgent: "bg-red-100 text-red-700",
        success: "bg-green/10 text-green",
        warning: "bg-yellow-100 text-yellow-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
