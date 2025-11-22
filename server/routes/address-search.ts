import type { RequestHandler } from "express";

const DEFAULT_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT || "AmazonOnboarding/1.0 (support@amazonkycdesk.com)";

interface AddressResult {
  label: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function normalizeAddress(raw: any): AddressResult {
  const address = raw?.address || {};
  const houseNumber = address.house_number || "";
  const road = address.road || address.pedestrian || address.cycleway || address.industrial || "";
  let addressLine = "";
  if (houseNumber && road) addressLine = `${houseNumber} ${road}`.trim();
  else if (road) addressLine = road;
  else if (addressLine === "" && typeof raw.display_name === "string") {
    addressLine = raw.display_name.split(",")[0].trim();
  }

  const city = address.city || address.town || address.village || address.hamlet || address.municipality || "";
  const state = address.state || address.region || address.county || "";
  const postalCode = address.postcode || "";
  const country = address.country || "";

  return {
    label: typeof raw.display_name === "string" ? raw.display_name : addressLine,
    address1: addressLine,
    city,
    state,
    postalCode,
    country,
  };
}

export const handleAddressSearch: RequestHandler = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    res.json({ results: [] });
    return;
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "10",
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT, "Accept-Language": "en" },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Address lookup failed" });
      return;
    }

    const payload = await response.json();
    const results = Array.isArray(payload)
      ? payload
          .map(normalizeAddress)
          .filter((item) => item.address1 && item.country)
      : [];

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: "Unable to fetch address suggestions" });
  }
};
