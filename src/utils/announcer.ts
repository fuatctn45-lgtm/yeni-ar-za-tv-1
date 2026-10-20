import { Ariza } from '../types';
import { soundFx } from './audio';

export interface AnnouncerStatus {
  isPlaying: boolean;
  currentRepeat: number;
  totalRepeats: number;
  ariza: Ariza | null;
}

type StatusCallback = (status: AnnouncerStatus) => void;

class FaultAnnouncer {
  private active = false;
  private currentTimeout: any = null;
  private keepAliveInterval: any = null;
  private safetyTimer: any = null;
  private currentRepeat = 0;
  private totalRepeats = 5;
  private currentAriza: Ariza | null = null;
  private listeners: Set<StatusCallback> = new Set();
  // Chrome Garbage Collector'ın konuşmayı yarıda kesmesini engellemek için referans saklanır
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          this.cachedVoices = window.speechSynthesis.getVoices() || [];
        } catch {
          this.cachedVoices = [];
        }
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  public subscribe(cb: StatusCallback) {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const s = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(s);
      } catch (err) {
        console.error('Announcer listener error:', err);
      }
    });
  }

  public getStatus(): AnnouncerStatus {
    return {
      isPlaying: this.active,
      currentRepeat: this.currentRepeat,
      totalRepeats: this.totalRepeats,
      ariza: this.currentAriza,
    };
  }

  private stopInternal() {
    this.active = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.activeUtterance = null;
    this.currentRepeat = 0;
    this.currentAriza = null;
  }

  public cancel() {
    this.stopInternal();
    this.notify();
  }

  public announceFault(ariza: Ariza, repeats = 5) {
    // Ses kapalıysa anons yapma
    if (!soundFx.enabled) return;

    // Önceki anonsu içten durdur ve yeni anonsu başlat
    this.stopInternal();

    this.active = true;
    this.currentAriza = ariza;
    this.totalRepeats = repeats;
    this.currentRepeat = 0;
    this.notify();

    const runCycle = async (repeatIndex: number) => {
      if (!this.active || !soundFx.enabled) {
        this.cancel();
        return;
      }

      if (repeatIndex > this.totalRepeats) {
        this.cancel();
        return;
      }

      this.currentRepeat = repeatIndex;
      this.notify();

      // 1. Önce uyarı sesi (2 tonlu dikkat zili)
      await soundFx.playNewFaultAlarm();

      if (!this.active || !soundFx.enabled) {
        this.cancel();
        return;
      }

      // 2. Ardından tüm metni (Makine adı, Arıza türü, Açıklama) eksiksiz sesli oku
      await this.speakAriza(ariza);

      if (!this.active || !soundFx.enabled) {
        this.cancel();
        return;
      }

      // 5 tekrar tamamlandıysa anonsu bitir
      if (repeatIndex >= this.totalRepeats) {
        this.cancel();
        return;
      }

      // 3. Tekrarlar arası 1.2 saniye bekle ve bir sonraki döngüyü çalıştır
      this.currentTimeout = setTimeout(() => {
        runCycle(repeatIndex + 1);
      }, 1200);
    };

    // İlk döngüyü başlat
    runCycle(1);
  }

  /**
   * Metni konuşma sentezleyici için doğal Türkçe okunuşa uygun hale getirir.
   * Parantez gibi sembollerin "parantez aç/kapa" diye okunmasını engeller.
   */
  private sanitizeSpeechText(str: string): string {
    if (!str) return '';
    return str
      .replace(/[()]/g, ' ') // ( CAB ) -> CAB
      .replace(/[_]/g, ' ')
      .replace(/[:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private speakAriza(ariza: Ariza): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || !soundFx.enabled) {
        setTimeout(resolve, 1000);
        return;
      }

      const synth = window.speechSynthesis;

      // Chrome askıya almışsa uyandır
      if (synth.paused) {
        try {
          synth.resume();
        } catch {
          // ignore
        }
      }

      synth.cancel(); // Önceki takılı konuşmaları temizle

      // Makine Adı
      const rawMachine =
        ariza.machine ||
        (ariza as any).makine ||
        (ariza as any).makineAdi ||
        (ariza as any).machineName ||
        'Bilinmeyen Makine';
      const machineText = this.sanitizeSpeechText(rawMachine);

      // Arıza Türü
      const rawJobType =
        ariza.jobType ||
        (ariza as any).arizaTuru ||
        (ariza as any).isTuru ||
        (ariza as any).is_turu ||
        (ariza as any).type ||
        'Mekanik Arıza';
      const jobTypeText = this.sanitizeSpeechText(rawJobType);

      // Açıklama
      const rawDesc =
        ariza.description ||
        (ariza as any).aciklama ||
        (ariza as any).arizaAciklamasi ||
        (ariza as any).aciklamasi ||
        (ariza as any).detail ||
        (ariza as any).sorun ||
        (ariza as any).not ||
        'Belirtilmedi';
      const descText = this.sanitizeSpeechText(rawDesc);

      // Kullanıcının talep ettiği tam anons cümlesi:
      // "Dikkat, dikkat! Yeni iş istekleri bildirimi geldi. Makine adı: [Makine Adı]. Arıza türü: [Ariza Türü]. Açıklama: [Açıklama]."
      const fullText = `Dikkat, dikkat! Yeni iş istekleri bildirimi geldi. Makine adı: ${machineText}. Arıza türü: ${jobTypeText}. Açıklama: ${descText}.`;

      const utterance = new SpeechSynthesisUtterance(fullText);
      this.activeUtterance = utterance; // GC koruması

      utterance.lang = 'tr-TR';
      utterance.rate = 1.0; // Fabrika ortamında akıcı ve net hız
      utterance.pitch = 1.0;

      // Türkçe ses motoru seçimi
      try {
        const voices = this.cachedVoices.length > 0 ? this.cachedVoices : synth.getVoices();
        const trVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('tr') ||
            v.lang.toLowerCase().includes('turkish') ||
            v.name.toLowerCase().includes('turkish') ||
            v.name.toLowerCase().includes('türkçe')
        );
        if (trVoice) {
          utterance.voice = trVoice;
        }
      } catch {
        // Voice selection fallback
      }

      let hasFinished = false;
      const finish = () => {
        if (!hasFinished) {
          hasFinished = true;
          if (this.safetyTimer) {
            clearTimeout(this.safetyTimer);
            this.safetyTimer = null;
          }
          if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
          }
          this.activeUtterance = null;
          resolve();
        }
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      // Chrome'un 15 saniyeden uzun konuşmalarda sessizce duraklama hatasına karşı Keep-Alive
      this.keepAliveInterval = setInterval(() => {
        if (synth.speaking && !synth.paused) {
          try {
            synth.pause();
            synth.resume();
          } catch {
            // ignore
          }
        }
      }, 7000);

      // Emniyet zamanlayıcısı: Metin uzunluğuna göre cömert süre tanı (Asla erken kesilmez!)
      // En az 35 saniye veya metin karakteri * 120ms
      const maxTimeoutMs = Math.max(35000, fullText.length * 120);
      this.safetyTimer = setTimeout(finish, maxTimeoutMs);

      try {
        synth.speak(utterance);
      } catch {
        finish();
      }
    });
  }
}

export const faultAnnouncer = new FaultAnnouncer();
