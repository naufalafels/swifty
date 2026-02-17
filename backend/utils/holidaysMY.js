// Malaysian Public Holidays — dynamically fetched from Nager.Date API
// Docs: https://date.nager.at/swagger/index.html

// In-memory cache: { [year]: { holidays: [...], fetchedAt: Date } }
const cache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Hardcoded fallback holidays in case the API is down or doesn't have data for a year
const FALLBACK_HOLIDAYS = {
  2025: [
    { date: "2025-01-01", label: "New Year's Day", type: "public" },
    { date: "2025-01-29", label: "Thaipusam", type: "public" },
    { date: "2025-02-01", label: "Federal Territory Day", type: "public" },
    { date: "2025-03-30", label: "Nuzul Al-Quran", type: "public" },
    { date: "2025-03-31", label: "Hari Raya Aidilfitri", type: "public" },
    { date: "2025-04-01", label: "Hari Raya Aidilfitri (Day 2)", type: "public" },
    { date: "2025-05-01", label: "Labour Day", type: "public" },
    { date: "2025-05-12", label: "Wesak Day", type: "public" },
    { date: "2025-06-02", label: "Agong's Birthday", type: "public" },
    { date: "2025-06-07", label: "Hari Raya Haji", type: "public" },
    { date: "2025-06-08", label: "Hari Raya Haji (Day 2)", type: "public" },
    { date: "2025-06-28", label: "Awal Muharram", type: "public" },
    { date: "2025-08-31", label: "National Day", type: "public" },
    { date: "2025-09-06", label: "Maulidur Rasul", type: "public" },
    { date: "2025-09-16", label: "Malaysia Day", type: "public" },
    { date: "2025-10-20", label: "Deepavali", type: "public" },
    { date: "2025-12-25", label: "Christmas", type: "public" },
  ],
  2026: [
    { date: "2026-01-01", label: "New Year's Day", type: "public" },
    { date: "2026-01-17", label: "Thaipusam", type: "public" },
    { date: "2026-02-01", label: "Federal Territory Day", type: "public" },
    { date: "2026-03-20", label: "Nuzul Al-Quran", type: "public" },
    { date: "2026-03-21", label: "Hari Raya Aidilfitri", type: "public" },
    { date: "2026-03-22", label: "Hari Raya Aidilfitri (Day 2)", type: "public" },
    { date: "2026-05-01", label: "Labour Day", type: "public" },
    { date: "2026-05-02", label: "Wesak Day", type: "public" },
    { date: "2026-05-27", label: "Hari Raya Haji", type: "public" },
    { date: "2026-05-28", label: "Hari Raya Haji (Day 2)", type: "public" },
    { date: "2026-06-01", label: "Agong's Birthday", type: "public" },
    { date: "2026-06-17", label: "Awal Muharram", type: "public" },
    { date: "2026-08-27", label: "Maulidur Rasul", type: "public" },
    { date: "2026-08-31", label: "National Day", type: "public" },
    { date: "2026-09-16", label: "Malaysia Day", type: "public" },
    { date: "2026-11-08", label: "Deepavali", type: "public" },
    { date: "2026-12-25", label: "Christmas", type: "public" },
  ],
  2027: [
    { date: "2027-01-01", label: "New Year's Day", type: "public" },
    { date: "2027-02-01", label: "Federal Territory Day", type: "public" },
    { date: "2027-03-11", label: "Hari Raya Aidilfitri", type: "public" },
    { date: "2027-03-12", label: "Hari Raya Aidilfitri (Day 2)", type: "public" },
    { date: "2027-05-01", label: "Labour Day", type: "public" },
    { date: "2027-05-17", label: "Hari Raya Haji", type: "public" },
    { date: "2027-05-18", label: "Hari Raya Haji (Day 2)", type: "public" },
    { date: "2027-06-07", label: "Awal Muharram", type: "public" },
    { date: "2027-08-16", label: "Maulidur Rasul", type: "public" },
    { date: "2027-08-31", label: "National Day", type: "public" },
    { date: "2027-09-16", label: "Malaysia Day", type: "public" },
    { date: "2027-12-25", label: "Christmas", type: "public" },
  ],
};

/**
 * Fetch Malaysian public holidays for a given year from Nager.Date API.
 * Falls back to hardcoded holidays if the API fails or returns empty.
 */
async function fetchHolidaysForYear(year) {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/MY`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`Nager.Date API returned ${res.status} for year ${year}, using fallback`);
      return FALLBACK_HOLIDAYS[year] || [];
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`Nager.Date API returned empty data for year ${year}, using fallback`);
      return FALLBACK_HOLIDAYS[year] || [];
    }

    // Nager.Date returns: [{ date, localName, name, countryCode, types: ["Public"], ... }]
    // Transform to match our shape: { date, label, type }
    return data.map((h) => {
      const types = Array.isArray(h.types) ? h.types : [];
      const isPublic = types.some(
        (t) => (typeof t === "string" ? t.toLowerCase() : "") === "public"
      );
      return {
        date: h.date,
        label: h.localName || h.name,
        type: isPublic ? "public" : "regional",
      };
    });
  } catch (err) {
    console.error(`Failed to fetch holidays for ${year}:`, err.message);
    return FALLBACK_HOLIDAYS[year] || [];
  }
}

/**
 * Get Malaysian holidays for one or more years, with caching.
 * @param {number[]} years - e.g. [2026] or [2025, 2026]
 * @returns {Promise<Array<{ date: string, label: string, type: string }>>}
 */
export async function getMalaysiaHolidays(years) {
  const allHolidays = [];

  for (const year of years) {
    const cached = cache[year];
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
      allHolidays.push(...cached.holidays);
      continue;
    }

    const holidays = await fetchHolidaysForYear(year);
    cache[year] = { holidays, fetchedAt: Date.now() };
    allHolidays.push(...holidays);
  }

  return allHolidays;
}

/**
 * Build a Map<date, holiday> for quick lookup.
 */
export function buildHolidayByDate(holidays) {
  return new Map(holidays.map((h) => [h.date, h]));
}

// --- Backward-compatible static exports (fallback only) ---
export const malaysiaHolidays = [];
export const holidayByDate = new Map();