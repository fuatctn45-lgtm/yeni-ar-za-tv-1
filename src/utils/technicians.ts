import { Ariza, Intervention } from '../types';

export interface ActiveTechnicians {
  anaBakimci: string;
  yardimciBakimcilar: string[];
}

/**
 * Bir arızadaki aktif Ana Bakımcı ve Yardımcı Bakımcıları kesin doğrulukla tespit eder.
 * Bir yardımcı bakımdan ayrıldığında ("Yardımdan ayrıldı", "Ayrıldı", "Bıraktı" vb.)
 * veya ariza.helpers / ariza.pausedOperators güncellendiğinde artık aktif olarak gösterilmez.
 */
export function getActiveTechnicians(ariza: Ariza): ActiveTechnicians {
  // 1. Ana Bakımcı Tespiti
  let anaBakimci =
    ariza.anaBakimci ||
    ariza.startedBy ||
    ariza.assignedTo ||
    (ariza as any).mainOperator ||
    '';

  // 2. Yardımcı Bakımcı Tespiti
  let helpers: string[] = [];

  // Öncelikle varsa dokümandaki anlık helpers dizisini al
  if (Array.isArray(ariza.helpers)) {
    helpers = ariza.helpers
      .filter((h) => typeof h === 'string' && h.trim().length > 0)
      .map((h) => h.trim());
  } else if (Array.isArray((ariza as any).yardimciBakimci)) {
    helpers = (ariza as any).yardimciBakimci
      .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
      .map((h: any) => h.trim());
  } else if (typeof (ariza as any).yardimciBakimci === 'string' && (ariza as any).yardimciBakimci.trim()) {
    helpers = [(ariza as any).yardimciBakimci.trim()];
  }

  // 3. Müdahale Geçmişi (Interventions) analizi
  // Her operatörün en son durumunu tespit et (Katıldı mı, Ayrıldı mı?)
  if (Array.isArray(ariza.interventions) && ariza.interventions.length > 0) {
    // Kronolojik sıra: son adımlar sona eklenir
    const lastActionByOperator = new Map<string, { isHelping: boolean; role: string }>();

    ariza.interventions.forEach((inv: Intervention) => {
      const op = (inv.operator || '').trim();
      if (!op) return;

      const logAction = (inv.logAction || '').toLowerCase();
      const actionTaken = (inv.actionTaken || '').toLowerCase();
      const status = (inv.status || '').toLowerCase();
      const role = (inv.role || '').toLowerCase();
      const combined = `${logAction} ${actionTaken} ${status} ${role}`;

      const isLeaving =
        combined.includes('ayrıl') ||
        combined.includes('ayrildi') ||
        combined.includes('bırak') ||
        combined.includes('birakti') ||
        combined.includes('çık') ||
        combined.includes('cikti') ||
        combined.includes('duraklat') ||
        combined.includes('paused');

      const isJoiningHelper =
        !isLeaving &&
        (combined.includes('yardım') || role === 'yardımcı');

      if (isLeaving) {
        lastActionByOperator.set(op.toLowerCase(), { isHelping: false, role });
      } else if (isJoiningHelper) {
        lastActionByOperator.set(op.toLowerCase(), { isHelping: true, role: 'Yardımcı' });
      }

      // Eğer ana bakımcı henüz yoksa ve role Ana Bakımcı ise
      if (!anaBakimci && (role.includes('ana') || (!isJoiningHelper && !isLeaving))) {
        anaBakimci = op;
      }
    });

    // En son işleminde ayrılan kişileri helpers listesinden kesinlikle temizle
    lastActionByOperator.forEach((state, opLower) => {
      if (!state.isHelping) {
        helpers = helpers.filter((h) => h.toLowerCase() !== opLower);
      } else if (state.isHelping && !helpers.some((h) => h.toLowerCase() === opLower)) {
        // En son işlemde yardımda ama dokümanda helpers dizisi yoksa listeye dahil et
        // Orijinal büyük/küçük harf halini bul
        const originalName = ariza.interventions?.find(
          (i) => (i.operator || '').trim().toLowerCase() === opLower
        )?.operator?.trim();
        if (originalName) {
          helpers.push(originalName);
        }
      }
    });
  }

  // 4. Duraklatılan operatörler (pausedOperators) filtresi
  if (Array.isArray(ariza.pausedOperators) && ariza.pausedOperators.length > 0) {
    const paused = new Set(ariza.pausedOperators.map((p) => p.trim().toLowerCase()));
    helpers = helpers.filter((h) => !paused.has(h.toLowerCase()));
  }

  // 5. Ana Bakımcı ile Yardımcı aynı kişi olamaz
  if (anaBakimci) {
    helpers = helpers.filter((h) => h.toLowerCase() !== anaBakimci.toLowerCase());
  } else if (!anaBakimci && ariza.lastInterventionBy) {
    anaBakimci = ariza.lastInterventionBy;
  }

  return {
    anaBakimci,
    yardimciBakimcilar: helpers,
  };
}

