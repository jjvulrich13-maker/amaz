import type { NeobankAccessMap, NeobankAccessRecord, NeobankKey } from "@shared/api";

export interface NeobankMeta {
  key: NeobankKey;
  name: string;
  description: string;
  descriptionRu: string;
  website: string;
  androidUrl?: string;
  iosUrl?: string;
  accent: string;
}

export const NEO_BANKS: NeobankMeta[] = [
  {
    key: "paysera",
    name: "Paysera Business",
    description: "Pan-European IBAN accounts with instant SEPA payments and powerful FX for growing companies.",
    descriptionRu: "Панъевропейские IBAN-счета с мгновенными SEPA-платежами и выгодным обменом валют для растущих компаний.",
    website: "https://www.paysera.com/v2/en-LT/business",
    androidUrl: "https://play.google.com/store/apps/details?id=lt.lemonlabs.android.paysera&hl=en",
    iosUrl: "https://apps.apple.com/us/app/paysera-super-app/id737308884",
    accent: "#ff9900",
  },
  {
    key: "wamo",
    name: "Wamo Business",
    description: "Quick digital onboarding for EU companies with local IBANs and virtual cards within minutes.",
    descriptionRu: "Быстрое цифровое онбординг-решение для компаний ЕС с локальными IBAN и виртуальными картами за считанные минуты.",
    website: "https://wamo.io/business-account/",
    androidUrl: "https://play.google.com/store/apps/details?id=com.wamo.business&hl=en",
    iosUrl: "https://apps.apple.com/ua/app/wamo-business/id1547767396",
    accent: "#3b82f6",
  },
  {
    key: "threeSmoney",
    name: "3S Money",
    description: "Multi-currency business banking for cross-border merchants and exporters with dedicated IBANs.",
    descriptionRu: "Мультивалютный бизнес-банкинг для международных торговцев и экспортёров с выделенными IBAN.",
    website: "https://3s.money/business-account/",
    androidUrl: "https://play.google.com/store/apps/details?id=com.mobile3smoney.app&hl=en",
    iosUrl: "https://apps.apple.com/us/app/3s-money/id6452016748",
    accent: "#0f4c81",
  },
  {
    key: "satchel",
    name: "Satchel",
    description: "Lithuanian EMI focused on SMBs needing traditional IBANs, payroll support, and debit cards.",
    descriptionRu: "Литовская EMI-платформа для малого и среднего бизнеса с традиционными IBAN, поддержкой зарплатных проектов и картами.",
    website: "https://satchel.eu/business/",
    androidUrl: "https://play.google.com/store/apps/details?id=com.thefintechlab.whitelabelandroid&hl=en",
    iosUrl: "https://apps.apple.com/us/app/satchel-money-management/id1385513368",
    accent: "#1c3f94",
  },
  {
    key: "revolutBusiness",
    name: "Revolut Business",
    description: "All-in-one banking for modern teams with borderless accounts, cards, FX, and automated expenses.",
    descriptionRu: "Универсальный банк для современных команд с мультивалютными счетами, картами и автоматизацией расходов.",
    website: "https://www.revolut.com/business/",
    androidUrl: "https://play.google.com/store/apps/details?id=com.revolut.business&hl=en",
    iosUrl: "https://apps.apple.com/us/app/revolut-business/id1436969262",
    accent: "#262f3d",
  },
  {
    key: "bitget",
    name: "Bitget Corporate",
    description: "Advanced crypto exchange access with OTC desks for treasury operations and merchant settlements.",
    descriptionRu: "Продвинутая криптобиржа с OTC-десками для казначейства и расчётов с мерчантами.",
    website: "https://www.bitget.com/en/institutional",
    androidUrl: "https://play.google.com/store/apps/details?id=com.bitget.exchange&hl=en",
    iosUrl: "https://apps.apple.com/us/app/bitget-trade-bitcoin-crypto/id1442778704",
    accent: "#009dbd",
  },
  {
    key: "okx",
    name: "OKX Institutional",
    description: "Pro-grade trading platform with wallets, custody, and liquidity for global Web3 businesses.",
    descriptionRu: "Профессиональная трейдинговая платформа с кошельками, кастоди и ликвидностью для глобальных Web3-компаний.",
    website: "https://www.okx.com/institutional",
    androidUrl: "https://play.google.com/store/apps/details?id=com.okinc.okex.gp&hl=en",
    iosUrl: "https://apps.apple.com/us/app/okx-buy-bitcoin-btc-crypto/id1327268470",
    accent: "#111827",
  },
  {
    key: "finom",
    name: "Finom Business",
    description: "Dutch-based fintech offering invoicing, cards, and IBAN accounts tailored for EU freelancers and SMBs.",
    descriptionRu: "Нидерландский финтех, предлагающий счета IBAN, инвойсинг и карты для фрилансеров и малого бизнеса ЕС.",
    website: "https://finom.co/en-eu/",
    androidUrl: "https://play.google.com/store/apps/details?id=tech.pnlfin.finom&hl=en",
    iosUrl: "https://apps.apple.com/us/app/finom-business-account/id1483892148",
    accent: "#f97316",
  },
];

export const emptyNeobankEntry = (): NeobankAccessRecord => ({
  approved: false,
  phone: "",
  password: "",
  email: "",
});

export const buildEmptyNeobankMap = (): NeobankAccessMap =>
  NEO_BANKS.reduce((acc, bank) => {
    acc[bank.key] = emptyNeobankEntry();
    return acc;
  }, {} as NeobankAccessMap);

export const mergeNeobankMap = (incoming?: Partial<Record<string, NeobankAccessRecord>>): NeobankAccessMap => {
  const base = buildEmptyNeobankMap();
  if (!incoming) return base;
  Object.keys(incoming).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(base, key)) return;
    const payload = incoming[key];
    if (!payload) return;
    const typedKey = key as NeobankKey;
    base[typedKey] = {
      approved: Boolean(payload.approved),
      phone: payload.phone ?? "",
      password: payload.password ?? "",
      email: payload.email ?? "",
    };
  });
  return base;
};
