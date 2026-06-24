import { cn } from "@/lib/utils";

export function LabourBookingColorTags({
  companyTags,
  workerTags,
  className,
  size = "sm",
}: {
  companyTags: string[];
  workerTags: string[];
  className?: string;
  size?: "sm" | "xs";
}) {
  if (companyTags.length === 0 && workerTags.length === 0) return null;

  const tagClass = size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2";

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)} aria-hidden>
      {companyTags.map((hex, index) => (
        <span
          key={`company-${hex}-${index}`}
          className={cn(tagClass, "rounded-[2px] border border-white/70 shadow-sm")}
          style={{ backgroundColor: hex }}
        />
      ))}
      {workerTags.map((hex, index) => (
        <span
          key={`worker-${hex}-${index}`}
          className={cn(tagClass, "rounded-full border border-white/70 shadow-sm")}
          style={{ backgroundColor: hex }}
        />
      ))}
    </span>
  );
}

/** @deprecated Use LabourBookingColorTags */
export function LabourColorDots({
  colors,
  className,
  size = "sm",
}: {
  colors: string[];
  className?: string;
  size?: "sm" | "xs";
}) {
  return (
    <LabourBookingColorTags
      companyTags={[]}
      workerTags={colors}
      className={className}
      size={size}
    />
  );
}