/**
 * Metnin arızanın kapatıldığını, çözüldüğünü veya tamamlandığını belirten
 * bir durum olup olmadığını (Kapalı, Kapatıldı, Kapandı, Tamamlandı, Çözüldü vb.)
 * Türkçe karakter duyarlılığı ve tüm varyasyonlarla kontrol eder.
 */
export function isClosedStatusText(val: any): boolean {
  if (!val || typeof val !== 'string') return false;
  const clean = val
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const lower = val.trim().toLowerCase();

  const match = (s: string) =>
    s.includes('kapal') ||
    s.includes('kapat') ||
    s.includes('kapan') ||
    s.includes('tamam') ||
    s.includes('coz') ||
    s.includes('çöz') ||
    s.includes('bitti') ||
    s.includes('sonlan') ||
    s.includes('closed') ||
    s.includes('resolved') ||
    s.includes('completed');

  return match(lower) || match(clean);
}

/**
 * Bir arızanın kapatılıp kapatılmadığını (Kapalı, Kapandı, Kapatıldı, Tamamlandı, Çözüldü vb.)
 * tüm olası durum, kapanış zaman damgası ve müdahale log adımlarına göre kesin olarak tespit eder.
 */
export function isFaultClosed(ariza: Ariza | null | undefined): boolean {
  if (!ariza) return false;

  // 1. Durum metni kontrolü (Kapalı, Kapatıldı, Kapandı, Tamamlandı, Çözüldü vb.)
  const statusStr = (ariza.status || (ariza as any).durum || '').trim();
  if (isClosedStatusText(statusStr)) {
    return true;
  }

  // 2. Çözüm verisi (resolvedData) kontrolü
  if (ariza.resolvedData && typeof ariza.resolvedData === 'object' && Object.keys(ariza.resolvedData).length > 0) {
    return true;
  }

  // 3. Kapatılma zaman damgası veya kapatan operatör kontrolü
  if (
    ariza.closedAt ||
    (ariza as any).resolvedAt ||
    ariza.completedAt ||
    ariza.completedBy ||
    ariza.closedBy ||
    (ariza as any).tamamlanmaTarihi
  ) {
    return true;
  }

  // 4. Müdahale geçmişindeki en son adımın kapatma/çözüm işlemi olup olmadığı kontrolü
  if (Array.isArray(ariza.interventions) && ariza.interventions.length > 0) {
    const last = ariza.interventions[ariza.interventions.length - 1];
    const invStatus = (last.status || (last as any).durum || '').trim();
    if (isClosedStatusText(invStatus)) {
      return true;
    }

    const logAction = (last.logAction || '').trim();
    const actionTaken = (last.actionTaken || '').trim();
    if (isClosedStatusText(logAction) || isClosedStatusText(actionTaken)) {
      return true;
    }

    // Müdahale içindeki yardımcılar objesinde durum "Kapalı" ise
    const invAny = last as any;
    const helperObj = invAny.yardimcilar || invAny['yardımcılar'] || invAny.yardimci;
    if (helperObj && typeof helperObj === 'object' && !Array.isArray(helperObj)) {
      if (isClosedStatusText(helperObj.durum || helperObj.status)) {
        return true;
      }
    }
  }

  return false;
}

export interface ArizaStatusInfo {
  statusText: string;
  isResolved: boolean;
  isWaitingParts: boolean;
  isWaitingService: boolean;
  isHandedOver: boolean;
  isUnderIntervention: boolean;
  isOpenWaiting: boolean;
  rawStatus: string;
}

/**
 * Arızanın durumunu DOĞRUDAN VERİTABANINA GÖRE tespit eder.
 * Kullanıcı İsteği: "veri tabaındaki durum ile sendeki farklı veri tabnına göre davran"
 *
 * Veritabanında kayıtlı durum ("Dış Servis Bekliyor", "Parça Bekliyor", "Devredildi",
 * "Müdahale Ediliyor", "Bekliyor", "Tamamlandı" vb.) ne ise doğrudan o durum kullanılır
 * ve operatör/startedBy var diye durum yapay olarak MÜDAHALE'ye çevrilmez.
 */
