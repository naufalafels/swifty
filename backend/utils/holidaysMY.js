// Malaysian National Holidays (sample 2025 set; extend as needed)
export const malaysiaHolidays = [
  "2025-01-01", // New Year's Day
  "2025-01-29", // Thaipusam
  "2025-02-28", // Federal Territory Day
  "2025-03-31", // Ramadan begins (obs)
  "2025-04-01", // Nuzul Al-Quran
  "2025-04-10", // Hari Raya Aidilfitri
  "2025-04-11", // Hari Raya Aidilfitri (Day 2)
  "2025-05-01", // Labour Day
  "2025-05-12", // Wesak Day
  "2025-05-31", // Agong's Birthday
  "2025-06-07", // Hari Gawai
  "2025-06-08", // Hari Gawai (Day 2)
  "2025-06-29", // Awal Muharram
  "2025-08-31", // National Day
  "2025-09-16", // Malaysia Day
  "2025-10-06", // Deepavali (tentative)
  "2025-12-25"  // Christmas
];

// Utility to check if a date string (yyyy-MM-dd) is a holiday
export const isMalaysiaHoliday = (isoDate) => malaysiaHolidays.includes(isoDate);