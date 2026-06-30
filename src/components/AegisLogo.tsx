import { cn } from "@/lib/utils";

type AegisLogoProps = {
  className?: string;
  markClassName?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "size-12 rounded-2xl p-1.5",
  md: "size-16 rounded-3xl p-2",
  lg: "size-24 rounded-4xl p-3",
};

export function AegisLogo({ className, markClassName, size = "md" }: AegisLogoProps) {
  return (
    <div className={cn("aegis-logo-shell", sizes[size], className)}>
      <img
        alt="Aegis"
        className={cn("relative z-10 size-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]", markClassName)}
        draggable={false}
        src="/aegis-mark.png"
      />
    </div>
  );
}
