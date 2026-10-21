import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Ariza, AppConfig, PlantSettings, Intervention } from './types';

// Skill error handling format
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Connect to default Firestore database where real collections (arizalar, settings, ayarlar) exist
export const db = getFirestore(app);

/**
 * Subscribe to all 'arizalar' documents with real-time updates and change detection
 */
/**
 * Firestore dökümanını Ariza arayüzüne eksiksiz dönüştüren yardımcı fonksiyon.
 * Ana Bakımcı, Yardımcı Bakımcı(lar) ve Arıza Logları dahil tüm alanları destekler.
 */
function mapDocToAriza(id: string, data: any): Ariza {
  const anaBakimci =
    data.anaBakimci ||
    data.startedBy ||
    data.assignedTo ||
    data.mainOperator ||
    data.leadOperator ||
    data.operator ||
    data['operatör'] ||
    data.lastInterventionBy ||
    '';

  const rawHelpers =
    data.helpers ||
    data.yardimciBakimci ||
    data.yardimcilar ||
    data['yardımcılar'] ||
    data.yardimci ||
    [];
  const helpersList: string[] = [];
  if (Array.isArray(rawHelpers)) {
    rawHelpers.forEach((h: any) => {
      if (typeof h === 'string' && h.trim()) helpersList.push(h.trim());
    });
  } else if (typeof rawHelpers === 'string' && rawHelpers.trim()) {
    rawHelpers.split(',').forEach((s: string) => {
      if (s.trim()) helpersList.push(s.trim());
    });
  }

  // Veritabanındaki müdahaleler / interventions dizisini tüm formatlarda eşle
  const rawInterventionsList =
    Array.isArray(data['müdahaleler'])
      ? data['müdahaleler']
      : Array.isArray(data.mudahaleler)
      ? data.mudahaleler
      : Array.isArray(data.interventions)
      ? data.interventions
      : Array.isArray(data.logs)
      ? data.logs
      : Array.isArray(data.arizaLoglari)
      ? data.arizaLoglari
      : [];

  const rawInterventions: Intervention[] = rawInterventionsList.map((item: any) => ({
    timestamp: item.timestamp || item.zaman || item['zaman damgası'] || item.tarih || '',
    operator: item.operator || item['operatör'] || item.kullanici || '',
    role: item.role || item.rol || 'Ana Bakımcı',
    status: item.status || item.durum || '',
    actionTaken: item.actionTaken || item['Gerçekleştirilen eylem'] || item.yapilanIslem || item.eylem || '',
    logAction: item.logAction || item.actionTaken || item['Gerçekleştirilen eylem'] || '',
    durationMin: item.durationMin || item['SüreMin'] || item.sure || 0,
    helpers: Array.isArray(item.helpers) ? item.helpers : Array.isArray(item['yardımcılar']) ? item['yardımcılar'] : [],
  }));

  const logText =
    data.arizaLog ||
    data.actionTaken ||
    data['Gerçekleştirilen eylem'] ||
    data.yapilanIslem ||
    data.log ||
    '';

  // Veritabanındaki en güncel durum metni:
  // ÖNCELİK 1: Dökümanın kendi güncel durum/status alanı (KOLONLU MATKAP gibi dökümanlarda en yetkili anlık durum)
  // ÖNCELİK 2: Yalnızca dökümanda hiçbir durum yazmıyorsa son müdahale adımındaki durum
  const docDurum = (data.durum || data.status || '').trim();
  const lastInvStatus =
    rawInterventions.length > 0 ? (rawInterventions[rawInterventions.length - 1].status || '') : '';

  const finalDurum = (docDurum || lastInvStatus || 'Açık').trim();

  return {
    id,
    machine: data.machine || data.makine || data.makineAdi || data.machineName || 'Bilinmeyen Makine',
    jobType: data.jobType || data['işTürü'] || data.isTuru || data.is_turu || data.arizaTuru || data.type || 'Mekanik Arıza',
    costCenter: data.costCenter || data['maliyet merkezi'] || data.masrafMerkezi || '',
    shift: data.shift || data.vardiya || '',
    status: finalDurum,
    description:
      data.description ||
      data['Tanım'] ||
      data.tanim ||
      data['işAçıklaması'] ||
      data['iş açıklaması'] ||
      data.isAciklamasi ||
      data.is_aciklamasi ||
      data.aciklama ||
      data.arizaAciklamasi ||
      data.aciklamasi ||
      data.detail ||
      data.sorun ||
      data.not ||
      data.notlar ||
      data.talep ||
      '',
    userName: data.userName || data.kullanici || data['operatör'] || '',
    photoUrl: data.photoUrl || '',
    photoUploadStatus: data.photoUploadStatus || '',
    partsChanged: data.partsChanged || '',
    actionTaken: logText,
    resolvedData: data.resolvedData || null,
    createdAt: data.createdAt || data['oluşturulma tarihi'] || data.olusturmaTarihi,
    startedBy: anaBakimci,
    assignedTo: data.assignedTo || anaBakimci,
    startedAt: data.startedAt || '',
    lastInterventionBy: data.lastInterventionBy || anaBakimci,
    lastInterventionAt: data.lastInterventionAt || data.startedAt || '',
    interventions: rawInterventions,
    pausedOperators: Array.isArray(data.pausedOperators) ? data.pausedOperators : [],
    helpers: helpersList,
    anaBakimci,
    yardimciBakimci: helpersList,
    arizaLog: logText,
    durum: finalDurum,
    completedAt: data.completedAt || data.closedAt || data.resolvedAt || '',
    completedBy: data.completedBy || data.closedBy || data.resolvedBy || '',
    closedAt: data.closedAt || data.completedAt || '',
    closedBy: data.closedBy || data.completedBy || '',
  };
}

