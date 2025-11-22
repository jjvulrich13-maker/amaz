import type { RequestHandler } from "express";

function resolveEndpoint() {
  const url = process.env.VITE_GAS_KYC_URL;
  if (!url) {
    throw new Error("Missing GAS endpoint for KYC");
  }
  return url;
}

async function forwardToGas(init: RequestInit, overrideUrl?: string) {
  const endpoint = overrideUrl ?? resolveEndpoint();
  try {
    const response = await fetch(endpoint, init);
    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = { raw: text ?? null };
    }
    return { response, data };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    err.message = `Failed to reach GAS: ${err.message}`;
    throw err;
  }
}

export const postKyc: RequestHandler = async (req, res) => {
  try {
    const payload = { ...req.body, type: "kyc" };
    const { response, data } = await forwardToGas({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      res.status(response.status).json({ error: "GAS returned an error", details: data });
      return;
    }
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: message });
  }
};

export const getKyc: RequestHandler = async (req, res) => {
  const slug = req.query.slug;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "Missing slug" });
    return;
  }
  try {
    const base = resolveEndpoint();
    const url = `${base}?slug=${encodeURIComponent(slug)}`;
    const { response, data } = await forwardToGas(
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "follow",
      },
      url,
    );

    if (!response.ok) {
      res.status(response.status).json({ error: "GAS returned an error", details: data });
      return;
    }
    res.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(502).json({ error: message });
  }
};
