import { useMemo, useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { Language } from "@/context/LanguageContext";

const LATIN_TEXT_REGEX = /^[A-Za-z0-9\s.,'’"()\-/#+:&]*$/;
const LATIN_REQUIRED_REGEX = /^[A-Za-z0-9\s.,'’"()\-/#+:&]+$/;
const LATIN_ONLY_MESSAGE = "Use Latin letters (A-Z) only / Вводите данные латиницей (A-Z)";
const PHONE_REGEX = /^[0-9+().\-\s]+$/;
const PHONE_MESSAGE = "Use digits and + only / Допустимы только цифры и знак +";
const POSTAL_REGEX = /^[A-Za-z0-9\s\-]+$/;
const TELEGRAM_REGEX = /^[A-Za-z0-9_@./:-]+$/;
const TELEGRAM_MESSAGE = "Use Latin letters or digits in Telegram handle / Указывайте латинские буквы и цифры";
const sanitizeLatin = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s.,'’"()\-\/#:+]/g, "")
    .trim();

const enforceOptionalLatin = (value: string) => value === "" || LATIN_TEXT_REGEX.test(value);

type LocalizedOption = { value: string; label: Record<Language, string> };

const COUNTRY_OPTIONS: LocalizedOption[] = [
  { value: "Estonia", label: { en: "Estonia", ru: "Эстония" } },
  { value: "Latvia", label: { en: "Latvia", ru: "Латвия" } },
  { value: "Lithuania", label: { en: "Lithuania", ru: "Литва" } },
  { value: "Finland", label: { en: "Finland", ru: "Финляндия" } },
  { value: "Germany", label: { en: "Germany", ru: "Германия" } },
  { value: "United Kingdom", label: { en: "United Kingdom", ru: "Великобритания" } },
];

const RESIDENCY_OPTIONS: LocalizedOption[] = [
  { value: "Citizen", label: { en: "Citizen", ru: "Гражданин" } },
  { value: "Permanent resident", label: { en: "Permanent resident", ru: "Постоянный резидент" } },
  { value: "Temporary resident", label: { en: "Temporary resident", ru: "Временный резидент" } },
  { value: "Non-resident", label: { en: "Non-resident", ru: "Нерезидент" } },
];

const EMPLOYMENT_OPTIONS: LocalizedOption[] = [
  { value: "Employed", label: { en: "Employed", ru: "Наёмный сотрудник" } },
  { value: "Self-employed", label: { en: "Self-employed", ru: "Самозанятый" } },
  { value: "Founder", label: { en: "Founder / Entrepreneur", ru: "Основатель / предприниматель" } },
  { value: "Student", label: { en: "Student", ru: "Студент" } },
  { value: "Retired", label: { en: "Retired", ru: "Пенсионер" } },
  { value: "Unemployed", label: { en: "Not currently employed", ru: "Временно не работаю" } },
];

const ANNUAL_INCOME_OPTIONS: LocalizedOption[] = [
  { value: "<25k", label: { en: "Under €25k", ru: "Менее 25 000 €" } },
  { value: "25-50k", label: { en: "€25k – €50k", ru: "25 000 – 50 000 €" } },
  { value: "50-100k", label: { en: "€50k – €100k", ru: "50 000 – 100 000 €" } },
  { value: "100-250k", label: { en: "€100k – €250k", ru: "100 000 – 250 000 €" } },
  { value: ">250k", label: { en: "Above €250k", ru: "Более 250 000 €" } },
];

const SOURCE_OF_FUNDS_OPTIONS: LocalizedOption[] = [
  { value: "salary", label: { en: "Salary / Employment", ru: "Зарплата / трудовой доход" } },
  { value: "business", label: { en: "Business profits", ru: "Прибыль бизнеса" } },
  { value: "investments", label: { en: "Investment returns", ru: "Инвестиционный доход" } },
  { value: "crypto", label: { en: "Digital assets", ru: "Криптовалюта" } },
  { value: "savings", label: { en: "Long-term savings", ru: "Личные сбережения" } },
  { value: "other", label: { en: "Other", ru: "Другое" } },
];

const BANK_OPTIONS: LocalizedOption[] = [
  { value: "swedbank", label: { en: "Swedbank", ru: "Swedbank" } },
  { value: "seb", label: { en: "SEB", ru: "SEB" } },
  { value: "lhv", label: { en: "LHV", ru: "LHV" } },
  { value: "revolut", label: { en: "Revolut", ru: "Revolut" } },
  { value: "wise", label: { en: "Wise", ru: "Wise" } },
];

type BankGuide = {
  steps: Record<Language, string[]>;
  supportUrl?: string;
  note?: Record<Language, string>;
};

const BANK_GUIDES: Record<string, BankGuide> = {
  swedbank: {
    steps: {
      en: [
        "Sign in to Swedbank Internet Bank and open the account you receive salary to.",
        "Choose “Statements and reports”, then select “Account statement”.",
        "Set the custom period to cover the last 6 full months and choose English as the language.",
        "Download the PDF version and double-check that every page is readable.",
      ],
      ru: [
        "Войдите в интернет-банк Swedbank и откройте счёт, на который поступает зарплата.",
        "Выберите «Statements and reports», затем «Account statement».",
        "Установите произвольный период за последние 6 месяцев и выберите английский язык документа.",
        "Скачайте PDF и убедитесь, что каждая страница читаема.",
      ],
    },
    supportUrl: "https://www.swedbank.ee/private/d2d/baltic",
    note: {
      en: "Statements generated in Estonian need to be re-issued in English before upload.",
      ru: "Выписки, созданные на эстонском языке, нужно повторно скачать на английском перед загрузкой.",
    },
  },
  seb: {
    steps: {
      en: [
        "Log into SEB Internet Bank and go to “Accounts and cards”.",
        "Select the relevant current account and click “Account statement”.",
        "Use the “Period” dropdown to choose a custom range covering the last 6 months.",
        "Pick English as the statement language and export it as PDF.",
      ],
      ru: [
        "Войдите в интернет-банк SEB и откройте раздел «Accounts and cards».",
        "Выберите нужный счёт и нажмите «Account statement».",
        "Через «Period» задайте период за последние 6 месяцев.",
        "Выберите английский язык и экспортируйте выписку в PDF.",
      ],
    },
    supportUrl: "https://www.seb.ee/eng/customer-support/use-internet-bank",
  },
  lhv: {
    steps: {
      en: [
        "Log into LHV Internet Bank and open the account overview.",
        "Click “Statements” from the right-hand menu.",
        "Choose a custom period that covers the previous 6 months.",
        "Set the language to English and export the statement as PDF.",
      ],
      ru: [
        "Войдите в интернет-банк LHV и откройте обзор счетов.",
        "В правом меню выберите «Statements».",
        "Установите произвольный период за последние 6 месяцев.",
        "Выберите английский язык и сохраните выписку в PDF.",
      ],
    },
    supportUrl: "https://www.lhv.ee/en/support",
  },
  revolut: {
    steps: {
      en: [
        "Open the Revolut mobile app and tap the “Accounts” tab.",
        "Choose your primary account, then select “Statements”.",
        "Generate a statement covering the last 6 months and choose English.",
        "Export the PDF and email it to yourself or save it to files before uploading.",
      ],
      ru: [
        "Откройте мобильное приложение Revolut и перейдите во вкладку «Accounts».",
        "Выберите основной счёт и нажмите «Statements».",
        "Сформируйте выписку за последние 6 месяцев и выберите английский язык.",
        "Экспортируйте PDF и сохраните его или отправьте себе на почту.",
      ],
    },
    supportUrl: "https://help.revolut.com/help/transactions/transaction-history/statements-account-confirmation-letters",
    note: {
      en: "If you have multiple currency accounts, include the one you use for everyday spending.",
      ru: "Если у вас несколько валютных счетов, приложите выписку по тому, которым пользуетесь чаще всего.",
    },
  },
  wise: {
    steps: {
      en: [
        "Sign into Wise on the web and open the account balance you use most frequently.",
        "Click “Statements”, then “Custom” to pick a 6 month date range ending today.",
        "Set the statement language to English and include all transactions.",
        "Download the PDF and verify that the account holder name is visible on page 1.",
      ],
      ru: [
        "Войдите в Wise через браузер и откройте баланс, которым пользуетесь чаще всего.",
        "Нажмите «Statements», затем «Custom» и выберите период за последние 6 месяцев.",
        "Выберите английский язык и убедитесь, что выгружены все транзакции.",
        "Скачайте PDF и проверьте, что имя владельца счёта видно на первой странице.",
      ],
    },
    supportUrl: "https://wise.com/help/articles/2932303/getting-a-statement",
  },
};

type AddressOption = {
  label: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function sanitizeAddressOption(option: AddressOption): AddressOption {
  return {
    label: sanitizeLatin(option.label),
    address1: sanitizeLatin(option.address1),
    city: sanitizeLatin(option.city),
    state: sanitizeLatin(option.state),
    postalCode: sanitizeLatin(option.postalCode),
    country: sanitizeLatin(option.country),
  };
}

const RAW_FALLBACK_ADDRESSES: AddressOption[] = [
  {
    label: "Viru väljak 2, Tallinn, 10111",
    address1: "Viru väljak 2",
    city: "Tallinn",
    state: "Harju maakond",
    postalCode: "10111",
    country: "Estonia",
  },
  {
    label: "Riia 2, Tartu, 51004",
    address1: "Riia 2",
    city: "Tartu",
    state: "Tartu maakond",
    postalCode: "51004",
    country: "Estonia",
  },
  {
    label: "Peetri plats 5, Narva, 20308",
    address1: "Peetri plats 5",
    city: "Narva",
    state: "Ida-Viru maakond",
    postalCode: "20308",
    country: "Estonia",
  },
  {
    label: "Mannerheimintie 20, Helsinki, 00100",
    address1: "Mannerheimintie 20",
    city: "Helsinki",
    state: "Uusimaa",
    postalCode: "00100",
    country: "Finland",
  },
  {
    label: "Pärnu maantee 12, Tallinn, 10148",
    address1: "Pärnu maantee 12",
    city: "Tallinn",
    state: "Harju maakond",
    postalCode: "10148",
    country: "Estonia",
  },
  {
    label: "Narva maantee 7, Tallinn, 10117",
    address1: "Narva maantee 7",
    city: "Tallinn",
    state: "Harju maakond",
    postalCode: "10117",
    country: "Estonia",
  },
  {
    label: "Laisvės alėja 80, Kaunas, 44250",
    address1: "Laisvės alėja 80",
    city: "Kaunas",
    state: "Kauno apskritis",
    postalCode: "44250",
    country: "Lithuania",
  },
  {
    label: "Brīvības iela 13, Rīga, LV-1010",
    address1: "Brīvības iela 13",
    city: "Rīga",
    state: "Rīgas pilsēta",
    postalCode: "LV-1010",
    country: "Latvia",
  },
  {
    label: "Aleksanterinkatu 52, Helsinki, 00100",
    address1: "Aleksanterinkatu 52",
    city: "Helsinki",
    state: "Uusimaa",
    postalCode: "00100",
    country: "Finland",
  },
  {
    label: "Friedrichstraße 76, Berlin, 10117",
    address1: "Friedrichstraße 76",
    city: "Berlin",
    state: "Berlin",
    postalCode: "10117",
    country: "Germany",
  },
  {
    label: "221B Baker Street, London, NW1 6XE",
    address1: "221B Baker Street",
    city: "London",
    state: "Greater London",
    postalCode: "NW1 6XE",
    country: "United Kingdom",
  },
];

const FALLBACK_ADDRESSES: AddressOption[] = RAW_FALLBACK_ADDRESSES.map(sanitizeAddressOption);

const latinRequiredString = () => z.string().min(1, "Required").regex(LATIN_REQUIRED_REGEX, LATIN_ONLY_MESSAGE);
const latinOptionalString = () =>
  z
    .string()
    .optional()
    .refine((val) => !val || LATIN_TEXT_REGEX.test(val), { message: LATIN_ONLY_MESSAGE })
    .default("");

const kycSchema = z
  .object({
    // Step 1
    firstName: latinRequiredString(),
    lastName: latinRequiredString(),
    email: z.string().email("Invalid email"),
    phone: z.string().min(7, "Invalid phone").regex(PHONE_REGEX, PHONE_MESSAGE),
    dob: z.string().min(1, "Required"),
    nationality: z.string().min(1, "Required"),
    gender: z.string().min(1, "Required"),
    // Step 2
    address1: latinRequiredString(),
    address2: latinOptionalString(),
    city: latinRequiredString(),
    state: latinRequiredString(),
    postalCode: z.string().min(2, "Required").regex(POSTAL_REGEX, LATIN_ONLY_MESSAGE),
    country: z.string().min(1, "Required"),
    residencyStatus: z.string().min(1, "Required"),
    employmentStatus: z.string().min(1, "Required"),
    annualIncome: z.string().min(1, "Required"),
    sourceOfFunds: z.string().min(1, "Required"),
    sourceOfFundsOther: z
      .string()
      .optional()
      .refine((val) => !val || LATIN_TEXT_REGEX.test(val), { message: LATIN_ONLY_MESSAGE })
      .default(""),
    bankName: z.string().min(1, "Required"),
    bankStatement: z.any().optional(),
    // Step 3
    documentType: z.string().min(1, "Required"),
    ssnOrId: z.string().min(4, "Required").regex(LATIN_REQUIRED_REGEX, LATIN_ONLY_MESSAGE),
    docFront: z.any().optional(),
    docBack: z.any().optional(),
    // Step 4
    selfieUsual: z.any().optional(),
    selfieWithDoc: z.any().optional(),
    // Step 5
    consent: z.boolean(),
    signature: z.string().min(2, "Type your full name").regex(LATIN_REQUIRED_REGEX, LATIN_ONLY_MESSAGE),
    telegram: z
      .string()
      .min(3, "Enter your Telegram username or contact link")
      .regex(TELEGRAM_REGEX, TELEGRAM_MESSAGE),
  })
  .superRefine((values, ctx) => {
    if (values.sourceOfFunds === "other" && !values.sourceOfFundsOther?.trim()) {
      ctx.addIssue({
        path: ["sourceOfFundsOther"],
        code: z.ZodIssueCode.custom,
        message: "Please describe the source of funds",
      });
    }
  });

export type KycFormValues = z.infer<typeof kycSchema>;

const steps = [
  { key: "personal", title: { en: "Personal Details", ru: "Личные данные" } },
  { key: "address", title: { en: "Address & Profile", ru: "Адрес и профиль" } },
  { key: "documents", title: { en: "Identity Documents", ru: "Документы удостоверения личности" } },
  { key: "selfies", title: { en: "Selfie Verification", ru: "Проверка селфи" } },
  { key: "review", title: { en: "Review & Submit", ru: "Проверка и отправка" } },
] as const;

const STRING_FORM_FIELDS: (keyof KycFormValues)[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "dob",
  "nationality",
  "gender",
  "ssnOrId",
  "address1",
  "address2",
  "city",
  "state",
  "postalCode",
  "country",
  "residencyStatus",
  "employmentStatus",
  "annualIncome",
  "sourceOfFunds",
  "sourceOfFundsOther",
  "bankName",
  "documentType",
  "signature",
  "telegram",
];

async function fileToBase64(file: File) {
  return await new Promise<{ base64: string; mimeType: string; name: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // data:*/*;base64,xxxxx
      const parts = result.split(",");
      const meta = parts[0];
      const base64 = parts[1];
      const mimeMatch = meta.match(/data:(.*);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : file.type || "application/octet-stream";
      resolve({ base64, mimeType, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Index() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slugParam = searchParams.get("slug") ?? undefined;
  const { language } = useLanguage();
  const isRussian = language === "ru";
  const translate = (en: string, ru: string) => (isRussian ? ru : en);
  const localizedSteps = useMemo(
    () => steps.map((step) => ({ ...step, title: isRussian ? step.title.ru : step.title.en })),
    [isRussian],
  );
  const [current, setCurrent] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<AddressOption[]>(FALLBACK_ADDRESSES);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const form = useForm<KycFormValues>({
    resolver: zodResolver(kycSchema),
    mode: "onBlur",
    defaultValues: {
      // Step 1
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dob: "",
      nationality: "",
      gender: "",
      ssnOrId: "",
      // Step 2
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      residencyStatus: "",
      employmentStatus: "",
      annualIncome: "",
      sourceOfFunds: "",
      sourceOfFundsOther: "",
      bankName: "",
      bankStatement: null,
      // Step 3
      documentType: "",
      docFront: null,
      docBack: null,
      // Step 4
      selfieUsual: null,
      selfieWithDoc: null,
      // Step 5
      consent: false,
      signature: "",
      telegram: "",
    },
  });

  const sourceOfFundsValue = form.watch("sourceOfFunds");
  const documentTypeValue = form.watch("documentType");
  const bankNameValue = form.watch("bankName");
  const selectedBankGuide = bankNameValue ? BANK_GUIDES[bankNameValue] : undefined;
  const requiresDocBack = documentTypeValue === "national-id";
  const isDeclined = kycStatus === "declined";
  const supportBotUrl = "https://t.me/Amaz0n_Supp0rt_Bot";
  const progress = useMemo(() => Math.round((current / (localizedSteps.length - 1)) * 100), [current, localizedSteps.length]);

  useEffect(() => {
    if (sourceOfFundsValue !== "other") {
      form.setValue("sourceOfFundsOther", "", { shouldDirty: false });
    }
  }, [sourceOfFundsValue, form]);

  useEffect(() => {
    if (!requiresDocBack) {
      form.setValue("docBack", null, { shouldDirty: false });
      form.clearErrors("docBack");
    }
  }, [requiresDocBack, form]);

  useEffect(() => {
    const query = addressQuery.trim();
    if (!query) {
      setAddressResults(FALLBACK_ADDRESSES);
      setIsAddressLoading(false);
      setAddressError(null);
      return;
    }

    if (query.length < 3) {
      const fallbackMatches = FALLBACK_ADDRESSES.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase()),
      );
      setAddressResults(fallbackMatches.length > 0 ? fallbackMatches : FALLBACK_ADDRESSES);
      setIsAddressLoading(false);
      setAddressError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setIsAddressLoading(true);
    setAddressError(null);
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/address/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Lookup failed (${response.status})`);
        }
        const json = await response.json();
        if (cancelled) return;
        const apiResults: AddressOption[] = Array.isArray(json?.results)
          ? json.results
              .map((item: any) => sanitizeAddressOption({
                label: String(item?.label || item?.address1 || query),
                address1: String(item?.address1 || ""),
                city: String(item?.city || ""),
                state: String(item?.state || ""),
                postalCode: String(item?.postalCode || ""),
                country: String(item?.country || ""),
              }))
              .filter(
                (item) =>
                  item.address1 &&
                  enforceOptionalLatin(item.address1) &&
                  enforceOptionalLatin(item.city) &&
                  enforceOptionalLatin(item.state),
              )
          : [];

        setAddressResults(apiResults.length > 0 ? apiResults : FALLBACK_ADDRESSES);
        setIsAddressLoading(false);
      } catch (error) {
        if (cancelled) return;
        if ((error as Error).name === "AbortError") {
          return;
        }
        setAddressError("Unable to fetch address suggestions right now.");
        setAddressResults(FALLBACK_ADDRESSES);
        setIsAddressLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [addressQuery]);

  // On mount: if slug present, fetch saved data from GAS and populate
  useEffect(() => {
    const endpoint = "/api/kyc";
    if (!slugParam || !endpoint) {
      setKycStatus(null);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${endpoint}?slug=${encodeURIComponent(slugParam)}`);
        if (!res.ok) return;
        const data = await res.json();
        const statusRaw = typeof data?.status === "string" ? data.status : undefined;
        const status = statusRaw ? statusRaw.trim().toLowerCase() : undefined;
        setKycStatus(status ?? null);

        if (status === "approved") {
          navigate(`/neobanks?slug=${encodeURIComponent(slugParam)}`, { replace: true });
          return;
        }

        if (status && status !== "declined") {
          navigate(`/waiting-approval?slug=${encodeURIComponent(slugParam)}`, { replace: true });
          return;
        }

        if (data && data.data && data.data.personal) {
          const personalRaw = data.data.personal as Partial<KycFormValues>;
          const currentValues = form.getValues();
          const sanitized: Partial<KycFormValues> = {};
          STRING_FORM_FIELDS.forEach((key) => {
            const value = (personalRaw as any)[key];
            if (value === undefined || value === null || value === "") {
              (sanitized as any)[key] = "";
            } else {
              (sanitized as any)[key] = typeof value === "string" ? value : String(value);
            }
          });

          const nextValues: KycFormValues = {
            ...currentValues,
            ...sanitized,
            consent: Boolean(personalRaw.consent),
            bankStatement: null,
            docFront: null,
            docBack: null,
            selfieUsual: null,
            selfieWithDoc: null,
          };

          const personal = personalRaw ?? {};
          form.reset(nextValues);
          setAddressQuery(typeof sanitized.address1 === "string" ? sanitized.address1 : "");
          if (status === "declined") {
            setCurrent(2);
          } else if (personal.signature && personal.consent) {
            setCurrent(4);
          } else if (personal.documentType) {
            setCurrent(3);
          } else if (personal.address1) {
            setCurrent(1);
          } else {
            setCurrent(0);
          }
        }
      } catch (e) {
        console.error("Error fetching KYC by slug", e);
      }
    })();
  }, [slugParam, form, navigate]);

  const next = async () => {
    const sectionFields: (keyof KycFormValues)[] =
      current === 0
        ? ["firstName", "lastName", "email", "phone", "dob", "nationality", "gender"]
        : current === 1
        ? ["address1", "city", "state", "postalCode", "country", "residencyStatus", "employmentStatus", "annualIncome", "sourceOfFunds", "sourceOfFundsOther", "bankName"]
        : current === 2
        ? ["documentType", "ssnOrId"]
        : current === 3
        ? []
        : ["telegram", "consent", "signature"];

    const valid = await form.trigger(sectionFields as any, { shouldFocus: true });
    if (!valid) return;

    if (current === 1) {
      const values = form.getValues();
      if (!values.bankStatement) {
        form.setError("bankStatement", { type: "manual", message: "Upload a bank statement covering the last 6 months" });
        return;
      }
    }

    // Additional file checks
    if (current === 2) {
      const values = form.getValues();
      if (!values.docFront) {
        form.setError("docFront", { type: "manual", message: "Document front is required" });
        return;
      }
      const requiresDocBack = values.documentType === "national-id";
      if (!requiresDocBack) {
        form.clearErrors("docBack");
      } else if (!values.docBack) {
        form.setError("docBack", { type: "manual", message: "Document back is required for ID cards" });
        return;
      }
    }

    if (current === 3) {
      const values = form.getValues();
      const missing: string[] = [];
      if (!values.selfieUsual) missing.push("selfieUsual");
      if (!values.selfieWithDoc) missing.push("selfieWithDoc");
      if (missing.length > 0) {
        missing.forEach((k) => form.setError(k as any, { type: "manual", message: "This photo is required" }));
        return;
      }
    }

    if (current < localizedSteps.length - 1) setCurrent((c) => c + 1);
  };

  const prev = () => setCurrent((c) => Math.max(0, c - 1));

  const onSubmit = async (values: KycFormValues) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    // Convert files to base64 payload
    const endpoint = "/api/kyc";
    const slug = slugParam;

    const payload: any = { type: "kyc", data: { personal: {} }, files: {}, slug: slug ?? undefined };
    payload.meta = { baseUrl: window.location.origin };

    // Personal fields
    const personalKeys = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "dob",
      "nationality",
      "gender",
      "ssnOrId",
      "address1",
      "address2",
      "city",
      "state",
      "postalCode",
      "country",
      "residencyStatus",
      "employmentStatus",
      "annualIncome",
      "sourceOfFunds",
      "sourceOfFundsOther",
      "bankName",
      "documentType",
      "consent",
      "signature",
      "telegram",
    ];

    personalKeys.forEach((k) => ((payload.data.personal as any)[k] = (values as any)[k]));

    const fileFields: (keyof KycFormValues)[] = ["bankStatement", "docFront", "docBack", "selfieUsual", "selfieWithDoc"];
    for (const key of fileFields) {
      const v = (values as any)[key];
      if (v instanceof File) {
        try {
          const b = await fileToBase64(v);
          payload.files[key] = { name: b.name, mimeType: b.mimeType, base64: b.base64 };
        } catch (e) {
          console.error("File conversion error", e);
        }
      }
    }

    let resultingSlug = slug ?? undefined;

    try {
      if (endpoint) {
        try {
          const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (!res.ok) {
            console.error("Failed to submit to GAS", await res.text());
          } else {
            try {
              const data = await res.json();
              if (data && typeof data.slug === "string") {
                resultingSlug = data.slug;
              }
            } catch (parseError) {
              console.warn("GAS response parse issue", parseError);
            }
          }
        } catch (e) {
          console.error("Failed to submit to GAS", e);
        }
      }

      const nextUrl = resultingSlug ? `/waiting-approval?slug=${encodeURIComponent(resultingSlug)}` : "/waiting-approval";
      navigate(nextUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const languageLocked = Boolean(slugParam) || form.formState.isDirty || current > 0;

  return (
    <AppLayout activeNav="kyc" lockedNav={{ status: true, neobanks: true }} lockLanguageToggle={languageLocked}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto max-w-xl">
            <Progress value={progress} />
            <div className="mt-2 text-sm text-muted-foreground">{localizedSteps[current].title}</div>
          </div>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{translate("KYC Verification", "Проверка KYC")}</CardTitle>
            <CardDescription>
              {translate("Complete all steps to verify your identity securely.", "Пройдите все шаги, чтобы безопасно подтвердить свою личность.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDeclined ? (
              <Alert className="mb-6 border-yellow-500/40 bg-yellow-500/10 text-left">
                <AlertTitle>{translate("Document photos need replacement", "Фотографии документов нужно заменить")}</AlertTitle>
                <AlertDescription>
                  {translate(
                    "Your previous submission was declined because the identity document images were unclear. Review the details below, upload fresh photos, and resubmit when ready. All other information was saved for you.",
                    "Предыдущая подача была отклонена, потому что снимки документов получились нечеткими. Проверьте данные ниже, загрузите новые фотографии и отправьте форму повторно. Остальная информация уже сохранена."
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-8">
                {current === 0 && (
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("First name", "Имя")}</FormLabel>
                        <FormControl><Input {...field} placeholder={translate("John", "Иван")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Last name", "Фамилия")}</FormLabel>
                        <FormControl><Input {...field} placeholder={translate("Doe", "Иванов")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Email", "Эл. почта")}</FormLabel>
                        <FormControl><Input type="email" {...field} placeholder="john@domain.com" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Phone", "Телефон")}</FormLabel>
                        <FormControl><Input {...field} placeholder="+1 555 555 5555" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dob" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Date of birth", "Дата рождения")}</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="gender" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Gender", "Пол")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select", "Выберите")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">{translate("Male", "Мужской")}</SelectItem>
                            <SelectItem value="female">{translate("Female", "Женский")}</SelectItem>
                            <SelectItem value="other">{translate("Other", "Другое")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Nationality", "Гражданство")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select nationality", "Выберите гражданство")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {translate("Choose the country that issued your identity document.", "Выберите страну, выдавшую документ удостоверения личности.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </section>
                )}

                {current === 1 && (
                  <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="address1" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Address line 1", "Адрес, строка 1")}</FormLabel>
                        <Popover open={addressOpen} onOpenChange={setAddressOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={translate("Street, number", "Улица, дом")}
                                onFocus={() => setAddressOpen(true)}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                  setAddressQuery(e.target.value);
                                  setAddressOpen(true);
                                }}
                              />
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[320px] p-0 sm:w-[360px]" align="start">
                            <Command>
                              <CommandInput value={addressQuery} onValueChange={setAddressQuery} placeholder={translate("Type to search addresses", "Введите адрес для поиска")} />
                              <CommandList>
                                {isAddressLoading ? (
                                  <div className="py-3 text-center text-xs text-muted-foreground">{translate("Searching…", "Поиск…")}</div>
                                ) : null}
                                {addressError ? (
                                  <div className="px-3 py-2 text-xs text-destructive">{addressError}</div>
                                ) : null}
                                {!isAddressLoading && addressResults.length === 0 ? (
                                  <CommandEmpty>{translate("No suggestions found. Continue typing or enter manually.", "Подсказки не найдены. Продолжайте вводить или заполните вручную.")}</CommandEmpty>
                                ) : (
                                  <CommandGroup heading={translate("Suggestions", "Предложения")}>
                                    {addressResults.map((option, index) => (
                                      <CommandItem
                                        key={`${option.label}-${index}`}
                                        value={option.label}
                                        onSelect={() => {
                                          form.setValue("address1", option.address1 || option.label, { shouldDirty: true });
                                          form.setValue("city", option.city, { shouldDirty: true });
                                          form.setValue("state", option.state, { shouldDirty: true });
                                          form.setValue("postalCode", option.postalCode, { shouldDirty: true });
                                          form.setValue("country", option.country, { shouldDirty: true });
                                          setAddressQuery(option.address1 || option.label);
                                          setAddressOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{option.address1 || option.label}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {[option.city, option.state, option.postalCode].filter(Boolean).join(", ")}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          {translate(
                            "Start typing to search for an address and auto-fill city and postal code.",
                            "Начните вводить адрес, чтобы автоматически подставить город и индекс."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="address2" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Address line 2", "Адрес, строка 2")}</FormLabel>
                        <FormControl><Input {...field} placeholder={translate("Apartment, suite (optional)", "Квартира, корпус (опционально)")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("City", "Город")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="state" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("State/Province", "Регион / область")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="postalCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Postal code", "Почтовый индекс")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="country" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Country", "Страна")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select country", "Выберите страну")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="residencyStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Residency status", "Статус резидента")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select", "Выберите")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RESIDENCY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="employmentStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Employment status", "Занятость")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select", "Выберите")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EMPLOYMENT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="annualIncome" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Annual income", "Годовой доход")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select range", "Выберите диапазон")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ANNUAL_INCOME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sourceOfFunds" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Source of funds", "Источник средств")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select primary source", "Выберите основной источник")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SOURCE_OF_FUNDS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {translate(
                            "We use this information to tailor AML monitoring scenarios.",
                            "Эти сведения помогают настроить процедуры AML-мониторинга."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {sourceOfFundsValue === "other" && (
                      <FormField control={form.control} name="sourceOfFundsOther" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{translate("Describe your source of funds", "Опишите источник средств")}</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} placeholder={translate("e.g. Sale of property in 2023", "Например: продажа недвижимости в 2023 году")} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="bankName" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Primary banking provider", "Основной банк")}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Choose your bank", "Выберите банк")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BANK_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label[language]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {translate("Select the bank that issued the statement you will upload.", "Выберите банк, который выдал прикладываемую выписку.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {selectedBankGuide && (
                      <Alert className="md:col-span-2">
                        <AlertTitle>
                          {(BANK_OPTIONS.find((option) => option.value === bankNameValue)?.label[language] ?? translate("Statement", "Выписка"))}{" "}
                          {translate("download guide", "инструкция по загрузке")}
                        </AlertTitle>
                        <AlertDescription>
                          <ol className="list-decimal space-y-1 pl-4">
                            {(selectedBankGuide.steps[language] ?? selectedBankGuide.steps.en).map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                          {selectedBankGuide.note ? (
                            <p className="mt-2 text-muted-foreground">
                              {selectedBankGuide.note[language] ?? selectedBankGuide.note.en}
                            </p>
                          ) : null}
                          {selectedBankGuide.supportUrl ? (
                            <p className="mt-2">
                              {translate("Need more help?", "Нужна помощь?")}{" "}
                              <a className="underline" href={selectedBankGuide.supportUrl} target="_blank" rel="noreferrer">
                                {translate("Visit the bank’s support article", "Перейдите в справку банка")}
                              </a>
                              .
                            </p>
                          ) : null}
                        </AlertDescription>
                      </Alert>
                    )}
                    <FormField control={form.control} name="bankStatement" render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{translate("Bank statement (last 6 months)", "Банковская выписка за последние 6 месяцев")}</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              field.onChange(file);
                              if (file) form.clearErrors("bankStatement");
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          {translate(
                            "Upload a clear PDF or image statement in English covering the most recent 6 full months of activity.",
                            "Загрузите чёткую выписку в формате PDF или фото на английском языке за последние шесть полных месяцев операций."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </section>
                )}

                {current === 2 && (
                  <section className="grid gap-4">
                    <FormField control={form.control} name="documentType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Document type", "Тип документа")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder={translate("Select a document", "Выберите документ")} /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="passport">{translate("Passport", "Паспорт")}</SelectItem>
                            <SelectItem value="national-id">{translate("National ID card", "Национальное удостоверение личности")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {translate(
                            "Passport holders only need the photo page. National ID cards must show both the front and reverse sides.",
                            "Для паспорта достаточно фотографии страницы с фото. Для ID-карты загрузите лицевую и обратную стороны."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="ssnOrId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Document number", "Номер документа")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={translate("Exact number from your document", "Введите номер точно как в документе")} />
                        </FormControl>
                        <FormDescription>
                          {translate(
                            "Copy the number exactly as printed, including letters, digits, and separators.",
                            "Перепишите номер точно как в документе, включая буквы, цифры и разделители."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {!requiresDocBack && (
                      <Alert>
                        <AlertDescription>
                          {translate(
                            "Because you selected a passport, upload only the open photo page. Make sure the full page and machine-readable zone are visible in a single shot.",
                            "Так как вы выбрали паспорт, загрузите только разворот с фото. Убедитесь, что видна вся страница и зона MRZ."
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className={requiresDocBack ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
                      <FormField control={form.control} name="docFront" render={({ field }) => (
                        <FormItem className={requiresDocBack ? undefined : "md:col-span-2"}>
                          <FormLabel>{translate("Document front", "Лицевая сторона документа")}</FormLabel>
                          <Card>
                            <CardContent className="pt-6 grid gap-4">
                              <img src="/images/doc-front.svg" alt="Document front example" className="rounded-md border" />
                              <FormDescription>
                                {translate(
                                  "Use a high-resolution photo or scan in bright, even light. Keep every edge visible and do not cover any data with your fingers or accessories.",
                                  "Сделайте чёткое фото или скан при хорошем освещении. Должны быть видны все края, не закрывайте данные пальцами."
                                )}
                              </FormDescription>
                              <FormControl>
                                <Input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    field.onChange(file);
                                    if (file) form.clearErrors("docFront");
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </CardContent>
                          </Card>
                        </FormItem>
                      )} />
                      {requiresDocBack && (
                        <FormField control={form.control} name="docBack" render={({ field }) => (
                          <FormItem>
                            <FormLabel>{translate("Document back", "Оборотная сторона документа")}</FormLabel>
                            <Card>
                              <CardContent className="pt-6 grid gap-4">
                                <img src="/images/doc-back.svg" alt="Document back example" className="rounded-md border" />
                                <FormDescription>
                                  {translate(
                                    "Centre the reverse side, keep the text sharply in focus, and avoid glare so any barcodes or holograms remain readable.",
                                    "Расположите оборотную сторону по центру кадра, сделайте фото без бликов, чтобы текст и голограммы были читаемы."
                                  )}
                                </FormDescription>
                                <FormControl>
                                  <Input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] ?? null;
                                      field.onChange(file);
                                      if (file) form.clearErrors("docBack");
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </CardContent>
                            </Card>
                          </FormItem>
                        )} />
                      )}
                    </div>
                  </section>
                )}

                {current === 3 && (
                  <section className="grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField control={form.control} name="selfieUsual" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{translate("Usual selfie", "Обычное селфи")}</FormLabel>
                          <Card>
                            <CardContent className="pt-6 grid gap-4">
                              <img src="/images/selfie-usual.svg" alt="Usual selfie example" className="rounded-md border" />
                              <FormDescription>
                                {translate(
                                  "Stand against a plain background, look straight at the camera, and use natural daylight or bright indoor lighting. Remove hats or tinted glasses and do not apply beauty filters.",
                                  "Станьте на фоне однотонной стены, смотрите прямо в камеру и используйте естественный свет или яркое помещение. Снимите головные уборы и тёмные очки, не используйте фильтры."
                                )}
                              </FormDescription>
                              <FormControl>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    field.onChange(file);
                                    if (file) form.clearErrors("selfieUsual");
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </CardContent>
                          </Card>
                        </FormItem>
                      )} />

                      <FormField control={form.control} name="selfieWithDoc" render={({ field }) => (
                        <FormItem>
                          <FormLabel>{translate("Selfie with document", "Селфи с документом")}</FormLabel>
                          <Card>
                            <CardContent className="pt-6 grid gap-4">
                              <img src="/images/selfie-with-doc.svg" alt="Selfie with document example" className="rounded-md border" />
                              <FormDescription>
                                {translate(
                                  "Hold the exact same passport or ID card you uploaded earlier beside your face at shoulder height so the photo and personal data stay fully visible. Keep fingers clear of every corner and avoid glare on the document surface.",
                                  "Держите тот же паспорт или ID-карту, что загрузили ранее, рядом с лицом на уровне плеч, чтобы фото и персональные данные были видны полностью. Не закрывайте углы пальцами и избегайте бликов."
                                )}
                              </FormDescription>
                              <FormControl>
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    field.onChange(file);
                                    if (file) form.clearErrors("selfieWithDoc");
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </CardContent>
                          </Card>
                        </FormItem>
                      )} />

                    </div>
                  </section>
                )}

                {current === 4 && (
                  <section className="grid gap-4">
                    <Alert>
                      <AlertTitle>{translate("Final confirmation", "Финальное подтверждение")}</AlertTitle>
                      <AlertDescription>
                        {translate(
                          "Please double-check your documents before sending. You will also receive an automated Telegram confirmation — open the chat with our bot and press Start so we can notify you about status updates.",
                          "Пожалуйста, перепроверьте документы перед отправкой. Вы получите автоматическое уведомление в Telegram — откройте чат с ботом и нажмите Start, чтобы получать обновления статуса."
                        )}
                      </AlertDescription>
                    </Alert>
                    <FormField control={form.control} name="telegram" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Telegram contact", "Контакт в Telegram")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="@username or https://t.me/username" />
                        </FormControl>
                        <FormDescription>
                          {translate(
                            "We will send status updates and reminders to this Telegram account. Provide the handle without typos.",
                            "Мы будем отправлять статусы и напоминания на указанный Telegram. Укажите логин без ошибок."
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                      <ExternalLink className="h-4 w-4" />
                      <span>
                        <a href={supportBotUrl} target="_blank" rel="noreferrer" className="font-medium underline">
                          {translate("Open @awskingchina on Telegram", "Откройте @awskingchina в Telegram")}
                        </a>{" "}
                        {translate("and send the /start command if you haven't already.", "и отправьте команду /start, если ещё не сделали этого.")}
                      </span>
                    </div>
                    <FormField control={form.control} name="consent" render={({ field }) => (
                      <FormItem className="space-y-2">
                        <div className="flex items-start gap-3">
                          <input id="consent" type="checkbox" className="mt-1 h-4 w-4 rounded border-muted-foreground/30" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                          <div>
                            <FormLabel htmlFor="consent">
                              {translate("I consent to the processing of my personal data for verification and compliance.", "Я соглашаюсь на обработку моих персональных данных для проверки и комплаенса.")}
                            </FormLabel>
                            <FormDescription>
                              {translate("Your data will be handled according to AML/KYC regulations.", "Ваши данные будут обработаны в соответствии с требованиями AML/KYC.")}
                            </FormDescription>
                          </div>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="signature" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{translate("Type your full name as signature", "Введите полное имя в качестве подписи")}</FormLabel>
                        <FormControl><Input {...field} placeholder={translate("John Michael Doe", "Иван Петрович Иванов")} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </section>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="secondary" onClick={prev} disabled={current === 0}>
                    {translate("Back", "Назад")}
                  </Button>
                  {current < localizedSteps.length - 1 ? (
                    <Button type="button" onClick={next}>{translate("Continue", "Далее")}</Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? translate("Submitting...", "Отправка...") : translate("Submit KYC", "Отправить KYC")}
                    </Button>
                  )}
                </div>
                {isSubmitting ? (
                  <p className="text-xs text-muted-foreground text-center">
                    {translate("Upload in progress — please keep this page open. It can take up to 2 minutes to transfer encrypted files.", "Идёт загрузка — не закрывайте страницу. Передача зашифрованных файлов может занять до 2 минут.")}
                  </p>
                ) : null}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