/**
 * Subscribe to all 'arizalar' documents with real-time updates, self-healing auto-reconnect
 */
export function subscribeToArizalar(
  onData: (arizalar: Ariza[], newlyAddedItems?: Ariza[]) => void,
  onError?: (err: any) => void
): () => void {
  let isInitialLoad = true;
  let isDisposed = false;
  let activeUnsub: (() => void) | null = null;
  let reconnectTimer: any = null;

  function connect() {
    if (isDisposed) return;
    try {
      const colRef = collection(db, 'arizalar');
      activeUnsub = onSnapshot(
        colRef,
        (snapshot) => {
          if (isDisposed) return;
          const items: Ariza[] = [];
          const newItems: Ariza[] = [];

          snapshot.forEach((docSnap) => {
            items.push(mapDocToAriza(docSnap.id, docSnap.data()));
          });

          // Detect newly arriving jobs after initial boot
          if (!isInitialLoad) {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                newItems.push(mapDocToAriza(change.doc.id, change.doc.data()));
              }
            });
          }

          isInitialLoad = false;
          onData(items, newItems);
        },
        (error) => {
          if (isDisposed) return;
          console.warn('[Firestore Live Listener Warning]:', error);
          handleFirestoreError(error, OperationType.GET, 'arizalar');
          if (onError) onError(error);

          // Otomatik yeniden bağlanma (3 saniye sonra)
          if (activeUnsub) {
            try {
              activeUnsub();
            } catch (e) {}
            activeUnsub = null;
          }
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            connect();
          }, 3000);
        }
      );
    } catch (err) {
      if (isDisposed) return;
      console.warn('[Firestore Connect Error]:', err);
      if (onError) onError(err);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        connect();
      }, 3000);
    }
  }

  connect();

  return () => {
    isDisposed = true;
    clearTimeout(reconnectTimer);
    if (activeUnsub) {
      try {
        activeUnsub();
      } catch (e) {}
    }
  };
}

/**
 * Direct fetch all 'arizalar' documents (for manual refresh / ping)
 */
export async function fetchAllArizalarDirect(): Promise<Ariza[]> {
  try {
    const colRef = collection(db, 'arizalar');
    const snapshot = await getDocs(colRef);
    const items: Ariza[] = [];
    snapshot.forEach((docSnap) => {
      items.push(mapDocToAriza(docSnap.id, docSnap.data()));
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'arizalar');
    throw error;
  }
}

/**
 * Subscribe to settings/config (operators, reasons)
 */
export function subscribeToConfig(onData: (config: AppConfig) => void) {
  const docRef = doc(db, 'settings', 'config');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onData({
          operators: Array.isArray(data.operators) ? data.operators : [],
          stoppageReasons: Array.isArray(data.stoppageReasons) ? data.stoppageReasons : [],
          faultReasons: Array.isArray(data.faultReasons) ? data.faultReasons : [],
          rootCauses: Array.isArray(data.rootCauses) ? data.rootCauses : [],
        });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/config');
    }
  );
}

