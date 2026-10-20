import React, { useState, useEffect } from 'react';
import {
  Clock,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  Flame,
  Wrench,
  AlertTriangle,
  Package,
  Layers,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';
import { getCurrentShift } from '../utils/date';
import { soundFx } from '../utils/audio';
import { faultAnnouncer } from '../utils/announcer';

interface TvHeaderProps {
  totalOpen: number;
  activeInterventionsCount: number;
  todayCount: number;
  pendingPreviousDaysCount: number;
  waitingPartsCount: number;
  isOnline: boolean;
  referenceDateLabel?: string;
  lastSyncTime?: string;
  onRefresh?: () => void;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
}

export const TvHeader: React.FC<TvHeaderProps> = ({
  totalOpen,
  activeInterventionsCount,
  todayCount,
  pendingPreviousDaysCount,
  waitingPartsCount,
  isOnline,
  lastSyncTime,
  onRefresh,
  autoScroll,
  onToggleAutoScroll,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDateStr(
        now.toLocaleDateString('tr-TR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.enabled = next;
    if (next) {
      soundFx.playChime();
    } else {
      faultAnnouncer.cancel();
    }
  };

  const currentShift = getCurrentShift();

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-white px-3 sm:px-4 py-1.5 sticky top-0 z-40 select-none shadow-md">
      <div className="flex items-center justify-between gap-2">
        {/* Sol: Saat + Vardiya + Canlı Durum (Sadece temel göstergeler, gereksiz metin yok) */}
        <div className="flex items-center gap-2">
          {/* Dijital Saat (Köşeli) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-none font-mono">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-sm font-black text-cyan-300 tracking-wider">
              {timeStr || '00:00:00'}
            </span>
            <span className="text-[11px] text-slate-400 font-sans capitalize pl-1 border-l border-slate-800 hidden sm:inline">
              {dateStr}
            </span>
          </div>

          {/* Vardiya (Köşeli) */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-none text-xs text-amber-300 font-bold">
            <Layers className="w-3 h-3" />
            <span>{currentShift}</span>
          </div>

          {/* Canlı Bağlantı Rozeti (Köşeli) */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-black border ${
            isOnline
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50'
              : 'bg-red-950/80 text-red-400 border-red-500/50'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-none ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
            <span>{isOnline ? 'CANLI' : 'KOPUK'}</span>
          </span>
        </div>

        {/* Orta: Kompakt Sayaçlar (Köşeli ve direkt rakamlar) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Açık */}
          <div className="bg-slate-900 border border-slate-800 rounded-none px-2 py-0.5 flex items-center gap-1.5 text-xs">
            <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="font-bold text-slate-400 text-[10px]">AÇIK:</span>
            <span className="font-black text-white font-mono">{totalOpen}</span>
          </div>

          {/* Müdahalede */}
          <div className="bg-slate-900 border border-cyan-700/60 rounded-none px-2 py-0.5 flex items-center gap-1.5 text-xs">
            <Wrench className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-bold text-cyan-300 text-[10px]">MÜDAHALE:</span>
            <span className="font-black text-cyan-300 font-mono">{activeInterventionsCount}</span>
          </div>

          {/* Bugün */}
          <div className="bg-slate-900 border border-emerald-700/60 rounded-none px-2 py-0.5 flex items-center gap-1.5 text-xs">
            <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold text-emerald-300 text-[10px]">BUGÜN:</span>
            <span className="font-black text-emerald-300 font-mono">{todayCount}</span>
          </div>

          {/* Devreden */}
          {pendingPreviousDaysCount > 0 && (
            <div className="hidden sm:flex bg-slate-900 border border-amber-700/60 rounded-none px-2 py-0.5 items-center gap-1.5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-amber-300 text-[10px]">DEVREDEN:</span>
              <span className="font-black text-amber-300 font-mono">{pendingPreviousDaysCount}</span>
            </div>
          )}

          {/* Parça */}
          {waitingPartsCount > 0 && (
            <div className="hidden md:flex bg-slate-900 border border-purple-700/60 rounded-none px-2 py-0.5 items-center gap-1.5 text-xs">
              <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="font-bold text-purple-300 text-[10px]">PARÇA:</span>
              <span className="font-black text-purple-300 font-mono">{waitingPartsCount}</span>
            </div>
          )}
        </div>

        {/* Sağ: Kontrol Butonları (Köşeli) */}
        <div className="flex items-center gap-1 shrink-0">
          {onToggleAutoScroll && (
            <button
              onClick={onToggleAutoScroll}
              className={`flex items-center gap-1 px-2 py-1 rounded-none border text-xs font-bold transition-all ${
                autoScroll
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="TV Otomatik Kaydırma"
            >
              {autoScroll ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3" />}
              <span className="hidden lg:inline text-[10px]">KAYDIRMA</span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-none transition-colors"
              title="Yenile"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleSound}
            className={`p-1.5 rounded-none border transition-colors ${
              soundEnabled
                ? 'bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800'
                : 'bg-slate-900 border-slate-800 text-slate-600 hover:bg-slate-800'
            }`}
            title={soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-none transition-colors"
            title="Tam Ekran"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
