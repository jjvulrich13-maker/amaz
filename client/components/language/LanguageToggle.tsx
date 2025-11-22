import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface LanguageToggleProps {
  locked?: boolean;
  className?: string;
}

export function LanguageToggle({ locked, className }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();
  const options: Array<{ key: "en" | "ru"; label: string }> = [
    { key: "en", label: "EN" },
    { key: "ru", label: "RU" },
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-1 py-0.5 text-xs font-semibold text-white shadow-sm",
        locked && "opacity-60",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.key === language;
        return (
          <button
            key={option.key}
            type="button"
            disabled={locked || isActive}
            onClick={() => setLanguage(option.key)}
            className={`rounded-full px-2 py-0.5 transition ${
              isActive ? "bg-white text-[#131921]" : locked ? "text-white/40" : "text-white hover:bg-white/20"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
