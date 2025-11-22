import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, Phone, Mail, LockKeyhole } from "lucide-react";
import { buildEmptyNeobankMap, mergeNeobankMap, NEO_BANKS } from "@/data/neobanks";
import type { KycStatusResponse, NeobankAccessMap, NeobankAccessRecord } from "@shared/api";
import { useLanguage } from "@/context/LanguageContext";

type PageStatus = "loading" | "missing" | "pending" | "approved" | "error";

function resolvePrimaryStore(bank: { androidUrl?: string; iosUrl?: string; website: string }) {
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|mac/.test(ua) && bank.iosUrl) return bank.iosUrl;
    if (/android/.test(ua) && bank.androidUrl) return bank.androidUrl;
  }
  return bank.androidUrl || bank.iosUrl || bank.website;
}

function Credentials({ record }: { record: NeobankAccessRecord }) {
  const { language } = useLanguage();
  const translate = (en: string, ru: string) => (language === "ru" ? ru : en);
  const empty = !record.phone && !record.email && !record.password;
  if (empty) {
    return (
      <p className="text-sm text-muted-foreground">
        {translate("Credentials will appear here once our onboarding desk provisions the account.", "Данные для входа появятся здесь, когда команда оформит аккаунт.")}
      </p>
    );
  }
  return (
    <dl className="grid gap-2 text-sm">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{translate("Phone", "Телефон")}:</span>
        <span className="font-mono text-foreground">{record.phone}</span>
      </div>
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Email:</span>
        <span className="font-mono text-foreground">{record.email}</span>
      </div>
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{translate("Password", "Пароль")}:</span>
        <span className="font-mono text-foreground">{record.password}</span>
      </div>
    </dl>
  );
}

export default function Neobanks() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get("slug");
  const { language } = useLanguage();
  const translate = (en: string, ru: string) => (language === "ru" ? ru : en);
  const [pageStatus, setPageStatus] = useState<PageStatus>(slug ? "loading" : "missing");
  const [isLoading, setIsLoading] = useState<boolean>(!!slug);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<NeobankAccessMap>(() => buildEmptyNeobankMap());

  useEffect(() => {
    if (!slug) {
      setPageStatus("missing");
      setRecords(buildEmptyNeobankMap());
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const response = await fetch(`/api/kyc?slug=${encodeURIComponent(slug)}`);
        if (!response.ok) {
          throw new Error(`Unable to load application (${response.status})`);
        }
        const data: KycStatusResponse = await response.json();
        if (cancelled) return;
        const status = typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
        setPageStatus(status === "approved" ? "approved" : "pending");
        setRecords(mergeNeobankMap(data.neobanks));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setPageStatus("error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const helperText = useMemo(() => {
    if (pageStatus === "approved") {
      return translate(
        "Your KYC is approved. Our support will contact you shortly and update each neobank slot once approved.",
        "Ваш KYC одобрен. Служба поддержки свяжется с вами и обновит статус каждого необанка."
      );
    }
    if (pageStatus === "pending") {
      return translate(
        "We are still reviewing your personal KYC. The neobank checklist will unlock once compliance approves the application.",
        "Персональная проверка ещё продолжается. Список необанков станет доступен после одобрения комплаенсом."
      );
    }
    if (pageStatus === "missing") {
      return translate(
        "Add your unique application slug to the URL (e.g. /neobanks?slug=abc123) to view your personalized checklists.",
        "Добавьте свой уникальный slug в адресную строку (например, /neobanks?slug=abc123), чтобы увидеть персональный список задач."
      );
    }
    return translate("We could not fetch the application right now. Please try again or contact onboarding support.", "Не удалось загрузить заявку. Попробуйте позже или обратитесь в поддержку.");
  }, [pageStatus, language]);

  const statusLabel = useMemo(() => {
    if (pageStatus === "approved") return translate("KYC approved", "KYC одобрен");
    if (pageStatus === "pending") return translate("KYC pending", "KYC в обработке");
    if (pageStatus === "missing") return translate("Slug required", "Укажите код заявки");
    if (pageStatus === "error") return translate("Load error", "Ошибка загрузки");
    return translate("Loading", "Загрузка");
  }, [pageStatus, language]);

  return (
    <AppLayout activeNav="neobanks" lockedNav={{ kyc: true, status: true }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-amber-700">
                {translate("Multi-bank onboarding hub", "Центр подключения к нескольким необанкам")}
              </p>
              <h1 className="text-3xl font-semibold text-[#131921]">{translate("Neobank rollout status", "Статус подключения к необанкам")}</h1>
            </div>
            {slug ? (
              <div className="text-sm text-muted-foreground">
                {translate("Reference slug", "Идентификатор заявки")}:
                <span className="ml-2 font-mono text-base text-foreground">{slug}</span>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-700">{helperText}</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {translate("Our support specialists will contact you as each account is approved.", "Специалисты поддержки будут связываться с вами по мере одобрения каждого аккаунта.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-700">
            <Badge variant={pageStatus === "approved" ? "default" : "secondary"}>{statusLabel}</Badge>
            {pageStatus === "pending" && slug ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/waiting-approval?slug=${encodeURIComponent(slug)}`)}>
                {translate("Back to status page", "Вернуться к статусу")}
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{translate("Unable to fetch latest status", "Не удалось получить обновлённый статус")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border bg-white py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{translate("Loading neobank dashboard…", "Загрузка панели необанков…")}</span>
            </div>
          ) : (
            NEO_BANKS.map((bank) => {
              const record = records[bank.key];
              const preferred = resolvePrimaryStore(bank);
              return (
                <Card key={bank.key} className="border border-slate-200 shadow-md hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3 text-2xl" style={{ color: bank.accent }}>
                          {bank.name}
                        </CardTitle>
                        <CardDescription>{language === "ru" ? bank.descriptionRu : bank.description}</CardDescription>
                      </div>
                      <Badge variant={record?.approved ? "default" : "secondary"} className="w-fit">
                        {record?.approved ? translate("Approved", "Одобрено") : translate("Awaiting approval", "Ожидает одобрения")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!record?.approved} disabled className="h-5 w-5 rounded" />
                      <span className="text-sm text-muted-foreground">
                        {record?.approved
                          ? translate("Marked approved in Google Sheet", "Отмечено как одобренное в Google Sheet")
                          : translate("Waiting for analyst to mark approved", "Ожидает подтверждения аналитика")}
                      </span>
                    </div>
                    <Credentials record={record} />
                    <Separator />
                    <div className="flex flex-wrap gap-3">
                      {bank.androidUrl ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={bank.androidUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Google Play
                          </a>
                        </Button>
                      ) : null}
                      {bank.iosUrl ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={bank.iosUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                            <ExternalLink className="h-4 w-4" />
                            App Store
                          </a>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <a href={preferred} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          {bank.androidUrl || bank.iosUrl
                            ? translate("Open preferred store", "Открыть магазин приложения")
                            : translate("Open website", "Открыть сайт")}
                        </a>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href={bank.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[#0f1111]">
                          <ExternalLink className="h-4 w-4" />
                          {translate("Visit site", "Перейти на сайт")}
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
