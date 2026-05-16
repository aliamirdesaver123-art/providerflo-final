export type DayRateType =
  | "weekdayDaytime"
  | "weekdayEvening"
  | "weekdayNight"
  | "saturday"
  | "sunday"
  | "publicHoliday";

export interface NdisLineItem {
  code: string;
  name: string;
  rate: number;
  unit: "hour" | "each" | "day" | "year";
}

export interface NdisSupportType {
  id: string;
  name: string;
  category: string;
  rates: Partial<Record<DayRateType, NdisLineItem>>;
}

export const NDIS_SUPPORT_TYPES: NdisSupportType[] = [
  // ──────────────────────────────────────────────────────────
  // CORE — ASSISTANCE WITH DAILY LIFE (Category 01)
  // ──────────────────────────────────────────────────────────
  {
    id: "self-care-standard",
    name: "Assistance with Self-Care Activities - Standard",
    category: "Core – Assistance with Daily Life",
    rates: {
      weekdayDaytime: { code: "01_011_0107_1_1", name: "Self-Care Standard – Weekday Daytime", rate: 70.23, unit: "hour" },
      weekdayEvening: { code: "01_015_0107_1_1", name: "Self-Care Standard – Weekday Evening", rate: 77.38, unit: "hour" },
      weekdayNight:   { code: "01_002_0107_1_1", name: "Self-Care Standard – Weekday Night",   rate: 78.81, unit: "hour" },
      saturday:       { code: "01_013_0107_1_1", name: "Self-Care Standard – Saturday",        rate: 98.83, unit: "hour" },
      sunday:         { code: "01_014_0107_1_1", name: "Self-Care Standard – Sunday",          rate: 127.43, unit: "hour" },
      publicHoliday:  { code: "01_012_0107_1_1", name: "Self-Care Standard – Public Holiday",  rate: 156.03, unit: "hour" },
    },
  },
  {
    id: "self-care-high-intensity",
    name: "Assistance with Self-Care Activities - High Intensity",
    category: "Core – Assistance with Daily Life",
    rates: {
      weekdayDaytime: { code: "01_450_0107_1_1", name: "Self-Care High Intensity – Weekday Daytime", rate: 75.98,  unit: "hour" },
      weekdayEvening: { code: "01_451_0107_1_1", name: "Self-Care High Intensity – Weekday Evening", rate: 83.72,  unit: "hour" },
      weekdayNight:   { code: "01_455_0107_1_1", name: "Self-Care High Intensity – Weekday Night",   rate: 85.27,  unit: "hour" },
      saturday:       { code: "01_452_0107_1_1", name: "Self-Care High Intensity – Saturday",        rate: 106.93, unit: "hour" },
      sunday:         { code: "01_453_0107_1_1", name: "Self-Care High Intensity – Sunday",          rate: 137.87, unit: "hour" },
      publicHoliday:  { code: "01_454_0107_1_1", name: "Self-Care High Intensity – Public Holiday",  rate: 168.81, unit: "hour" },
    },
  },
  {
    id: "nursing-enrolled",
    name: "Disability Health Supports – Enrolled Nurse",
    category: "Core – Assistance with Daily Life",
    rates: {
      weekdayDaytime: { code: "01_600_0114_1_1", name: "Enrolled Nurse – Weekday Daytime", rate: 99.88,  unit: "hour" },
      weekdayEvening: { code: "01_601_0114_1_1", name: "Enrolled Nurse – Weekday Evening", rate: 110.18, unit: "hour" },
      weekdayNight:   { code: "01_605_0114_1_1", name: "Enrolled Nurse – Weekday Night",   rate: 112.22, unit: "hour" },
      saturday:       { code: "01_602_0114_1_1", name: "Enrolled Nurse – Saturday",        rate: 142.48, unit: "hour" },
      sunday:         { code: "01_603_0114_1_1", name: "Enrolled Nurse – Sunday",          rate: 163.79, unit: "hour" },
      publicHoliday:  { code: "01_604_0114_1_1", name: "Enrolled Nurse – Public Holiday",  rate: 185.08, unit: "hour" },
    },
  },
  {
    id: "nursing-registered",
    name: "Disability Health Supports – Registered Nurse",
    category: "Core – Assistance with Daily Life",
    rates: {
      weekdayDaytime: { code: "01_606_0114_1_1", name: "Registered Nurse – Weekday Daytime", rate: 123.65, unit: "hour" },
      weekdayEvening: { code: "01_607_0114_1_1", name: "Registered Nurse – Weekday Evening", rate: 136.41, unit: "hour" },
      weekdayNight:   { code: "01_611_0114_1_1", name: "Registered Nurse – Weekday Night",   rate: 138.95, unit: "hour" },
      saturday:       { code: "01_608_0114_1_1", name: "Registered Nurse – Saturday",        rate: 176.47, unit: "hour" },
      sunday:         { code: "01_609_0114_1_1", name: "Registered Nurse – Sunday",          rate: 202.87, unit: "hour" },
      publicHoliday:  { code: "01_610_0114_1_1", name: "Registered Nurse – Public Holiday",  rate: 229.27, unit: "hour" },
    },
  },

  // ──────────────────────────────────────────────────────────
  // CORE — ASSISTANCE WITH COMMUNITY PARTICIPATION (Category 04)
  // ──────────────────────────────────────────────────────────
  {
    id: "community-access-standard",
    name: "Community Access – Standard",
    category: "Core – Community Participation",
    rates: {
      weekdayDaytime: { code: "04_104_0125_6_1", name: "Community Access Standard – Weekday Daytime", rate: 70.23,  unit: "hour" },
      weekdayEvening: { code: "04_103_0125_6_1", name: "Community Access Standard – Weekday Evening", rate: 77.38,  unit: "hour" },
      saturday:       { code: "04_105_0125_6_1", name: "Community Access Standard – Saturday",        rate: 98.83,  unit: "hour" },
      sunday:         { code: "04_106_0125_6_1", name: "Community Access Standard – Sunday",          rate: 127.43, unit: "hour" },
      publicHoliday:  { code: "04_102_0125_6_1", name: "Community Access Standard – Public Holiday",  rate: 156.03, unit: "hour" },
    },
  },
  {
    id: "community-access-high-intensity",
    name: "Community Access – High Intensity",
    category: "Core – Community Participation",
    rates: {
      weekdayDaytime: { code: "04_400_0104_1_1", name: "Community Access High Intensity – Weekday Daytime", rate: 75.98,  unit: "hour" },
      weekdayEvening: { code: "04_401_0104_1_1", name: "Community Access High Intensity – Weekday Evening", rate: 83.72,  unit: "hour" },
      saturday:       { code: "04_402_0104_1_1", name: "Community Access High Intensity – Saturday",        rate: 106.93, unit: "hour" },
      sunday:         { code: "04_403_0104_1_1", name: "Community Access High Intensity – Sunday",          rate: 137.87, unit: "hour" },
      publicHoliday:  { code: "04_404_0104_1_1", name: "Community Access High Intensity – Public Holiday",  rate: 168.81, unit: "hour" },
    },
  },
  {
    id: "group-activities-standard",
    name: "Group and Centre Based Activities – Standard",
    category: "Core – Community Participation",
    rates: {
      weekdayDaytime: { code: "04_102_0136_6_1", name: "Group Activities Standard – Weekday Daytime", rate: 70.23,  unit: "hour" },
      weekdayEvening: { code: "04_103_0136_6_1", name: "Group Activities Standard – Weekday Evening", rate: 77.38,  unit: "hour" },
      saturday:       { code: "04_104_0136_6_1", name: "Group Activities Standard – Saturday",        rate: 98.83,  unit: "hour" },
      sunday:         { code: "04_105_0136_6_1", name: "Group Activities Standard – Sunday",          rate: 127.43, unit: "hour" },
      publicHoliday:  { code: "04_106_0136_6_1", name: "Group Activities Standard – Public Holiday",  rate: 156.03, unit: "hour" },
    },
  },
  {
    id: "group-activities-high-intensity",
    name: "Group and Centre Based Activities – High Intensity",
    category: "Core – Community Participation",
    rates: {
      weekdayDaytime: { code: "04_600_0104_6_1", name: "Group Activities High Intensity – Weekday Daytime", rate: 75.98,  unit: "hour" },
      weekdayEvening: { code: "04_601_0104_6_1", name: "Group Activities High Intensity – Weekday Evening", rate: 83.72,  unit: "hour" },
      saturday:       { code: "04_602_0104_6_1", name: "Group Activities High Intensity – Saturday",        rate: 106.93, unit: "hour" },
      sunday:         { code: "04_603_0104_6_1", name: "Group Activities High Intensity – Sunday",          rate: 137.87, unit: "hour" },
      publicHoliday:  { code: "04_604_0104_6_1", name: "Group Activities High Intensity – Public Holiday",  rate: 168.81, unit: "hour" },
    },
  },
  {
    id: "supports-in-employment",
    name: "Supports in Employment",
    category: "Core – Community Participation",
    rates: {
      weekdayDaytime: { code: "04_801_0133_5_1", name: "Supports in Employment – Weekday Daytime", rate: 70.23,  unit: "hour" },
      weekdayEvening: { code: "04_802_0133_5_1", name: "Supports in Employment – Weekday Evening", rate: 77.38,  unit: "hour" },
      saturday:       { code: "04_803_0133_5_1", name: "Supports in Employment – Saturday",        rate: 98.83,  unit: "hour" },
      sunday:         { code: "04_804_0133_5_1", name: "Supports in Employment – Sunday",          rate: 127.43, unit: "hour" },
      publicHoliday:  { code: "04_805_0133_5_1", name: "Supports in Employment – Public Holiday",  rate: 156.03, unit: "hour" },
    },
  },

  // ──────────────────────────────────────────────────────────
  // CAPACITY BUILDING — SUPPORT COORDINATION (Category 07)
  // ──────────────────────────────────────────────────────────
  {
    id: "support-connection-l1",
    name: "Support Coordination Level 1 – Support Connection",
    category: "Capacity Building – Support Coordination",
    rates: {
      weekdayDaytime: { code: "07_001_0106_8_3", name: "Support Connection L1", rate: 80.06, unit: "hour" },
    },
  },
  {
    id: "coordination-of-supports-l2",
    name: "Support Coordination Level 2 – Coordination of Supports",
    category: "Capacity Building – Support Coordination",
    rates: {
      weekdayDaytime: { code: "07_002_0106_8_3", name: "Coordination of Supports L2", rate: 100.14, unit: "hour" },
    },
  },

  // ──────────────────────────────────────────────────────────
  // CAPACITY BUILDING — IMPROVED DAILY LIVING / THERAPY
  // ──────────────────────────────────────────────────────────
  {
    id: "therapy-ot",
    name: "Therapy – Occupational Therapist",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_661_0128_1_3", name: "OT Assessment/Therapy", rate: 193.99, unit: "hour" },
    },
  },
  {
    id: "therapy-physiotherapy",
    name: "Therapy – Physiotherapist",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_721_0128_1_3", name: "Physiotherapy Assessment/Therapy", rate: 183.99, unit: "hour" },
    },
  },
  {
    id: "therapy-speech",
    name: "Therapy – Speech Pathologist",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_665_0128_1_3", name: "Speech Pathology Assessment/Therapy", rate: 193.99, unit: "hour" },
    },
  },
  {
    id: "therapy-psychology",
    name: "Therapy – Psychologist",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_701_0128_1_3", name: "Psychology Assessment/Therapy", rate: 232.99, unit: "hour" },
    },
  },
  {
    id: "therapy-dietitian",
    name: "Therapy – Dietitian",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_760_0128_3_3", name: "Dietitian Assessment/Therapy", rate: 188.99, unit: "hour" },
    },
  },
  {
    id: "therapy-podiatry",
    name: "Therapy – Podiatrist",
    category: "Capacity Building – Improved Daily Living",
    rates: {
      weekdayDaytime: { code: "01_663_0128_1_3", name: "Podiatry Assessment/Therapy", rate: 188.99, unit: "hour" },
    },
  },
];

