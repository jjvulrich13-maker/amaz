import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";

function buildResumeLink(slug: string | null) {
  if (!slug) return null;
  const url = new URL(window.location.href);
  url.searchParams.set("slug", slug);
  return url.toString();
}

export default function WaitingApproval() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get("slug");
  const { language } = useLanguage();
  const translate = (en: string, ru: string) => (language === "ru" ? ru : en);
  const [status, setStatus] = useState<"unknown" | "pending" | "approved" | "other">(slug ? "pending" : "unknown");
  const [isLoading, setIsLoading] = useState<boolean>(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const resumeLink = useMemo(() => buildResumeLink(slug), [slug]);

  useEffect(() => {
    if (!slug) {
      setStatus("unknown");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/kyc?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        const raw = typeof data?.status === "string" ? data.status.trim().toLowerCase() : undefined;
        if (raw === "approved") {
          setStatus("approved");
          navigate(`/neobanks?slug=${encodeURIComponent(slug)}`, { replace: true });
        } else if (raw === "declined") {
          setStatus("other");
          navigate(`/?slug=${encodeURIComponent(slug)}&resume=declined`, { replace: true });
        } else if (raw === "pending" || !raw) {
          setStatus("pending");
        } else {
          setStatus("other");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("other");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey, navigate]);

  const copyLink = async () => {
    if (!resumeLink) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(resumeLink);
        return;
      }
      throw new Error("Secure clipboard API unavailable");
    } catch (err) {
      try {
        const el = document.createElement("textarea");
        el.value = resumeLink;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, resumeLink.length);
        const successful = document.execCommand("copy");
        document.body.removeChild(el);
        if (!successful) throw new Error("execCommand copy failed");
      } catch (fallbackError) {
        console.error("Clipboard copy failed", fallbackError);
        alert(resumeLink);
      }
    }
  };

  const refreshStatus = () => setRefreshKey((v) => v + 1);

  const canViewNeobanks = status === "approved" && !!slug;
  const statusMessage = !slug
    ? translate("Open your unique application link to check the current review status.", "Откройте вашу персональную ссылку, чтобы проверить статус заявки.")
    : status === "approved"
    ? translate("Your personal verification has been approved. We are redirecting you to the neobank rollout list.", "Персональная проверка одобрена. Мы перенаправляем вас на страницу с необанками.")
    : status === "pending"
    ? translate("Our compliance team is reviewing your personal verification. We will notify you once it is approved.", "Команда комплаенса проверяет ваши данные. Мы уведомим вас, как только они будут одобрены.")
    : error
    ? translate(`We could not verify the current status: ${error}`, `Не удалось определить статус: ${error}`)
    : translate("We could not determine the application status. Please contact support.", "Не удалось определить статус заявки. Свяжитесь со службой поддержки.");

  return (
    <AppLayout activeNav="status" lockedNav={{ kyc: true, neobanks: true }}>
      <div className="mx-auto max-w-2xl text-center grid gap-6">
        <div className="mx-auto h-24 w-24 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
          <div className={`h-10 w-10 rounded-full border-4 border-primary border-t-transparent ${canViewNeobanks ? "" : "animate-spin"}`} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{translate("Waiting for approval", "Ожидание одобрения")}</h1>
        <p className="text-muted-foreground">{statusMessage}</p>
        {resumeLink ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {translate("Save this link to revisit your application later or share it with the applicant:", "Сохраните ссылку, чтобы вернуться к заявке позже или передайте её заявителю:")}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={resumeLink} className="text-xs" />
              <Button type="button" onClick={copyLink}>{translate("Copy", "Скопировать")}</Button>
            </div>
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" disabled={isLoading || !slug} onClick={refreshStatus}>
            {isLoading ? translate("Checking...", "Проверяем...") : translate("Refresh status", "Обновить статус")}
          </Button>
          <Button type="button" onClick={() => slug && navigate(`/neobanks?slug=${encodeURIComponent(slug)}`)} disabled={!canViewNeobanks}>
            {translate("View neobank list", "Перейти к списку необанков")}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
