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
import { getJobTypeConfig } from './utils/jobColors';
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
        setIsOnline(false);
      }
    );

    const unsubConfig = subscribeToConfig((cfg) => {
      setConfig(cfg);
    });

    fetchPlantSettings().then((ps) => {
      setPlantSettings(ps);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubArizalar();
      unsubConfig();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

    return { activeArizalar: active, devredenArizalar: devreden, closedArizalar: closed };
  }, [arizalar, effectiveDate]);

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

      {/* TABLO SÜTUN BAŞLIKLARI (Köşeli, Kompakt, Hizalı) */}
      <div className="bg-slate-900 border-b border-black text-[11px] font-bold uppercase text-slate-300 px-2 sm:px-3 py-1 flex items-center justify-between gap-1.5 sm:gap-2 rounded-none shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 text-[11px] font-bold text-slate-400 truncate">
          <span className="w-28 sm:w-32 shrink-0 text-slate-400">DURUM</span>
          <span>|</span>
          <span className="w-36 sm:w-48 lg:w-56 shrink-0 truncate text-slate-300">MAKİNE</span>
          <span>|</span>
          <span className="truncate text-slate-400">ARIZA AÇIKLAMASI</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-right text-[11px] font-bold text-slate-400 uppercase">
          <span className="hidden md:inline">ARIZA TÜRÜ</span>
          <span className="hidden sm:inline">BAKIMCILAR (ANA / YRD)</span>
          <span className="w-24 text-right">SÜRE / SAAT</span>
        </div>
      </div>

      {/* ANA SATIR LİSTESİ: KAPATILAN ARIZALAR EKRANDA GÖSTERİLMEZ (SADECE AÇIKLAR LİSTELENİR) */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-slate-950 flex flex-col scroll-smooth"
      >
        {/* 1. AKTİF / BUGÜNÜN AÇIK ARIZALARI BÖLÜMÜ (EN ÜSTTE) */}
        <div className="w-full">
          {activeArizalar.length === 0 ? (
            <div className="p-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950">
              Şu an bugüne ait bekleyen veya işlem gören açık arıza kaydı bulunmuyor.
            </div>
          ) : (
            <div className="flex flex-col w-full divide-y-0">
              {activeArizalar.map((ariza) => (
                <ArizaRow
                  key={ariza.id}
                  ariza={ariza}
                  isOld={false}
                  isNewArrival={sessionNewArrivalIds.has(ariza.id)}
                  onSelect={(a) => setSelectedAriza(a)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 2. DEVREDEN AÇIK ARIZALAR BÖLÜMÜ (ALTA ÇEKİLDİ - 24:00 Öncesinden Devredenler) */}
        <div className="mt-auto pt-4 border-t-2 border-slate-800 w-full">
          <div className="bg-slate-900 border-y-2 border-amber-500/50 text-[11px] font-bold uppercase text-amber-400 px-2.5 sm:px-3 py-1 flex items-center justify-between tracking-wider shadow-xs">
            <div className="flex items-center gap-2">
              <span>DEVREDEN ARIZALAR (24:00 ÖNCESİNDEN DEVREDENLER • {devredenArizalar.length} KAYIT)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              DEVREDEN (ALTA ÇEKİLDİ)
            </span>
          </div>

          {devredenArizalar.length === 0 ? (
            <div className="p-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950">
              24:00 öncesinden devreden açık arıza bulunmuyor.
            </div>
          ) : (
            <div className="flex flex-col w-full divide-y-0">
              {devredenArizalar.map((ariza) => (
                <ArizaRow
                  key={ariza.id}
                  ariza={ariza}
                  isOld={true}
                  isNewArrival={false}
                  onSelect={(a) => setSelectedAriza(a)}
                />
              ))}
            </div>
          )}
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
          <span>CANLI AKIŞ AKTİF</span>
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