/**
 * Determine the NDIS day/time rate type from a shift start datetime string.
 * Assumes ISO format: "YYYY-MM-DDTHH:mm" or similar.
 * Public holidays must be marked manually.
 */
export function detectDayRateType(
  isoDatetime: string,
  isPublicHoliday = false
): DayRateType {
  if (!isoDatetime) return "weekdayDaytime";
  const d = new Date(isoDatetime);
  const day = d.getDay(); // 0=Sun, 6=Sat
  const hour = d.getHours();

  if (isPublicHoliday) return "publicHoliday";
  if (day === 0) return "sunday";
  if (day === 6) return "saturday";
  // Weekday evening: 18:00–22:00
  if (hour >= 18 && hour < 22) return "weekdayEvening";
  // Weekday night: 22:00–06:00
  if (hour >= 22 || hour < 6) return "weekdayNight";
  return "weekdayDaytime";
}

export const DAY_RATE_LABELS: Record<DayRateType, string> = {
  weekdayDaytime: "Weekday Daytime (6am–6pm)",
  weekdayEvening: "Weekday Evening (6pm–10pm)",
  weekdayNight:   "Weekday Night (10pm–6am)",
  saturday:       "Saturday",
  sunday:         "Sunday",
  publicHoliday:  "Public Holiday",
};

export function getCategories(): string[] {
  return [...new Set(NDIS_SUPPORT_TYPES.map(t => t.category))];
}

export function getSupportTypesByCategory(category: string): NdisSupportType[] {
  return NDIS_SUPPORT_TYPES.filter(t => t.category === category);
}

export function getSupportTypeById(id: string): NdisSupportType | undefined {
  return NDIS_SUPPORT_TYPES.find(t => t.id === id);
}

export function getLineItem(
  supportTypeId: string,
  dayRateType: DayRateType
): NdisLineItem | undefined {
  const supportType = getSupportTypeById(supportTypeId);
  if (!supportType) return undefined;
  return supportType.rates[dayRateType] ?? supportType.rates.weekdayDaytime;
}
