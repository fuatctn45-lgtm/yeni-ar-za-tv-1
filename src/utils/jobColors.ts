/**
 * Fault type color mapping as requested:
 * - Elektrik: #FFFF00 (Sarı)
 * - Mekanik: #00FFFF (Camgöbeği)
 * - Planlı Bakım: #FFA500 (Turuncu)
 * - İş Güvenliği: #FF0000 (Kırmızı)
 * - Tekrar Eden: #FF99FF (Eflatun/Pembe)
 */

export interface JobTypeConfig {
  key: string;
  name: string;
  hex: string;
  darkHex: string;
  textColor: string;
  isDarkBg?: boolean;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
}

export const JOB_TYPE_COLORS: Record<string, JobTypeConfig> = {
  elektrik: {
    key: 'elektrik',
    name: 'Elektrik Arızası',
    hex: '#FFFF00',
    darkHex: '#4d4d00',
    textColor: '#000000',
    isDarkBg: false,
    badgeBg: '#000000',
    badgeText: '#FFFF00',
    borderColor: '#eab308',
  },
  mekanik: {
    key: 'mekanik',
    name: 'Mekanik Arıza',
    hex: '#00FFFF',
    darkHex: '#004d4d',
    textColor: '#000000',
    isDarkBg: false,
    badgeBg: '#000000',
    badgeText: '#00FFFF',
    borderColor: '#06b6d4',
  },
  planli_bakim: {
    key: 'planli_bakim',
    name: 'Planlı Bakım Kodu',
    hex: '#FFA500',
    darkHex: '#4d3200',
    textColor: '#000000',
    isDarkBg: false,
    badgeBg: '#000000',
    badgeText: '#FFA500',
    borderColor: '#f97316',
  },
  is_guvenligi: {
    key: 'is_guvenligi',
    name: 'İş Güvenliği !!!',
    hex: '#FF0000',
    darkHex: '#4d0000',
    textColor: '#FFFFFF',
    isDarkBg: true,
    badgeBg: '#000000',
    badgeText: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tekrar_eden: {
    key: 'tekrar_eden',
    name: 'Tekrar Eden Arıza !!!!',
    hex: '#FF99FF',
    darkHex: '#380c38',
    textColor: '#000000',
    isDarkBg: false,
    badgeBg: '#000000',
    badgeText: '#FF99FF',
    borderColor: '#d946ef',
  },
  diger: {
    key: 'diger',
    name: 'Genel Bakım & Onarım',
    hex: '#E2E8F0',
    darkHex: '#1e293b',
    textColor: '#0f172a',
    isDarkBg: false,
    badgeBg: '#0f172a',
    badgeText: '#cbd5e1',
    borderColor: '#94a3b8',
  },
};

export function getJobTypeConfig(rawJobType?: string): JobTypeConfig {
  if (!rawJobType) return JOB_TYPE_COLORS.diger;
  const upper = rawJobType.toUpperCase();

  if (upper.includes('GÜVENLİĞİ') || upper.includes('GUVENLIGI') || upper.includes('İŞ GÜVEN')) {
    return JOB_TYPE_COLORS.is_guvenligi;
  }
  if (upper.includes('TEKRAR')) {
    return JOB_TYPE_COLORS.tekrar_eden;
  }
  if (upper.includes('ELEKTRİK') || upper.includes('ELEKTRIK')) {
    return JOB_TYPE_COLORS.elektrik;
  }
  if (upper.includes('PLANLI')) {
    return JOB_TYPE_COLORS.planli_bakim;
  }
  if (upper.includes('MEKANİK') || upper.includes('MEKANIK')) {
    return JOB_TYPE_COLORS.mekanik;
  }

  return JOB_TYPE_COLORS.diger;
}
