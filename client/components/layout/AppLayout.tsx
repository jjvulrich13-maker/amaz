import { ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Link, NavLink } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageToggle } from "@/components/language/LanguageToggle";

type NavKey = "kyc" | "status" | "neobanks";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  showPrimaryNav?: boolean;
  activeNav?: NavKey;
  lockedNav?: Partial<Record<NavKey, boolean>>;
  lockLanguageToggle?: boolean;
}

const navLinks: { key: NavKey; to: string }[] = [
  { key: "kyc", to: "/" },
  { key: "status", to: "/waiting-approval" },
  { key: "neobanks", to: "/neobanks" },
];

function AmazonWordmark() {
  return (
    <div className="flex items-center gap-2 text-white">
      <span className="text-2xl font-black lowercase tracking-tight">amazon</span>
      <svg viewBox="0 0 40 16" className="h-5 w-10 text-[#ff9900]" aria-hidden="true" focusable="false">
        <path
          d="M2 9c5 5 17 7 30-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M26 0l6 4-6 4z" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function AppLayout({
  children,
  className,
  showPrimaryNav = true,
  activeNav = "kyc",
  lockedNav,
  lockLanguageToggle,
}: AppLayoutProps) {
  const { language } = useLanguage();
  const isRussian = language === "ru";
  const headline = isRussian ? "Амазон: центр онбординга" : "Amazon Onboarding Desk";
  const subHeadline = isRussian ? "Надёжный партнёр Amazon с 2021 года" : "Trusted partner for Amazon sellers since 2021";
  const supportLabel = isRussian ? "Служба поддержки 24/7" : "Support 24/7";
  const enterpriseLabel = isRussian ? "Корпоративный рабочий кабинет" : "Enterprise onboarding workspace";
  const sinceLabel = isRussian ? "На рынке с 2021 года" : "In market since 2021";
  const footerLine = isRussian
    ? `Работаем по всему миру с 2021 года • © 2021-${new Date().getFullYear()} Amazon-style KYC Operations`
    : `Operating worldwide since 2021 • © 2021-${new Date().getFullYear()} Amazon-style KYC Operations`;
  const navLabels = useMemo(
    () => ({
      kyc: isRussian ? "Форма KYC" : "KYC Form",
      status: isRussian ? "Статус" : "Status",
      neobanks: isRussian ? "Необанки" : "Neobanks",
    }),
    [isRussian],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#E3E6E6] text-[#0f1111]">
      <header className="shadow-lg shadow-black/20">
        <div className="bg-[#131921] text-white">
          <div className="container mx-auto flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link to="/" className="flex items-center gap-3 text-white">
                <AmazonWordmark />
                <div className="leading-tight">
                  <p className="text-lg font-semibold">{headline}</p>
                  <p className="text-xs text-[#f8d493]">{subHeadline}</p>
                </div>
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-xs text-[#f0c14b] sm:items-end sm:text-right">
              <LanguageToggle locked={lockLanguageToggle} className="text-[11px]" />
              <span className="font-semibold uppercase tracking-wide text-white">{supportLabel}</span>
              <span className="text-white">support@amazonkycdesk.com</span>
              <span className="text-white/90">Telegram: @awskingchina</span>
            </div>
          </div>
        </div>
        <div className="bg-[#232f3e] text-[#f5f6f6]">
          <div className="container mx-auto flex flex-col gap-3 px-4 py-3 text-sm font-semibold sm:flex-row sm:items-center">
            {showPrimaryNav ? (
              <div className="flex w-full flex-wrap gap-2 sm:flex-1 sm:gap-4">
                {navLinks.map((item) => {
                  const disabled = lockedNav?.[item.key];
                  const isActive = activeNav === item.key;
                  if (disabled) {
                    return (
                      <span
                        key={item.key}
                        className={cn(
                          "rounded-md px-3 py-1 text-[#9ca6b3] opacity-70",
                          isActive && "border border-white/30 text-white/80 opacity-100",
                        )}
                        aria-disabled="true"
                      >
                        {navLabels[item.key]}
                      </span>
                    );
                  }
                  return (
                    <NavLink
                      key={item.key}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "rounded-md px-3 py-1 transition hover:bg-white/10",
                          (isActive || activeNav === item.key) ? "bg-white/20 text-[#ff9900]" : "text-[#f5f6f6]",
                        )
                      }
                    >
                      {navLabels[item.key]}
                    </NavLink>
                  );
                })}
              </div>
            ) : (
              <span className="text-[#ffbd69]">{enterpriseLabel}</span>
            )}
            <span className="text-xs text-white/70 sm:ml-auto">{sinceLabel}</span>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex w-full flex-1 px-3 py-6 sm:px-4 sm:py-10">
        <div className={cn("w-full rounded-md border border-white/70 bg-white/95 p-6 shadow-[0_12px_30px_rgba(15,17,17,0.2)]", className)}>
          {children}
        </div>
      </main>
      <footer className="bg-[#131921] py-10 text-center text-sm text-white/80">
        <div className="container mx-auto px-4">
          <p className="font-semibold text-white">Amazon Onboarding Desk</p>
          <p className="mt-1 text-xs text-[#f5dca8]">{footerLine}</p>
        </div>
      </footer>
    </div>
  );
}
