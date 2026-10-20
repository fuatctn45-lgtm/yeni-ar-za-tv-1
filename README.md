# Fabrika Arıza ve Bakım Takip TV Paneli (Android TV & Web)

Android TV, fabrika içi bilgi panoları ve tabletler için tasarlanmış canlı arıza ve bakım kontrol merkezi.

Mevcut Firebase (`arizabildirim-89dfa`) Firestore veritabanına doğrudan bağlanır ve gerçek zamanlı (`onSnapshot`) olarak verileri senkronize eder.

## Temel Özellikler

1. **İki Kademeli Akıllı Görünüm:**
   - **Günlük Gelen Arızalar (Kart Görünümü):** Bugün bildirilen veya aktif müdahale edilen arızalar geniş, yüksek kontrastlı kartlar olarak sunulur.
   - **Ertesi Güne Kalan / Devreden Arızalar (Satır Görünümü):** Dünden veya önceki günlerden kalan, parça bekleyen ya da devredilen arızalar kompakt, okunabilir satırlar halinde listelenir.
   - **Otomatik Terfi (Promote) Mantığı:** Operatör eski bir arızaya müdahale başlattığında, bu arıza otomatik olarak satırlar arasından çıkarılıp **Günlük Kartların yanına** taşınır ve üzerinde *⚡ Eski Arıza • Şu An Müdahale Ediliyor* rozeti parlar.

2. **Android TV & Büyük Ekran Uyumluluğu:**
   - 10-foot UI: Fabrika sahasından veya uzaktan rahatça okunabilen büyük tipografi ve neon durum LED'leri.
   - **Tam Ekran (F11):** Tek tıkla tam ekran TV moduna geçiş.
   - **TV Otomatik Kaydırma:** Kumanda gerektirmeden ekranı belirli aralıklarla otomatik kaydıran sunum modu.
   - **Sesli Uyarı Sentezleyici:** Kritik arızalarda (İş Güvenliği / Tekrar Eden) endüstriyel siren tonu, normal işlemlerde bildirim melodisi.
   - **Canlı Saat & Vardiya:** 1., 2. ve 3. vardiya otomatik tespiti ve dijital saat.

3. **Operasyonel Yönetim:**
   - Hızlı teknisyen seçimi ve PIN doğrulama (Fuat Çetin, Aykut Öz, Engin Vardar, Muammer Acar, vb.).
   - Müdahale kronometresi ve adımları (`interventions` dizisi).
   - Yeni arıza bildirimi ve makine kataloğu (100+ fabrika makinesi).

## GitHub ve Canlı Dağıtım (Deployment)

Bu projeyi GitHub'a yükleyip Android TV'de çalıştırmak için:

### 1. GitHub'a Gönderme
```bash
git init
git add .
git commit -m "feat: Fabrika Arıza Takip TV Paneli"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/ariza-takip-tv.git
git push -u origin main
```

### 2. Canlı Yayına Alma (Örn: GitHub Pages, Vercel veya Firebase Hosting)
- **Vercel / Netlify:** Depoyu bağlayıp `npm run build` ile tek tıkla yayınlayabilirsiniz.
- **Firebase Hosting:**
```bash
npm run build
npx firebase-tools deploy --only hosting
```

### 3. Android TV'de Açma
- Android TV üzerindeki herhangi bir web tarayıcısından (örn: TV Bro, Puffin TV, Chrome) yayınlanan URL'yi açın ve tam ekran yapın.
- İsteğe bağlı olarak TV WebView veya PWA olarak TV ana ekranına eklenebilir.
