// Malaysian National Holidays (informational for pricing/planning)
export const malaysiaHolidays = [
  { date: "2025-01-01", label: "New Year's Day", type: "public" },
  { date: "2025-01-29", label: "Thaipusam", type: "regional" },
  { date: "2025-02-01", label: "Federal Territory Day", type: "federal" },
  { date: "2025-03-31", label: "Ramadan begins (obs)", type: "observance" },
  { date: "2025-04-01", label: "Nuzul Al-Quran", type: "public" },
  { date: "2025-04-10", label: "Hari Raya Aidilfitri (Day 1)", type: "public" },
  { date: "2025-04-11", label: "Hari Raya Aidilfitri (Day 2)", type: "public" },
  { date: "2025-05-01", label: "Labour Day", type: "public" },
  { date: "2025-05-12", label: "Wesak Day", type: "public" },
  { date: "2025-05-31", label: "Agong's Birthday", type: "public" },
  { date: "2025-06-07", label: "Hari Gawai", type: "regional" },
  { date: "2025-06-08", label: "Hari Gawai (Day 2)", type: "regional" },
  { date: "2025-06-29", label: "Awal Muharram", type: "public" },
  { date: "2025-08-31", label: "National Day", type: "public" },
  { date: "2025-09-16", label: "Malaysia Day", type: "public" },
  { date: "2025-10-06", label: "Deepavali (tentative)", type: "public" },
  { date: "2025-12-25", label: "Christmas", type: "public" },
];

export const holidayByDate = new Map(malaysiaHolidays.map((h) => [h.date, h]));