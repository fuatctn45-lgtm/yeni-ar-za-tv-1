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
