export type ArizaStatus = 'Açık' | 'Müdahalede' | 'Müdahale Ediliyor' | 'İşlemde' | 'Parça Bekliyor' | 'Devredildi' | 'Tamamlandı' | 'Çözüldü';

export interface Intervention {
  timestamp: string;
  operator: string;
  role: 'Ana Bakımcı' | 'Yardımcı' | string;
  status: string;
  actionTaken?: string;
  logAction?: string;
  durationMin?: number;
  helpers?: string[];
}

export interface Ariza {
  id: string;
  machine: string;
  jobType: string;
  costCenter?: string;
  shift?: string;
  status: ArizaStatus | string;
  description: string;
  userName?: string;
  photoUrl?: string;
  photoUploadStatus?: string;
  partsChanged?: string;
  actionTaken?: string;
  resolvedData?: any;
  createdAt?: any; // Firestore Timestamp or string or Date
  startedBy?: string;
  assignedTo?: string;
  startedAt?: string;
  lastInterventionBy?: string;
  lastInterventionAt?: string;
  interventions?: Intervention[];
  pausedOperators?: string[];
  helpers?: string[];
  anaBakimci?: string;
  yardimciBakimci?: string | string[];
  arizaLog?: string;
  durum?: string;
  completedAt?: any;
  completedBy?: string;
  closedAt?: any;
  closedBy?: string;
}

export interface Operator {
  id: string;
  name: string;
  shortName?: string;
  role: 'admin' | 'teknisyen' | string;
  pin?: string;
  photo?: string;
  qrExemptUntil?: number;
}

export interface AppConfig {
  operators: Operator[];
  stoppageReasons: string[];
  faultReasons: string[];
  rootCauses?: string[];
}

export interface PlantSettings {
  machines: string[];
  operators: string[];
  shifts: string[];
  syncSettings?: {
    exportUrl?: string;
    exportTime?: string;
    lastSyncDate?: string;
  };
}
