import React from 'react';
import {
  Wrench,
  Zap,
  ShieldAlert,
  Repeat,
  Clock,
  User,
  Package,
  CheckCircle2,
  Flame,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { Ariza } from '../types';
import { formatElapsedTime, formatDateFull } from '../utils/date';
import { getJobTypeConfig } from '../utils/jobColors';
import { getArizaStatusInfo } from '../utils/technicians';

interface ArizaCardProps {
  ariza: Ariza;
  isPromotedFromOld?: boolean;
  onSelect: (ariza: Ariza) => void;
}

export const ArizaCard: React.FC<ArizaCardProps> = ({
  ariza,
  isPromotedFromOld,
  onSelect,
}) => {
  const jobConfig = getJobTypeConfig(ariza.jobType);

  const isSafetyCritical = jobConfig.key === 'is_guvenligi';
  const isRecurring = jobConfig.key === 'tekrar_eden';

  // Active status check
  const statusInfo = getArizaStatusInfo(ariza);
  const { isResolved, isUnderIntervention, isWaitingParts, isWaitingService, isHandedOver, statusText } = statusInfo;
  const activeOperator = ariza.startedBy || ariza.assignedTo || ariza.lastInterventionBy || '';

  // Extract helpers reliably from both ariza.helpers array and interventions history
  const helpersSet = new Set<string>();
  if (Array.isArray(ariza.helpers)) {
    ariza.helpers.forEach((h) => {
      if (typeof h === 'string' && h.trim()) helpersSet.add(h.trim());
    });
  }
  if (Array.isArray(ariza.interventions)) {
    ariza.interventions.forEach((inv) => {
      if (
        (inv.status === 'Yardımcı' || inv.role === 'Yardımcı' || inv.actionTaken?.includes('Yardım') || inv.logAction?.includes('YARDIM')) &&
        inv.operator
      ) {
        helpersSet.add(inv.operator.trim());
      }
      if (Array.isArray(inv.helpers)) {
        inv.helpers.forEach((h) => {
          if (typeof h === 'string' && h.trim()) helpersSet.add(h.trim());
        });
      }
    });
  }
  const helpersList = Array.from(helpersSet);
  const elapsed = formatElapsedTime(ariza.createdAt);

  return (
    <div
      onClick={() => onSelect(ariza)}
      style={{
        backgroundColor: jobConfig.hex,
        borderColor: jobConfig.borderColor,
      }}
      className={`group relative rounded-xl border-2 p-2.5 sm:p-3 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-1.5 hover:shadow-lg text-slate-950 select-none ${
        isUnderIntervention
          ? 'ring-2 ring-cyan-500 shadow-md shadow-cyan-950/30'
          : 'shadow-sm'
      }`}
    >
      {/* Top Banner if promoted from previous days */}
      {isPromotedFromOld && (
        <div className="absolute -top-2.5 left-2.5 bg-slate-950 text-white text-[9px] uppercase font-black px-2 py-0.5 rounded-full shadow border border-cyan-400 z-10 flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 text-amber-300 fill-amber-300 animate-pulse" />
          <span className="tracking-wide">Eski Arıza • Müdahalede</span>
        </div>
      )}

      <div className="space-y-1.5">
        {/* ROW 1: Machine Name + Creation Time/Date (Side-by-side) */}
        <div className="flex items-center justify-between gap-1.5 border-b border-black/15 pb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Settings className="w-4 h-4 text-slate-900 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-slate-950 tracking-tight truncate group-hover:underline">
              {ariza.machine}
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-800 shrink-0">
            {formatDateFull(ariza.createdAt)}
          </span>
        </div>

        {/* ROW 2: Arıza Türü + Vardiya + Masraf Merkezi (Side-by-side) */}
        <div className="flex items-center flex-wrap gap-1 text-[10px]">
          {/* Job Type Badge */}
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 text-white font-black text-[10px] shadow-xs shrink-0">
            {isSafetyCritical ? (
              <ShieldAlert className="w-3 h-3 text-red-400" />
            ) : isRecurring ? (
              <Repeat className="w-3 h-3 text-fuchsia-400" />
            ) : (
              <Wrench className="w-3 h-3 text-cyan-400" />
            )}
            <span className="truncate max-w-[120px]">{ariza.jobType}</span>
          </span>

          {/* Shift */}
          {ariza.shift && (
            <span className="bg-black/10 px-1.5 py-0.5 rounded font-mono font-bold text-slate-900 shrink-0">
              Vard: {ariza.shift}
            </span>
          )}

          {/* Cost Center */}
          {ariza.costCenter && (
            <span className="font-mono text-slate-800 truncate text-[10px]">
              <span className="font-semibold text-slate-700">M:</span> {ariza.costCenter}
            </span>
          )}
        </div>

        {/* ROW 3: Bildiren & Görevli Bakımcı (Side-by-side!) */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] font-bold text-slate-950 pt-0.5">
          {/* Bildiren */}
          <div className="flex items-center gap-1 min-w-0 flex-1 truncate" title={`Bildiren: ${ariza.userName || 'Bilinmiyor'}`}>
            <User className="w-3 h-3 text-slate-700 shrink-0" />
            <span className="text-slate-700 font-semibold text-[10px]">Bildiren:</span>
            <span className="font-extrabold truncate text-slate-950 text-[10.5px]">
              {ariza.userName || '—'}
            </span>
          </div>

          {/* Görevli */}
          <div className="flex items-center gap-1 shrink-0" title={`Görevli: ${activeOperator || 'Atanmadı'}`}>
            <Wrench className="w-3 h-3 text-slate-800 shrink-0" />
            <span className="text-slate-700 font-semibold text-[10px]">Görevli:</span>
            {activeOperator ? (
              <span className="font-black text-slate-950 bg-black/15 px-1.5 py-0.5 rounded text-[10.5px] underline decoration-emerald-600 truncate max-w-[110px]">
                {activeOperator}
              </span>
            ) : (
              <span className="text-slate-600 italic text-[10px]">Yok</span>
            )}
          </div>
        </div>

        {/* ROW 4: Yardımcılar (varsa kompakt tek satır) */}
        {helpersList.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-950 truncate" title={`Yardımcılar: ${helpersList.join(', ')}`}>
            <span className="shrink-0 text-xs">🤝</span>
            <span className="text-slate-700 font-semibold shrink-0">Yardımcı:</span>
            <span className="font-extrabold truncate text-slate-950">
              {helpersList.join(', ')}
            </span>
          </div>
        )}

        {/* ROW 5: Açıklama (Kompakt 1-2 satır) */}
        <div className="bg-white/60 px-2 py-1 rounded-md border border-black/10 text-[11px] text-slate-950 leading-tight">
          <span className="font-bold text-slate-800 text-[10px]">Açıklama: </span>
          <span className="font-medium line-clamp-1 group-hover:line-clamp-2 transition-all">
            {ariza.description || 'Açıklama belirtilmemiş.'}
          </span>
        </div>
      </div>

      {/* ROW 6: Status & Elapsed Time (Alt Barda Yan Yana!) */}
      <div className="pt-1 mt-0.5 border-t border-black/10">
        {isUnderIntervention ? (
          <div className="p-1 px-2 rounded-lg bg-slate-950 text-cyan-300 font-black text-[10px] flex items-center justify-between border border-cyan-400 shadow-sm animate-pulse">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-ping" />
              <span className="tracking-wide truncate">
                MÜDAHALE EDİLİYOR ({activeOperator || 'Teknisyen'})
              </span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-cyan-200 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        ) : isWaitingParts ? (
          <div className="p-1 px-2 rounded-lg bg-amber-950 text-amber-200 font-black text-[10px] flex items-center justify-between border border-amber-500 shadow-sm">
            <div className="flex items-center gap-1 truncate">
              <Package className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">PARÇA BEKLİYOR</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-amber-300 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        ) : isWaitingService ? (
          <div className="p-1 px-2 rounded-lg bg-violet-950 text-violet-200 font-black text-[10px] flex items-center justify-between border border-violet-500 shadow-sm">
            <div className="flex items-center gap-1 truncate">
              <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
              <span className="truncate">DIŞ SERVİS BEKLİYOR</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-violet-300 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        ) : isHandedOver ? (
          <div className="p-1 px-2 rounded-lg bg-blue-950 text-blue-200 font-black text-[10px] flex items-center justify-between border border-blue-500 shadow-sm">
            <div className="flex items-center gap-1 truncate">
              <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="truncate">VARDİYAYA DEVREDİLDİ</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-blue-300 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        ) : isResolved ? (
          <div className="p-1 px-2 rounded-lg bg-emerald-950 text-emerald-200 font-black text-[10px] flex items-center justify-between border border-emerald-500 shadow-sm">
            <div className="flex items-center gap-1 truncate">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">ÇÖZÜLDÜ</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-emerald-300 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        ) : (
          <div className="p-1 px-2 rounded-lg bg-black/10 border border-black/15 flex items-center justify-between text-[10px] text-slate-900 font-bold">
            <div className="flex items-center gap-1 text-rose-800 font-black truncate">
              <Flame className="w-3 h-3 text-rose-700 animate-pulse shrink-0" />
              <span className="truncate">BEKLİYOR</span>
            </div>
            <span className="shrink-0 font-mono text-[9.5px] text-slate-800 ml-1">
              ⏱ {elapsed.text}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
