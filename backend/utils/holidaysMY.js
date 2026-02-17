// Malaysian Public Holidays — dynamically fetched from Nager.Date API
// Docs: https://date.nager.at/swagger/index.html

// In-memory cache: { [year]: { holidays: [...], fetchedAt: Date } }
const cache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch Malaysian public holidays for a given year from Nager.Date API.
 * Falls back to an empty array on failure.
 */
async function fetchHolidaysForYear(year) {
  try {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/MY`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Nager.Date API returned ${res.status} for year ${year}`);
      return [];
    }
    const data = await res.json();
    // Nager.Date returns: [{ date, localName, name, countryCode, types, ... }]
    // Transform to match existing shape: { date, label, type }
    return data.map((h) => ({
      date: h.date,                          // "2026-02-01"
      label: h.localName || h.name,          // Use local (Malay) name, fallback to English
      type: (h.types || []).includes("Public") ? "public" : "regional",
    }));
  } catch (err) {
    console.error(`Failed to fetch holidays for ${year}:`, err.message);
    return [];
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

// --- Backward-compatible static export (fallback only) ---
// Kept so any other imports don't break, but getHostCalendar should use getMalaysiaHolidays()
export const malaysiaHolidays = [];
export const holidayByDate = new Map();