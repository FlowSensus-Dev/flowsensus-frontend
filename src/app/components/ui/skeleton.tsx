import { cn } from "./utils";

// ── Base Skeleton ─────────────────────────────────────────────────────────────
// Compose via className — do not add one-off pulse divs elsewhere.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-slate-200 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

// ── Convenience shape aliases ─────────────────────────────────────────────────

/** Single text line (default h-3.5, full width). */
const SkeletonText = ({ className, ...props }: React.ComponentProps<"div">) => (
  <Skeleton className={cn("h-3.5 w-full", className)} {...props} />
);

/** Circular avatar placeholder. */
const SkeletonAvatar = ({
  size = "md",
  className,
  ...props
}: React.ComponentProps<"div"> & { size?: "sm" | "md" | "lg" }) => {
  const s = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-14 w-14" }[size];
  return <Skeleton className={cn("rounded-full flex-shrink-0", s, className)} {...props} />;
};

/** Square / rounded-lg icon block placeholder. */
const SkeletonIcon = ({ className, ...props }: React.ComponentProps<"div">) => (
  <Skeleton className={cn("h-9 w-9 rounded-lg flex-shrink-0", className)} {...props} />
);

/** Badge / pill placeholder. */
const SkeletonBadge = ({ className, ...props }: React.ComponentProps<"div">) => (
  <Skeleton className={cn("h-5 w-20 rounded-full", className)} {...props} />
);

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonIcon, SkeletonBadge };
