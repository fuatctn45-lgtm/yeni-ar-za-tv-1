import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  subscribeToArizalar,
  subscribeToConfig,
  fetchPlantSettings,
  fetchAllArizalarDirect
} from './firebase';
import { Ariza, AppConfig, PlantSettings } from './types';
import {
  parseFirestoreDate,
  formatTimeOnly,
  getEffectiveProductionDate,
  isCreatedToday
} from './utils/date';
import { soundFx } from './utils/audio';
import { faultAnnouncer, AnnouncerStatus } from './utils/announcer';
import { TvHeader } from './components/TvHeader';
import { ArizaRow } from './components/ArizaRow';
import { ArizaDetailModal } from './components/ArizaDetailModal';
import { getJobTypeConfig, getJobTypeSortRank } from './utils/jobColors';
import { getActiveTechnicians, isFaultClosed, getArizaStatusInfo } from './utils/technicians';
import {
  X,
  Inbox,
  Archive,
  CheckCircle2,
  Layers
} from 'lucide-react';

export default function App() {
  const [arizalar, setArizalar] = useState<Ariza[]>([]);
  const [config, setConfig] = useState<AppConfig>({
    operators: [],
    stoppageReasons: [],
    faultReasons: [],
  });
  const [plantSettings, setPlantSettings] = useState<PlantSettings>({
    machines: [],
    operators: [],
    shifts: [],
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [selectedAriza, setSelectedAriza] = useState<Ariza | null>(null);

  // Anlık yeni arıza alarm bannerı
  const [newArrivalAlert, setNewArrivalAlert] = useState<Ariza | null>(null);

  // Sesli anons durumu (5 defa uyarı sesi + arızayı okuma)
  const [announcerStatus, setAnnouncerStatus] = useState<AnnouncerStatus>({
    isPlaying: false,
    currentRepeat: 0,
    totalRepeats: 5,
    ariza: null,
  });

  useEffect(() => {
    return faultAnnouncer.subscribe((status) => {
      setAnnouncerStatus(status);
      // Kullanıcı Kuralı: "yukada cıkan bildirm de ses ile birlikte kapansın"
      // Sesli anons bittiğinde (5 tekrar tamamlandığında) veya susturulduğunda bildirim de otomatik kapanır
      if (!status.isPlaying) {
        setNewArrivalAlert(null);
      }
    });
  }, []);

  const autoScroll = false; // TV modunda varsayılan sabit veya kullanıcı kontrollü
  const [isAutoScrollActive, setIsAutoScrollActive] = useState(false);

  // Bu oturumda anlık olarak canlı düşen arızaların kimlikleri
  const [sessionNewArrivalIds, setSessionNewArrivalIds] = useState<Set<string>>(new Set());

  const prevCountRef = useRef<number>(0);
  const prevSigRef = useRef<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Firestore canlı dinleyicisi (Real-time snapshot)
  useEffect(() => {
    const markSync = () => {
      setLastSyncTime(
        new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    const unsubArizalar = subscribeToArizalar(
      (data, newlyAddedItems = []) => {
        setIsOnline(true);
        markSync();

        // Eğer anlık yeni bir veya daha fazla arıza eklendiyse:
        // Kullanıcı Kuralı: "sisteme yeni arıza geldiğinde önce uyarı sesi versin dah sonra arızayı okusun bun 5 defa yapsın"
        if (newlyAddedItems.length > 0) {
          const newest = newlyAddedItems[newlyAddedItems.length - 1];
          setNewArrivalAlert(newest);
          faultAnnouncer.announceFault(newest, 5);

          setSessionNewArrivalIds((prev) => {
            const next = new Set(prev);
            newlyAddedItems.forEach((it) => next.add(it.id));
            return next;
          });

          // En yeni kayıt en üste geldiği için otomatik olarak ekranı en başa sar
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else if (prevCountRef.current > 0 && data.length > prevCountRef.current) {
          const newest = data[0];
          if (newest) {
            setNewArrivalAlert(newest);
            faultAnnouncer.announceFault(newest, 5);
          }
        }

        // Eğer ekrandaki bildirimdeki arıza kapatıldıysa bildirimi ve sesi hemen kaldır
        setNewArrivalAlert((curr) => {
          if (!curr) return null;
          const updated = data.find((d) => d.id === curr.id);
          if (updated && isFaultClosed(updated)) {
            faultAnnouncer.cancel();
            return null;
          }
          return updated || curr;
        });

        // Kapatılan arızaları en üstte tutma setinden derhal temizle
        setSessionNewArrivalIds((prev) => {
          const next = new Set(prev);
          data.forEach((d) => {
            if (isFaultClosed(d)) {
              next.delete(d.id);
            }
          });
          return next;
        });

        prevCountRef.current = data.length;
        setArizalar(data);
      },
      () => {
        // Hata durumunda hemen offline yapma, arka plan heartbeat denemeye devam eder
      }
    );

    // 2. Çift Katmanlı Kesintisiz Canlı Heartbeat (Her 3 saniyede bir otomatik veritabanı kontrolü)
    // Bu sayede WebSocket gecikmesi veya tarayıcı arka plan kısıtlaması olsa dahi
    // sistem kesintisiz olarak veritabanı ile canlı ve online kalır.
    const heartbeatInterval = setInterval(async () => {
      try {
        const fresh = await fetchAllArizalarDirect();
        setIsOnline(true);
        markSync();

        setArizalar((currentList) => {
          const currentSig = JSON.stringify(
            currentList.map((a) => [a.id, a.durum, a.status, a.interventions?.length, a.startedBy])
          );
          const freshSig = JSON.stringify(
            fresh.map((a) => [a.id, a.durum, a.status, a.interventions?.length, a.startedBy])
          );
          if (currentSig !== freshSig) {
            return fresh;
          }
          return currentList;
        });
      } catch (err) {
        console.warn('[Heartbeat check warning]:', err);
      }
    }, 3000);

    const unsubConfig = subscribeToConfig((cfg) => {
      setConfig(cfg);
    });

    fetchPlantSettings().then((ps) => {
      setPlantSettings(ps);
    });

    return () => {
      unsubArizalar();
      clearInterval(heartbeatInterval);
      unsubConfig();
    };
  }, []);

  // 2. TV Otomatik Kaydırma Mekanizması
  useEffect(() => {
    if (!isAutoScrollActive) return;
    const interval = setInterval(() => {
      if (!scrollContainerRef.current) return;
      const el = scrollContainerRef.current;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 15;
      if (atBottom) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ top: 280, behavior: 'smooth' });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isAutoScrollActive]);

  // Manuel Yenileme
  const handleManualRefresh = async () => {
    try {
      const freshData = await fetchAllArizalarDirect();
      setArizalar(freshData);
      setLastSyncTime(
        new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      soundFx.playChime();
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Sıralama Fonksiyonu: HER YENİ GELEN KESİNLİKLE EN ÜSTE GELECEK
  const getSortTimestamp = (a: Ariza): number => {
    // Canlı oturumda yeni düşen bir kayıt henüz kapatılmadıysa en üstte tut
    if (sessionNewArrivalIds.has(a.id) && !isFaultClosed(a)) {
      return Number.MAX_SAFE_INTEGER;
    }
    const d = parseFirestoreDate(a.createdAt);
    if (!d || isNaN(d.getTime())) {
      // Henüz server timestamp yazılmamış yeni kayıtları en üstte tutmak için şu anki zamanı ver
      return Date.now();
    }
    return d.getTime();
  };

  // Fabrika üretim/veri referans tarihi
  const effectiveDate = useMemo(() => getEffectiveProductionDate(arizalar), [arizalar]);

  // Kullanıcı Kuralı: "durum kaplı ise ekranda gösterme zaten arıza kapatılmış"
  // Kapatılan arızalar (Kapalı, Kapatıldı, Tamamlandı, Çözüldü) açık arıza ekranında kesinlikle yer almaz.
  const { activeArizalar, devredenArizalar, closedArizalar } = useMemo(() => {
    const active: Ariza[] = [];
    const devreden: Ariza[] = [];
    const closed: Ariza[] = [];

    arizalar.forEach((a) => {
      // 1. Kapalı, Kapatıldı, Çözüldü veya Tamamlandı ise doğrudan kapatılanlar listesine alınır
      if (isFaultClosed(a)) {
        closed.push(a);
        return;
      }

      // 2. 24:00 sonrası ertesi güne girildiğinde dünden kalan henüz çözülmemiş açık arızalar
      const isToday = isCreatedToday(a.createdAt, effectiveDate, new Date());
      if (!isToday) {
        devreden.push(a);
        return;
      }

      // 3. Bugün açılmış ve henüz tamamlanmamış/kapatılmamış açık arızalar
      active.push(a);
    });

    // 1. Bugünün aktif arızaları: en yeni gelen kayıtlar en üstte
    active.sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));

    // 2. Kullanıcı İstekleri:
    // - "devredeb aızaları tür,ne göre sıral sıralma 1 mek 2 elek 3 isg 4 tekrar eden 5 planlam gibi olsun sıralam"
    // - "devreden arızalada eğer müdahale varsa onu yukarı taşı"
    devreden.sort((a, b) => {
      // 1. Öncelik: Eğer arızaya müdahale varsa (MÜDAHALE durumundaysa) en yukarı taşınır
      const hasInterventionA = getArizaStatusInfo(a).isUnderIntervention;
      const hasInterventionB = getArizaStatusInfo(b).isUnderIntervention;

      if (hasInterventionA !== hasInterventionB) {
        return hasInterventionA ? -1 : 1;
      }

      // 2. Öncelik: Tür sıralaması (1: Mekanik, 2: Elektrik, 3: İSG, 4: Tekrar Eden, 5: Planlama, 6: Diğer)
      const rankA = getJobTypeSortRank(a.jobType);
      const rankB = getJobTypeSortRank(b.jobType);
      if (rankA !== rankB) {
        return rankA - rankB; // 1: Mekanik, 2: Elektrik, 3: İSG, 4: Tekrar Eden, 5: Planlama, 6: Diğer
      }

      // 3. Öncelik: Tarih/saat damgasına göre en yeni kayıtlar
      return getSortTimestamp(b) - getSortTimestamp(a);
    });

    return { activeArizalar: active, devredenArizalar: devreden, closedArizalar: closed };
  }, [arizalar, effectiveDate, sessionNewArrivalIds]);

  // Arızaları iş türüne göre gruplama fonksiyonu
  interface JobGroup {
    key: string;
    name: string;
    hex: string;
    textColor: string;
    items: Ariza[];
  }

  const groupListByJobType = (list: Ariza[]): JobGroup[] => {
    const groupsMap: Record<string, JobGroup> = {
      is_guvenligi: {
        key: 'is_guvenligi',
        name: 'İŞ GÜVENLİĞİ',
        hex: '#FF0000',
        textColor: '#FFFFFF',
        items: [],
      },
      elektrik: {
        key: 'elektrik',
        name: 'ELEKTRİK ARIZALARI',
        hex: '#FFFF00',
        textColor: '#000000',
        items: [],
      },
      mekanik: {
        key: 'mekanik',
        name: 'MEKANİK ARIZALARI',
        hex: '#00FFFF',
        textColor: '#000000',
        items: [],
      },
      planli_bakim: {
        key: 'planli_bakim',
        name: 'PLANLI BAKIM',
        hex: '#FFA500',
        textColor: '#000000',
        items: [],
      },
      tekrar_eden: {
        key: 'tekrar_eden',
        name: 'TEKRAR EDEN ARIZALAR',
        hex: '#FF99FF',
        textColor: '#000000',
        items: [],
      },
      diger: {
        key: 'diger',
        name: 'GENEL BAKIM & DİĞER',
        hex: '#E2E8F0',
        textColor: '#000000',
        items: [],
      },
    };

    list.forEach((item) => {
      const config = getJobTypeConfig(item.jobType);
      const key = config.key || 'diger';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          name: (config.name || key).toUpperCase(),
          hex: config.hex,
          textColor: config.textColor,
          items: [],
        };
      }
      groupsMap[key].items.push(item);
    });

    // Her grup içindeki kayıtları sırala: en yeni gelen en üstte
    Object.values(groupsMap).forEach((g) => {
      g.items.sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
    });

    // Kaydı olan grupları al ve EN YENİ ARIZA İÇEREN GRUBU DAİMA EN ÜSTE AL
    const groupsWithItems = Object.values(groupsMap).filter((g) => g.items.length > 0);
    groupsWithItems.sort((gA, gB) => {
      const topA = gA.items.length > 0 ? getSortTimestamp(gA.items[0]) : 0;
      const topB = gB.items.length > 0 ? getSortTimestamp(gB.items[0]) : 0;
      return topB - topA;
    });

    return groupsWithItems;
  };


  // Sayaçlar (Fabrika TV Panosu) - Sadece açık arızalar sayılır, kapatılanlar kesinlikle hariçtir
  const allUnresolved = useMemo(
    () => arizalar.filter((a) => !isFaultClosed(a)),
    [arizalar]
  );
  const totalOpen = allUnresolved.length;

  const activeInterventionsCount = useMemo(
    () => allUnresolved.filter((a) => getArizaStatusInfo(a).isUnderIntervention).length,
    [allUnresolved]
  );

  const waitingPartsCount = useMemo(
    () => allUnresolved.filter((a) => getArizaStatusInfo(a).isWaitingParts).length,
    [allUnresolved]
  );

  // Bugün açık arızalar
  const todayCount = activeArizalar.length;

  // Önceki günlerden devreden açık arızalar
  const pendingPreviousDaysCount = devredenArizalar.length;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* ÜST MENÜ: Kompakt, köşeli, temel göstergeler */}
      <TvHeader
        totalOpen={totalOpen}
        activeInterventionsCount={activeInterventionsCount}
        todayCount={todayCount}
        pendingPreviousDaysCount={pendingPreviousDaysCount}
        waitingPartsCount={waitingPartsCount}
        isOnline={isOnline}
        lastSyncTime={lastSyncTime}
        onRefresh={handleManualRefresh}
        autoScroll={isAutoScrollActive}
        onToggleAutoScroll={() => setIsAutoScrollActive(!isAutoScrollActive)}
      />

      {/* ANLIK CANLI YENİ İŞ İSTEK BİLDİRİMİ BANNERI (Köşeli, Ekranda Kalır & 5 Defa Sesli Anons) */}
      {newArrivalAlert && (
        <div className="bg-red-600 text-white px-3 py-1.5 flex items-center justify-between gap-3 border-b-2 border-black rounded-none shrink-0 z-30 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
            <span className="bg-black text-yellow-300 text-xs font-black uppercase px-2 py-0.5 rounded-none tracking-wider shrink-0 flex items-center gap-1.5">
              <span>⚡ YENİ İŞ İSTEK BİLDİRİMİ GELDİ</span>
              {announcerStatus.isPlaying && (
                <span className="bg-red-700 text-white text-[10px] px-1.5 py-0.2 rounded-none font-mono tracking-normal">
                  🔊 ANONS: {announcerStatus.currentRepeat}/{announcerStatus.totalRepeats}
                </span>
              )}
            </span>
            <span className="text-xs font-mono text-slate-200 shrink-0">
              {formatTimeOnly(newArrivalAlert.createdAt)}
            </span>
            <span className="text-xs font-black truncate text-white">
              Makine Adı: <span className="text-yellow-200">{newArrivalAlert.machine}</span>
            </span>
            <span className="text-xs font-bold text-white/95 shrink-0">
              • Arıza Türü: <span className="text-yellow-100">{newArrivalAlert.jobType}</span>
            </span>
            {(() => {
              const { anaBakimci: alertAna, yardimciBakimcilar: alertYardimcilar } = getActiveTechnicians(newArrivalAlert);
              return (
                <>
                  {alertAna && (
                    <span className="text-xs font-bold text-cyan-200 shrink-0">
                      • Ana Bakımcı: {alertAna}
                    </span>
                  )}
                  {alertYardimcilar.length > 0 && (
                    <span className="text-xs font-bold text-amber-200 shrink-0">
                      • Yardımcı: {alertYardimcilar.join(', ')}
                    </span>
                  )}
                </>
              );
            })()}
            <span className="text-xs text-white/95 truncate max-w-xs sm:max-w-md lg:max-w-lg">
              • Açıklama: <span className="text-slate-100 font-semibold">{newArrivalAlert.description || 'Belirtilmedi'}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {announcerStatus.isPlaying ? (
              <button
                onClick={() => faultAnnouncer.cancel()}
                className="px-2 py-0.5 rounded-none bg-black text-yellow-300 font-bold text-xs hover:bg-slate-900 transition-colors border border-yellow-400/40 uppercase"
                title="Sesli anonsu sustur"
              >
                Sesi Sustur
              </button>
            ) : (
              <button
                onClick={() => faultAnnouncer.announceFault(newArrivalAlert, 5)}
                className="px-2 py-0.5 rounded-none bg-black text-amber-300 font-bold text-xs hover:bg-slate-900 transition-colors border border-amber-400/40 uppercase"
                title="Sesli anonsu baştan 5 defa oku"
              >
                Tekrar Oku (5x)
              </button>
            )}
            <button
              onClick={() => {
                faultAnnouncer.cancel();
                setSelectedAriza(newArrivalAlert);
              }}
              className="px-2.5 py-0.5 rounded-none bg-black text-white font-black text-xs hover:bg-slate-900 transition-colors border border-white/20 uppercase"
            >
              Görüntüle
            </button>
            <button
              onClick={() => {
                faultAnnouncer.cancel();
                setNewArrivalAlert(null);
              }}
              className="p-1 hover:bg-black/30 rounded-none transition-colors text-white"
              title="Bildirimi Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ANA TABLO LİSTESİ: EXCEL GİBİ ÇİZGİLİ, EN GENİŞE GÖRE OTO UYARLANAN HİZALI SÜTUNLAR */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-auto bg-slate-950 flex flex-col justify-between scroll-smooth"
      >
        <div className="w-full min-w-max flex-1 flex flex-col justify-between min-h-full">
          {/* 1. AKTİF / BUGÜNÜN AÇIK ARIZALARI TABLOSU (EN ÜSTTE) */}
          <div className="w-full">
            <table className="w-full border-collapse border border-slate-700/80 text-left table-auto">
              {/* EXCEL BAŞLIK SATIRI (Sabit Yapışkan, Çizgili Hücreler, Daraltılmış Yükseklik) */}
              <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
                <tr className="text-slate-300 uppercase text-[10.5px] font-bold leading-none">
                  <th className="border border-slate-700/90 px-2 py-1 text-left text-amber-300 font-black tracking-wide whitespace-nowrap bg-slate-900">
                    DURUM
                  </th>
                  <th className="border border-slate-700/90 px-2.5 py-1 text-left text-white font-black tracking-tight text-[11.5px] whitespace-nowrap bg-slate-900">
                    MAKİNE
                  </th>
                  <th className="border border-slate-700/90 px-2.5 py-1 text-left text-white font-black tracking-tight text-[11.5px] whitespace-nowrap bg-slate-900">
                    İŞ AÇIKLAMASI
                  </th>
                  <th className="border border-slate-700/90 px-2.5 py-1 text-left text-slate-300 font-bold whitespace-nowrap bg-slate-900">
                    ARIZA TÜRÜ
                  </th>
                  <th className="border border-slate-700/90 px-2.5 py-1 text-left text-slate-300 font-bold whitespace-nowrap bg-slate-900">
                    BAKIMCILAR (ANA / YRD)
                  </th>
                  <th className="border border-slate-700/90 px-2.5 py-1 text-left text-slate-300 font-bold whitespace-nowrap bg-slate-900">
                    SÜRE / SAAT
                  </th>
                  <th className="border border-slate-700/90 px-1 py-1 text-center text-slate-400 font-bold text-[9px] whitespace-nowrap w-8 bg-slate-900">
                    DETAY
                  </th>
                </tr>
              </thead>

              {/* TABLO GÖVDESİ */}
              <tbody>
                {activeArizalar.length === 0 ? (
                  <tr className="bg-slate-950">
                    <td
                      colSpan={7}
                      className="p-2.5 text-center text-[10.5px] font-bold text-slate-500 uppercase tracking-wider border border-slate-800"
                    >
                      Şu an bugüne ait bekleyen veya işlem gören açık arıza kaydı bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  activeArizalar.map((ariza) => (
                    <ArizaRow
                      key={ariza.id}
                      ariza={ariza}
                      isOld={false}
                      isNewArrival={sessionNewArrivalIds.has(ariza.id)}
                      onSelect={(a) => setSelectedAriza(a)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 2. DEVREDEN AÇIK ARIZALAR TABLOSU (KULLANICI İSTEĞİ: EN ALTA ÇEKİLDİ - mt-auto İLE TABAN HİZASI) */}
          <div className="mt-auto pt-3 w-full">
            <div className="bg-slate-900 border-y-2 border-amber-500/80 text-[10.5px] font-bold uppercase text-amber-400 px-2.5 py-0.5 flex items-center justify-between tracking-wider shadow-xs">
              <div className="flex items-center gap-2">
                <span className="font-black text-amber-300">
                  DEVREDEN ARIZALAR ({devredenArizalar.length} KAYIT)
                </span>
                <span className="hidden lg:inline text-[9.5px] text-amber-200/90 font-semibold normal-case">
                  • Müdahaledekiler En Üstte • 1. Mekanik | 2. Elektrik | 3. İSG | 4. Tekrar Eden | 5. Planlama
                </span>
              </div>
              <span className="text-[9.5px] font-mono text-slate-400 hidden sm:inline">
                MÜDAHALE & TÜRE GÖRE SIRALI
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-700/80 text-left table-auto">
              <tbody>
                {devredenArizalar.length === 0 ? (
                  <tr className="bg-slate-950">
                    <td
                      colSpan={7}
                      className="p-2.5 text-center text-[10.5px] font-bold text-slate-500 uppercase tracking-wider border border-slate-800"
                    >
                      24:00 öncesinden devreden açık arıza bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  devredenArizalar.map((ariza) => (
                    <ArizaRow
                      key={ariza.id}
                      ariza={ariza}
                      isOld={true}
                      isNewArrival={false}
                      onSelect={(a) => setSelectedAriza(a)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ALT ÇUBUK: Minimal, köşeli */}
      <footer className="bg-slate-950 border-t border-slate-900 px-3 py-1 text-xs text-slate-400 flex items-center justify-between gap-2 rounded-none">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-white uppercase tracking-wider">
            AÇIK ARIZA: {totalOpen} (BUGÜN: {activeArizalar.length} • DEVREDEN: {devredenArizalar.length})
          </span>
          <span>•</span>
          <span className="text-emerald-400 font-semibold">KAPATILAN: {closedArizalar.length}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span className="w-2 h-2 rounded-none bg-emerald-400 animate-pulse inline-block" />
          <span>CANLI AKIŞ AKTİF {lastSyncTime ? `• SON EŞLEŞME: ${lastSyncTime}` : ''}</span>
        </div>
      </footer>

      {/* DETAY İNCELEME MODALI */}
      {selectedAriza && (
        <ArizaDetailModal
          ariza={selectedAriza}
          onClose={() => setSelectedAriza(null)}
        />
      )}
    </div>
  );
}
