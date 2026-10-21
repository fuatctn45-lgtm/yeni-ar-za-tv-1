import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Ariza } from '../types';
import { formatElapsedTime, formatTimeOnly, formatDateFull } from '../utils/date';
import { getJobTypeConfig } from '../utils/jobColors';
import { getActiveTechnicians, isFaultClosed, getArizaStatusInfo } from '../utils/technicians';

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

  const statusInfo = getArizaStatusInfo(ariza);
  const { statusText, isResolved, isUnderIntervention, isWaitingParts, isWaitingService, isHandedOver, isOpenWaiting } = statusInfo;

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

  // Durum Alanı Özel Dikkat Çekici Rozet Stili (Veritabanındaki gerçek duruma göre)
  let statusBadgeStyle = {
    container: 'bg-black text-rose-300 border-2 border-rose-500 shadow-sm',
    dot: 'bg-rose-500',
    ping: true,
  };

  if (isWaitingParts) {
    statusBadgeStyle = {
      container: 'bg-black text-amber-300 border-2 border-amber-400 shadow-sm ring-1 ring-amber-400/50',
      dot: 'bg-amber-400',
      ping: false,
    };
  } else if (isWaitingService) {
    statusBadgeStyle = {
      container: 'bg-black text-violet-300 border-2 border-violet-400 shadow-sm ring-1 ring-violet-400/50',
      dot: 'bg-violet-400',
      ping: false,
    };
  } else if (isUnderIntervention) {
    statusBadgeStyle = {
      container: 'bg-black text-cyan-300 border-2 border-cyan-400 shadow-sm ring-1 ring-cyan-400/50',
      dot: 'bg-cyan-400',
      ping: true,
    };
  } else if (isHandedOver) {
    statusBadgeStyle = {
      container: 'bg-black text-purple-200 border-2 border-purple-400 shadow-sm ring-1 ring-purple-400/50',
      dot: 'bg-purple-400',
      ping: false,
    };
  } else if (isResolved) {
    statusBadgeStyle = {
      container: 'bg-black text-emerald-300 border-2 border-emerald-400 shadow-sm ring-1 ring-emerald-400/50',
      dot: 'bg-emerald-400',
      ping: false,
    };
  } else if (!isOpenWaiting) {
    statusBadgeStyle = {
      container: 'bg-black text-sky-300 border-2 border-sky-400 shadow-sm ring-1 ring-sky-400/50',
      dot: 'bg-sky-400',
      ping: false,
    };
  }

  // Excel benzeri ızgara / hücre kenarlık çizgisi (Çizgili tablo yapısı)
  const cellBorder = isDark ? 'border-white/25' : 'border-black/25';

  return (
    <tr
      onClick={() => onSelect(ariza)}
      style={{ backgroundColor: jobConfig.hex }}
      className={`group cursor-pointer hover:brightness-95 active:brightness-90 transition-all select-none ${textColor} ${
        isNewArrival ? 'ring-2 ring-inset ring-red-600' : ''
      }`}
    >
      {/* 1. SÜTUN: DURUM (Excel hücre çizgili) */}
      <td className={`border ${cellBorder} px-2 py-0.5 whitespace-nowrap align-middle`}>
        <div className="flex items-center gap-1.5">
          {isNewArrival && (
            <span className="text-[9px] font-black uppercase mr-1 bg-red-600 text-white px-1.5 py-0.5 animate-pulse rounded-xs shadow-xs shrink-0 leading-none">
              YENİ
            </span>
          )}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs font-black text-[10px] sm:text-[11px] tracking-wide uppercase leading-tight ${statusBadgeStyle.container}`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {statusBadgeStyle.ping && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusBadgeStyle.dot}`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusBadgeStyle.dot}`} />
            </span>
            <span className="whitespace-nowrap">{statusText}</span>
          </div>
        </div>
      </td>

      {/* 2. SÜTUN: MAKİNE (Excel hücre çizgili, kalın ve 1 punto büyük, tam görünür) */}
      <td className={`border ${cellBorder} px-2.5 py-0.5 whitespace-nowrap align-middle`}>
        <span
          className="text-[12.5px] sm:text-[13px] font-black uppercase tracking-tight block whitespace-nowrap"
          title={ariza.machine}
        >
          {ariza.machine}
        </span>
      </td>

      {/* 3. SÜTUN: İŞ AÇIKLAMASI (Excel hücre çizgili, kalın ve 1 punto büyük, tam görünür) */}
      <td className={`border ${cellBorder} px-2.5 py-0.5 whitespace-nowrap align-middle`}>
        <span
          className={`text-[12.5px] sm:text-[13px] font-black tracking-tight block whitespace-nowrap ${mutedTextColor}`}
          title={ariza.description}
        >
          {ariza.description || 'Açıklama girilmedi'}
        </span>
      </td>

      {/* 4. SÜTUN: ARIZA TÜRÜ (Excel hücre çizgili, tam görünür) */}
      <td className={`border ${cellBorder} px-2.5 py-0.5 whitespace-nowrap align-middle`}>
        <span
          className="text-[11px] font-bold uppercase tracking-wider block whitespace-nowrap"
          title={ariza.jobType || jobConfig.name}
        >
          {ariza.jobType || jobConfig.name}
        </span>
      </td>

      {/* 5. SÜTUN: BAKIMCILAR (ANA / YRD) (Excel hücre çizgili) */}
      <td className={`border ${cellBorder} px-2.5 py-0.5 whitespace-nowrap align-middle text-[11px] font-bold`}>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {anaBakimci ? (
            <span className="uppercase whitespace-nowrap" title={`Ana Bakımcı: ${anaBakimci}`}>
              Ana: {anaBakimci}
            </span>
          ) : ariza.userName ? (
            <span className="whitespace-nowrap" title={`Bildiren: ${ariza.userName}`}>
              {ariza.userName}
            </span>
          ) : (
            <span className="opacity-60 font-normal">-</span>
          )}

          {helpersList.length > 0 && (
            <span
              className="uppercase opacity-90 whitespace-nowrap"
              title={`Yardımcı Bakımcı: ${helpersList.join(', ')}`}
            >
              (Yrd: {helpersList.join(', ')})
            </span>
          )}
        </div>
      </td>

      {/* 6. SÜTUN: SÜRE / SAAT (Excel hücre çizgili) */}
      <td className={`border ${cellBorder} px-2.5 py-0.5 whitespace-nowrap align-middle text-[11px] font-mono font-bold`}>
        <div
          className="flex items-center gap-1.5 whitespace-nowrap"
          title={`Kayıt: ${formatDateFull(ariza.createdAt)}`}
        >
          <span>{elapsed.text}</span>
          <span className={`text-[11px] font-sans border-l pl-1.5 hidden sm:inline ${dividerColor}`}>
            {timeOnly}
          </span>
        </div>
      </td>

      {/* 7. SÜTUN: İŞLEM / DETAY OKU */}
      <td className={`border ${cellBorder} px-1.5 py-0.5 text-center align-middle w-8 whitespace-nowrap`}>
        {!isOld && (
          <ChevronRight className={`w-3.5 h-3.5 mx-auto transition-transform group-hover:translate-x-0.5 opacity-70 group-hover:opacity-100 ${isDark ? 'text-white' : 'text-black'}`} />
        )}
      </td>
    </tr>
  );
};
