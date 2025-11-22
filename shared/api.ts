/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export type NeobankKey =
  | "paysera"
  | "wamo"
  | "threeSmoney"
  | "satchel"
  | "revolutBusiness"
  | "bitget"
  | "okx"
  | "finom";

export interface NeobankAccessRecord {
  approved: boolean;
  phone: string;
  password: string;
  email: string;
}

export type NeobankAccessMap = Record<NeobankKey, NeobankAccessRecord>;

export interface KycStatusResponse {
  slug: string;
  status?: string;
  folderUrl?: string;
  createdAt?: string;
  data?: {
    personal?: Record<string, unknown>;
    company?: Record<string, unknown>;
  };
  personalFiles?: { name: string; url: string }[];
  companyFiles?: { name: string; url: string }[];
  neobanks?: Partial<Record<string, NeobankAccessRecord>>;
}