/**
 * Fetch machines & shifts from ayarlar collection
 */
export async function fetchPlantSettings(): Promise<PlantSettings> {
  const result: PlantSettings = {
    machines: [],
    operators: [],
    shifts: [],
  };

  try {
    const machinesSnap = await getDoc(doc(db, 'ayarlar', 'machines'));
    if (machinesSnap.exists() && Array.isArray(machinesSnap.data().list)) {
      result.machines = machinesSnap.data().list;
    }

    const shiftsSnap = await getDoc(doc(db, 'ayarlar', 'shifts'));
    if (shiftsSnap.exists() && Array.isArray(shiftsSnap.data().list)) {
      result.shifts = shiftsSnap.data().list;
    }

    const opsSnap = await getDoc(doc(db, 'ayarlar', 'operators'));
    if (opsSnap.exists() && Array.isArray(opsSnap.data().list)) {
      result.operators = opsSnap.data().list;
    }

    const syncSnap = await getDoc(doc(db, 'ayarlar', 'syncSettings'));
    if (syncSnap.exists()) {
      result.syncSettings = syncSnap.data() as any;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'ayarlar');
  }

  return result;
}

/**
 * Update Ariza Status & Interventions
 */
export async function updateArizaIntervention(
  arizaId: string,
  newStatus: string,
  operatorName: string,
  role: string = 'Ana Bakımcı',
  logAction: string = 'DURUM GÜNCELLENDİ',
  actionTakenText: string = '',
  partsChangedText: string = '',
  existingInterventions: Intervention[] = []
) {
  const nowIso = new Date().toISOString();
  const newIntervention: Intervention = {
    timestamp: nowIso,
    operator: operatorName,
    role,
    status: newStatus,
    logAction,
    actionTaken: actionTakenText,
    durationMin: 1,
    helpers: [],
  };

  const updatedInterventions = [...existingInterventions, newIntervention];

  const updatePayload: Record<string, any> = {
    status: newStatus,
    lastInterventionBy: operatorName,
    lastInterventionAt: nowIso,
    interventions: updatedInterventions,
  };

  if (actionTakenText) {
    updatePayload.actionTaken = actionTakenText;
  }
  if (partsChangedText) {
    updatePayload.partsChanged = partsChangedText;
  }
  if (newStatus.toLowerCase().includes('müdahale') || newStatus.toLowerCase().includes('mudahale')) {
    updatePayload.status = 'Müdahale Ediliyor';
    updatePayload.startedBy = operatorName;
    updatePayload.assignedTo = operatorName;
    updatePayload.startedAt = nowIso;
  }
  if (newStatus === 'Tamamlandı' || newStatus === 'Çözüldü') {
    updatePayload.resolvedData = {
      resolvedAt: nowIso,
      resolvedBy: operatorName,
      actionTaken: actionTakenText,
    };
  }

  try {
    const docRef = doc(db, 'arizalar', arizaId);
    await updateDoc(docRef, updatePayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `arizalar/${arizaId}`);
    throw err;
  }
}

/**
 * Create a new Ariza record
 */
export async function createAriza(payload: {
  machine: string;
  jobType: string;
  costCenter: string;
  shift: string;
  userName: string;
  description: string;
  photoUrl?: string;
}) {
  try {
    const colRef = collection(db, 'arizalar');
    const docData = {
      ...payload,
      status: 'Açık',
      photoUploadStatus: payload.photoUrl ? 'Var' : 'Yok',
      createdAt: serverTimestamp(),
      interventions: [],
      partsChanged: '-',
      actionTaken: '',
      resolvedData: null,
      helpers: [],
      pausedOperators: [],
    };
    const res = await addDoc(colRef, docData);
    return res.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'arizalar');
    throw err;
  }
}
