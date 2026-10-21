import React from 'react';
import {
  X,
  Wrench,
  Clock,
  User,
  Package,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Repeat,
  Zap,
  CalendarCheck,
  History,
  FileText,
  Camera,
  Settings,
  Flame,
  Check
} from 'lucide-react';
import { Ariza, Intervention } from '../types';
import { formatDateFull, formatElapsedTime } from '../utils/date';
import { getJobTypeConfig } from '../utils/jobColors';
import { getActiveTechnicians, isFaultClosed, getArizaStatusInfo } from '../utils/technicians';

interface ArizaDetailModalProps {
  ariza: Ariza | null;
  onClose: () => void;
}

export const ArizaDetailModal: React.FC<ArizaDetailModalProps> = ({
  ariza,
  onClose,
}) => {
  if (!ariza) return null;

  const jobConfig = getJobTypeConfig(ariza.jobType);
  const elapsed = formatElapsedTime(ariza.createdAt);

  const statusInfo = getArizaStatusInfo(ariza);
  const { isResolved, isUnderIntervention, isWaitingParts, isWaitingService, isHandedOver, statusText } = statusInfo;

  const isSafetyCritical = jobConfig.key === 'is_guvenligi';
  const isRecurring = jobConfig.key === 'tekrar_eden';

  // Aktif Ana Bakımcı ve Yardımcı Bakımcılar (Ayrılanlar dahil edilmez)
  const { anaBakimci, yardimciBakimcilar: helpersList } = getActiveTechnicians(ariza);

  const activeOperator = anaBakimci || ariza.userName || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-none w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between rounded-none">
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: jobConfig.hex, color: jobConfig.textColor }}
              className="w-10 h-10 rounded-none flex items-center justify-center font-black shadow-md"
            >
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg lg:text-xl font-black text-white">
                  {ariza.machine}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-none text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                    isWaitingParts
                      ? 'bg-amber-950 text-amber-300 border-amber-400'
                      : isWaitingService
                      ? 'bg-violet-950 text-violet-300 border-violet-400'
                      : isUnderIntervention
                      ? 'bg-sky-950 text-cyan-300 border-cyan-400'
                      : isHandedOver
                      ? 'bg-purple-950 text-purple-200 border-purple-400'
                      : isResolved
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                      : 'bg-rose-950 text-rose-300 border-rose-500'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isWaitingParts
                        ? 'bg-amber-400'
                        : isWaitingService
                        ? 'bg-violet-400'
                        : isUnderIntervention
                        ? 'bg-cyan-400 animate-ping'
                        : isHandedOver
                        ? 'bg-purple-400'
                        : isResolved
                        ? 'bg-emerald-400'
                        : 'bg-rose-400 animate-pulse'
                    }`}
                  />
                  {statusText}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {ariza.costCenter || 'Masraf Merkezi Belirtilmemiş'} • Kayıt: {formatDateFull(ariza.createdAt)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Read-only Andon inspection */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Arıza Durum Paneli */}
          {isResolved ? (
            <div className="p-4 rounded-none bg-emerald-950/80 border-2 border-emerald-500 text-emerald-200 space-y-2 shadow-lg">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 bg-emerald-400" />
                  <span className="font-black text-sm tracking-wide">
                    ✅ ARIZA KAPATILDI / TAMAMLANDI
                  </span>
                </div>
                {ariza.completedAt && (
                  <span className="text-xs font-mono text-emerald-300">
                    Kapanış: {formatDateFull(ariza.completedAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-emerald-800/80 text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">Kapatan Bakımcı:</span>
                  <span className="text-white font-extrabold uppercase">
                    {ariza.completedBy || anaBakimci || 'Yetkili'}
                  </span>
                </div>
              </div>
            </div>
          ) : isWaitingParts ? (
            <div className="p-4 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-amber-200 space-y-2 shadow-lg">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="font-black text-sm tracking-wide">
                    ⏳ PARÇA BEKLİYOR
                  </span>
                </div>
                {ariza.lastInterventionAt && (
                  <span className="text-xs font-mono text-amber-300">
                    Kayıt: {formatDateFull(ariza.lastInterventionAt)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-800/80 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">İlgilenen Bakımcı:</span>
                  <span className="text-white font-extrabold uppercase">{anaBakimci || 'Atanmadı'}</span>
                </div>
                {ariza.partsChanged && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-300 font-bold">Parça:</span>
                    <span className="text-white font-extrabold">{ariza.partsChanged}</span>
                  </div>
                )}
              </div>
            </div>
          ) : isUnderIntervention ? (
            <div className="p-4 rounded-xl bg-cyan-950/80 border-2 border-cyan-400 text-cyan-200 space-y-2 shadow-lg">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="font-black text-sm tracking-wide">
                    👤 MÜDAHALE EDİLİYOR
                  </span>
                </div>
                {ariza.startedAt && (
                  <span className="text-xs font-mono text-cyan-300">
                    Başlama: {formatDateFull(ariza.startedAt)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-cyan-800/80 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-400 font-bold">Ana Bakımcı:</span>
                  <span className="text-white font-extrabold uppercase">{anaBakimci || 'Atanmadı'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-300 font-bold">Yardımcı Bakımcı:</span>
                  <span className="text-white font-extrabold uppercase">
                    {helpersList.length > 0 ? helpersList.join(', ') : 'Yok'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-300">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Müdahale Durumu: <span className="text-white">{statusText}</span></span>
              </div>
              <div className="flex items-center gap-3">
                {anaBakimci && (
                  <span className="text-cyan-400 font-bold">Ana Bakımcı: {anaBakimci}</span>
                )}
                {helpersList.length > 0 && (
                  <span className="text-amber-300 font-bold">Yardımcı: {helpersList.join(', ')}</span>
                )}
              </div>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Arıza Tipi</div>
              <div className="mt-1">
                <span
                  style={{
                    backgroundColor: jobConfig.hex,
                    color: jobConfig.textColor,
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-black shadow-sm"
                >
                  {isSafetyCritical ? (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  ) : isRecurring ? (
                    <Repeat className="w-3.5 h-3.5" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{ariza.jobType}</span>
                </span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Bildiren Kişi</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                <span className="truncate">{ariza.userName || 'Bilinmiyor'}</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-cyan-400 font-semibold uppercase">Ana Bakımcı</div>
              <div className="text-sm font-bold text-cyan-300 mt-1 truncate uppercase">
                {anaBakimci || 'Atanmadı'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-amber-400 font-semibold uppercase">Yardımcı Bakımcı</div>
              <div className="text-sm font-bold text-amber-200 mt-1 truncate uppercase">
                {helpersList.length > 0 ? helpersList.join(', ') : 'Yok'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Vardiya</div>
              <div className="text-sm font-bold text-white mt-1 truncate">
                {ariza.shift || '1. Vardiya'}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Geçen Süre</div>
              <div className="text-sm font-bold text-cyan-400 font-mono mt-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>{elapsed.text}</span>
              </div>
            </div>
          </div>

          {/* Yardımcılar Bilgisi (Eğer varsa) */}
          {helpersList.length > 0 && (
            <div className="bg-slate-950/60 border border-amber-500/30 p-3 rounded-xl flex items-center gap-2 text-xs">
              <span className="text-base">🤝</span>
              <span className="font-bold text-amber-300">Yardımcı Bakımcılar:</span>
              <span className="font-extrabold text-white">{helpersList.join(', ')}</span>
            </div>
          )}

          {/* Description & Photo */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Arıza Açıklaması</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
              {ariza.description || 'Detaylı açıklama girilmemiş.'}
            </p>

            {ariza.photoUrl && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-2">
                  <Camera className="w-4 h-4 text-indigo-400" />
                  <span>Eklenen Arıza Fotoğrafı</span>
                </div>
                <img
                  src={ariza.photoUrl}
                  alt="Arıza fotoğrafı"
                  className="max-h-60 rounded-xl object-contain border border-slate-700 bg-black/40"
                />
              </div>
            )}
          </div>

          {/* Action Taken & Parts Changed (if logged) */}
          {(ariza.actionTaken || (ariza.partsChanged && ariza.partsChanged !== '-')) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ariza.actionTaken && (
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Yapılan İşlem</div>
                  <p className="text-xs text-emerald-300 font-semibold mt-1">
                    {ariza.actionTaken}
                  </p>
                </div>
              )}
              {ariza.partsChanged && ariza.partsChanged !== '-' && (
                <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">Değişen Parça / Sarf</div>
                  <p className="text-xs text-amber-300 font-semibold mt-1">
                    {ariza.partsChanged}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Intervention Logs History Timeline (Purely Read-only) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Müdahale Geçmişi ve Operatör Logları ({ariza.interventions?.length || 0})</span>
              </h3>
            </div>

            {ariza.interventions && ariza.interventions.length > 0 ? (
              <div className="space-y-2 border-l-2 border-slate-800 pl-4 ml-2">
                {ariza.interventions.map((inv: Intervention, idx: number) => (
                  <div
                    key={`inv-${inv.timestamp || inv.operator || idx}-${idx}`}
                    className="relative bg-slate-950/50 border border-slate-800 p-3 rounded-xl text-xs space-y-1"
                  >
                    <div className="absolute -left-[23px] top-3.5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-900" />
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-bold text-white text-sm">
                        {inv.operator} ({inv.role || 'Teknisyen'})
                      </span>
                      <span className="font-mono text-[11px]">
                        {inv.timestamp ? formatDateFull(inv.timestamp) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {inv.logAction || inv.status}
                      </span>
                      {inv.durationMin !== undefined && inv.durationMin > 0 && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          Süre: {inv.durationMin} dk
                        </span>
                      )}
                    </div>
                    {inv.actionTaken && (
                      <p className="text-slate-300 mt-1 italic">
                        &quot;{inv.actionTaken}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                Henüz kayıtlı bir müdahale adımı bulunmuyor.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Andon İzleme Ekranı • Veri Girişi Kapalıdır</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
