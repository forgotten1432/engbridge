# EngBridge – İngilizce A1 → C2

Türkçe ve Uygurca konuşanlar için çevrimdışı çalışan İngilizce öğrenme uygulaması (PWA).
Derleme adımı yok: düz HTML, CSS ve ES modülleri. GitHub Pages'te ya da `python3 -m http.server` ile çalışır.

**Canlı:** https://forgotten1432.github.io/engbridge/ (GitHub Pages açıldıktan sonra)

## Bölümler

| Sekme | İçerik |
|---|---|
| 📘 Dersler | A1–C2 müfredat. Her derste Türkçe/İngilizce anlatım, yanlış ↔ doğal örnek çiftleri ve 4 tür alıştırma: boşluk doldurma, hatayı düzeltme, çoktan seçmeli, cümle birleştirme/dönüştürme. %80 ile ders tamamlanır. |
| 🎧 Okuma | Seviyeli okuma parçaları. Altı çizili kelimeye dokununca IPA, Türkçe, Uygurca (sağdan sola) ve kalıplar; kelime kasasına ekleme. Sesli okuma (normal/yavaş), 4 soru. **Dikte:** 0.8× / 1× / 1.15× hızda dinle-yaz, kelime kelime karşılaştırma; atlanan küçük kelimeler (is, are, have, had, a, the…) kırmızı. |
| 🎯 Hatalar | Derslerdeki, diktedeki ve AI değerlendirmesindeki her yanlış SM-2 ile tekrar listesine girer. Farklı günlerde 3 kez üst üste doğru cevaplanınca "ustalaşıldı" olur. 15 teşhis hatasıyla başlar. |
| 🗂️ Kelimeler | SM-2 kelime kartları (Tekrar / Zor / İyi / Kolay), kendi kartını ekleme, **Anki için .tsv dışa aktarma**. |
| ✨ AI | Kendi Gemini anahtarınla (BYOK): paragraf değerlendirme, rol yapma sohbeti, en çok hata yapılan konuya göre sınırsız alıştırma, Markdown ilerleme özeti, yedek indir/yükle. |

AI dışındaki her şey internetsiz çalışır. Gemini anahtarı yalnızca cihazın `localStorage`'ında durur.

## İçerik ekleme

Tüm içerik `content/` klasöründe JSON olarak durur. Kod değişmeden içerik eklenebilir; içerik dosyaları önce ağdan alındığı için yayınlanınca telefonlara hemen gelir.

### Yeni ders
1. `content/lessons/<DERS-ID>.json` oluştur (örnek: `content/lessons/B1-M1-L1.json`).
2. `content/curriculum.json` içinde o dersi bul, `"ready": true` ve `"count": <alıştırma sayısı>` ekle.

```json
{
  "id": "B1-M2-L1", "level": "B1", "title": "used to + V1", "rule": "used-to",
  "explain_tr": ["Paragraf 1 (**kalın**, *italik* olabilir)", "Paragraf 2"],
  "explain_en": ["English explanation"],
  "table": [["Başlık 1", "Başlık 2"], ["satır", "satır"]],
  "pairs": [{ "wrong": "…", "right": "…", "note_tr": "…" }],
  "exercises": [
    { "type": "cloze", "prompt": "I ___ live in Ankara.", "answer": ["used to"], "explain_tr": "…" },
    { "type": "fix", "prompt": "I use to smoke.", "answer": ["I used to smoke."], "explain_tr": "…" },
    { "type": "mcq", "prompt": "…", "options": ["A", "B", "C", "D"], "answer": ["B"], "explain_tr": "…" },
    { "type": "transform", "prompt": "Birleştir:\nA. B.", "answer": ["kabul edilen 1", "kabul edilen 2"], "explain_tr": "…" }
  ]
}
```
- `answer` her zaman liste; birden fazla doğru cevap yazılabilir. Kısaltmalar (`I'm` = `I am`), büyük/küçük harf ve noktalama karşılaştırmada önemsenmez.
- `rule` değerleri `curriculum.json` → `rules` içindekilerden biri olmalı (hata istatistiği ve AI alıştırma üretici bunu kullanır).
- `mcq` için `"shuffle": false` seçenek sırasını korur.

### Yeni okuma parçası
`content/reading/<id>.json` oluştur ve `content/reading/index.json`'a bir satır ekle. `glossary` anahtarları metinde birebir geçen kelime/kalıplar olmalı (büyük/küçük harf fark etmez):
```json
"glossary": { "put off": { "ipa": "/pʊt ɒf/", "pos": "phrasal verb", "tr": "ertelemek", "ug": "كېچىكتۈرمەك", "coll": ["put off a meeting"], "ex": ["…"] } },
"questions": [{ "kind": "comprehension|inference|vocab", "q": "…", "options": ["…"], "answer": 0, "explain_tr": "…" }]
```

### Dikte, kelime ve teşhis hataları
- `content/dictation.json` → `{ "id", "level", "text", "tr" }`
- `content/vocab.json` → ilk açılışta kasaya eklenen kartlar
- `content/errors.json` → ilk açılışta Hata Avcısı'na eklenen teşhis hataları

## Kod değişikliği yayınlarken
JS/CSS dosyası değiştiyse `sw.js` içindeki `VERSION` değerini artır (ör. `engbridge-v2`), yoksa telefonlar eski kodu önbellekten açmaya devam eder. Yalnızca `content/` değiştiyse gerek yok.

## Yapı
```
index.html, manifest.webmanifest, sw.js, icon*.{svg,png}
css/app.css
js/app.js        sekme yönlendirme, ilk kurulum
js/store.js      localStorage durumu, yedek/geri yükleme
js/srs.js        SM-2
js/text.js       cevap karşılaştırma, dikte farkı
js/speech.js     Web Speech API
js/errors.js     hata kaydı
js/exercise.js   ortak alıştırma oynatıcı
js/ai.js         Gemini çağrıları
js/views/*.js    5 sekme
content/         tüm ders içeriği (JSON)
```

## Yerel çalıştırma
```
python3 -m http.server 8000
```
ve tarayıcıda `http://localhost:8000`.
