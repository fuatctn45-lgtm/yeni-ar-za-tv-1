import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Ariza } from '../types';
import { formatElapsedTime, formatTimeOnly, formatDateFull } from '../utils/date';
import { getJobTypeConfig } from '../utils/jobColors';
import { getActiveTechnicians, isFaultClosed } from '../utils/technicians';

interface ArizaRowProps {
  ariza: Ariza;
  isOld?: boolean;
  isNewArrival?: boolean;
  onSelect: (ariza: Ariza) => void;
}

export const ArizaRow: React.FC<ArizaRowProps> = ({
  ariza,
  isOld = false,
  isNewArrival = false,
  onSelect,
}) => {
  const jobConfig = getJobTypeConfig(ariza.jobType);
  const isDark = Boolean(jobConfig.isDarkBg);

  const statusLower = (ariza.status || '').toLowerCase();
  const isResolved = isFaultClosed(ariza);

  const isUnderIntervention = !isResolved && (
    statusLower.includes('müdahale') ||
    statusLower.includes('mudahale') ||
    statusLower.includes('işlem') ||
    statusLower.includes('islem') ||
    Boolean(ariza.startedBy)
  );

  const isWaitingParts = !isResolved && ariza.status === 'Parça Bekliyor';
  const isHandedOver = !isResolved && ariza.status === 'Devredildi';

  // Durum metni (Kutucuksuz, düz ve net metin)
  const statusText = isResolved
    ? 'KAPANDI'
    : isUnderIntervention
    ? 'MÜDAHALE'
    : isWaitingParts
    ? 'PARÇA BEKLİYOR'
    : isHandedOver
    ? 'DEVREDİLDİ'
    : 'BEKLİYOR';

  // Aktif Ana Bakımcı ve Yardımcı Bakımcılar (Ayrılanlar kesinlikle yer almaz)
  const { anaBakimci, yardimciBakimcilar: helpersList } = getActiveTechnicians(ariza);

  // 3. Arıza Logu / Son Yapılan İşlem
  const lastIntervention =
    Array.isArray(ariza.interventions) && ariza.interventions.length > 0
      ? ariza.interventions[ariza.interventions.length - 1]
      : null;

  const arizaLogText =
    lastIntervention?.actionTaken ||
    lastIntervention?.logAction ||
    ariza.arizaLog ||
    ariza.actionTaken ||
    '';

  const elapsed = formatElapsedTime(ariza.createdAt);
  const timeOnly = formatTimeOnly(ariza.createdAt);

  // YAZILARDA SİYAH KUTUCUK VEYA ARKA PLAN YOK
  // Metin rengi doğrudan satır arka planına oturur:
  // Koyu zeminde (Kırmızı) BEYAZ, Açık zeminlerde (Sarı, Camgöbeği, Turuncu, Pembe) NET SİYAH.
  const textColor = isDark ? 'text-white' : 'text-black';
  const mutedTextColor = isDark ? 'text-white/90' : 'text-slate-950';
  const dividerColor = isDark ? 'text-white/35' : 'text-black/35';

  return (
    <div
      onClick={() => onSelect(ariza)}
      style={{ backgroundColor: jobConfig.hex }}
      className={`group w-full ${
        isOld ? 'h-7 sm:h-7.5' : 'h-8 sm:h-8.5'
      } rounded-none border-b border-black/40 hover:brightness-95 active:brightness-90 transition-all duration-100 cursor-pointer px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2 select-none relative whitespace-nowrap overflow-hidden text-[11px] font-bold ${textColor} ${
        isNewArrival ? 'ring-2 ring-inset ring-red-600' : ''
      }`}
    >
      {/* Sol Kısım: Durum + Makine İsmi + Ayırıcı + Açıklama + Varsa Log Özeti */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
        {/* Durum Metni (Siyah kutu yok, logo yok, doğrudan düz yazı - yanıp sönme yok) */}
        <div className="shrink-0 flex items-center w-20 sm:w-24">
          {isNewArrival && (
            <span className="text-[11px] font-black uppercase mr-1">
              [YENİ]
            </span>
          )}
          <span className="text-[11px] font-bold uppercase tracking-wider truncate">
            {statusText}
          </span>
        </div>

        {/* Ayırıcı */}
        <span className={`text-[11px] font-bold shrink-0 select-none ${dividerColor}`}>
          |
        </span>

        {/* MAKİNE İSMİ (Siyah kutu yok, doğrudan düz yazı) */}
        <span
          className="text-[11px] font-bold uppercase tracking-tight shrink-0 truncate w-36 sm:w-48 lg:w-56"
          title={ariza.machine}
        >
          {ariza.machine}
        </span>

        {/* Ayırıcı */}
        <span className={`text-[11px] font-bold shrink-0 select-none ${dividerColor}`}>
          |
        </span>

        {/* ARIZA AÇIKLAMASI (Siyah kutu yok, doğrudan düz yazı) */}
        <span
          className={`text-[11px] font-bold truncate min-w-0 flex-1 ${mutedTextColor}`}
          title={ariza.description}
        >
          {ariza.description || 'Açıklama girilmedi'}
        </span>
      </div>

      {/* Sağ Kısım: Arıza Türü + Ana Bakımcı + Yardımcı Bakımcı + Log + Geçen Süre */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 overflow-hidden text-[11px] font-bold">
        {/* Arıza Türü (Siyah kutucuk yok, logo yok) */}
        <span className="text-[11px] font-bold uppercase tracking-wider shrink-0 hidden md:inline">
          {ariza.jobType || jobConfig.name}
        </span>

        {/* Ana Bakımcı (Siyah kutucuk yok, logo yok) */}
        {anaBakimci ? (
          <span
            className="hidden sm:inline text-[11px] font-bold uppercase truncate max-w-[110px] lg:max-w-[140px]"
            title={`Ana Bakımcı: ${anaBakimci}`}
          >
            Ana: {anaBakimci}
          </span>
        ) : ariza.userName ? (
          <span className="hidden sm:inline text-[11px] font-bold truncate max-w-[90px]" title={`Bildiren: ${ariza.userName}`}>
            {ariza.userName}
          </span>
        ) : null}

        {/* Yardımcı Bakımcı (Siyah kutucuk yok, logo yok) */}
        {helpersList.length > 0 && (
          <span
            className="hidden md:inline text-[11px] font-bold uppercase truncate max-w-[110px] lg:max-w-[140px] opacity-90"
            title={`Yardımcı Bakımcı: ${helpersList.join(', ')}`}
          >
            Yrd: {helpersList.join(', ')}
          </span>
        )}

        {/* Süre ve Saat Sayacı (Siyah kutucuk yok, saat logosu yok) */}
        <div
          className="flex items-center gap-1 text-[11px] font-mono font-bold shrink-0 text-right w-24 sm:w-28 justify-end"
          title={`Kayıt: ${formatDateFull(ariza.createdAt)}`}
        >
          <span>{elapsed.text}</span>
          <span className={`text-[11px] font-sans border-l pl-1 hidden sm:inline ${dividerColor}`}>
            {timeOnly}
          </span>
        </div>

        {/* Sadece aktif arızalarda inceleme oku; eski arızalarda hiçbir logo/ok yok */}
        {!isOld && (
          <ChevronRight className={`w-3 h-3 transition-all shrink-0 ${isDark ? 'text-white/80' : 'text-black/60'}`} />
        )}
      </div>
    </div>
  );
};