export function getArizaStatusInfo(ariza: Ariza | null | undefined): ArizaStatusInfo {
  if (!ariza) {
    return {
      statusText: 'BEKLİYOR',
      isResolved: false,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: true,
      rawStatus: '',
    };
  }

  // 1. Kapalı / Çözüldü / Tamamlandı kontrolü (Önce kapatılanlar)
  if (isFaultClosed(ariza)) {
    return {
      statusText: 'KAPANDI',
      isResolved: true,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: false,
      rawStatus: 'Kapandı',
    };
  }

  // Veritabanındaki en güncel durum metinlerini al
  // ÖNCELİK 1: Dökümanın kendi güncel durum / status alanı (KOLONLU MATKAP gibi dökümanlarda en yetkili anlık durum)
  // ÖNCELİK 2: Yalnızca dökümanda hiçbir durum yazmıyorsa son müdahale logundaki durum
  const lastInv =
    Array.isArray(ariza.interventions) && ariza.interventions.length > 0
      ? ariza.interventions[ariza.interventions.length - 1]
      : null;

  const docDurum = (ariza.durum || '').trim();
  const docStatus = (ariza.status || '').trim();
  const lastInvStatus = (lastInv ? (lastInv.status || (lastInv as any).durum || '') : '').trim();

  // Veritabanındaki en güncel ham durum metni
  const rawStatus = (docDurum || docStatus || lastInvStatus || '').trim();

  const normalizeStr = (s: string) =>
    s
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const norm = normalizeStr(rawStatus);

  // 2. KAPALI / ÇÖZÜLDÜ
  if (
    norm.includes('kapan') ||
    norm.includes('tamamlan') ||
    norm.includes('cozul') ||
    norm === 'bitti'
  ) {
    return {
      statusText: 'KAPANDI',
      isResolved: true,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: false,
      rawStatus,
    };
  }

  // 3. DIŞ SERVİS BEKLİYOR KONTROLÜ (Veritabanında: "Dış Servis Bekliyor")
  if (
    norm.includes('dis servis') ||
    norm.includes('servis bekliyor') ||
    norm.includes('dis-servis') ||
    norm.includes('serviste')
  ) {
    return {
      statusText: 'DIŞ SERVİS BEKLİYOR',
      isResolved: false,
      isWaitingParts: false,
      isWaitingService: true,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: false,
      rawStatus,
    };
  }

  // 4. PARÇA BEKLİYOR KONTROLÜ (Veritabanında: "Parça Bekliyor", "Yedek Parça")
  if (norm.includes('parca') || norm.includes('yedek')) {
    return {
      statusText: 'PARÇA BEKLİYOR',
      isResolved: false,
      isWaitingParts: true,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: false,
      rawStatus,
    };
  }

  // 5. DEVREDİLDİ KONTROLÜ
  if (norm.includes('devred') || norm.includes('devir')) {
    return {
      statusText: 'DEVREDİLDİ',
      isResolved: false,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: true,
      isUnderIntervention: false,
      isOpenWaiting: false,
      rawStatus,
    };
  }

  // 6. MÜDAHALE / İŞLEMDE KONTROLÜ
  // Yalnızca veritabanındaki durum açıkça müdahale/işlemde ise MÜDAHALE sayılır
  const hasInterventionKeyword =
    norm.includes('mudahale') ||
    norm.includes('islem') ||
    norm.includes('bakimda') ||
    norm.includes('onarim') ||
    norm.includes('calisiliyor') ||
    norm.includes('calisma');

  if (hasInterventionKeyword) {
    return {
      statusText: norm.includes('ediliyor') ? 'MÜDAHALE EDİLİYOR' : 'MÜDAHALE',
      isResolved: false,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: true,
      isOpenWaiting: false,
      rawStatus,
    };
  }

  // 7. BEKLİYOR / AÇIK
  if (
    norm === '' ||
    norm === 'acik' ||
    norm === 'bekliyor' ||
    norm === 'beklemede' ||
    norm === 'yeni'
  ) {
    return {
      statusText: 'BEKLİYOR',
      isResolved: false,
      isWaitingParts: false,
      isWaitingService: false,
      isHandedOver: false,
      isUnderIntervention: false,
      isOpenWaiting: true,
      rawStatus,
    };
  }

  // 8. DİĞER VERİTABANI DURUMLARI (Veritabanındaki metin birebir büyük harfle yansıtılır)
  return {
    statusText: rawStatus.toLocaleUpperCase('tr-TR'),
    isResolved: false,
    isWaitingParts: false,
    isWaitingService: false,
    isHandedOver: false,
    isUnderIntervention: false,
    isOpenWaiting: false,
    rawStatus,
  };
}

/**
 * Arızada aktif bir müdahale olup olmadığını kontrol eder.
 * Kullanıcı İsteği: "devreden arızalada eğer müdahale varsa onu yukarı taşı"
 */
export function hasArizaIntervention(ariza: Ariza | null | undefined): boolean {
  if (!ariza) return false;
  return getArizaStatusInfo(ariza).isUnderIntervention;
}

