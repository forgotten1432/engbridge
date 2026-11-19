# EngBridge – İngilizce A1 → C2

Türkçe ve Uygurca konuşanlar için çevrimdışı çalışan İngilizce öğrenme uygulaması (PWA).
Derleme adımı yok: düz HTML, CSS ve ES modülleri. GitHub Pages'te ya da `python3 -m http.server` ile çalışır.

**Canlı:** https://forgotten1432.github.io/engbridge/ (GitHub Pages açıldıktan sonra)

## Bölümler

| Sekme | İçerik |
|---|---|
| 🧑‍🏫 Öğretmen | **Ana ekran.** Gemini ile çalışan kişisel öğretmen (`docs/ogretmen-yontemi.md` yöntemi). Önce bekleyen ödev teslim edilir ya da sıradaki derse geçilir. **1. aşama:** 6 kelime (kayıt, IPA, Türkçe, Uygurca, kalıplar, örnek) + dilbilgisi + 5 alıştırma. **2. aşama:** kısa B1+/B2 okuma + tek tek sorulan 5 soruluk sohbet; her cevaptan sonra sadece önemli hatalar ve B2 sürümü. **Ders sonu:** özet, hata günlüğü güncellemesi, 3–4 cümlelik ödev, sıradaki ders. Öğrenci hafızası (profil, 6 modül, ders günlüğü, ödev, hata günlüğü) telefonda saklanır ve `.md` olarak indirilebilir. Yarım kalan ders uygulama kapansa da kaldığı yerden açılır. |
| 📘 Dersler | Hazır dersler (AI'sız, internetsiz çalışır); öğretmenin başvuru kaynağı. A1–C2 müfredat. Her derste Türkçe/İngilizce anlatım, yanlış ↔ doğal örnek çiftleri ve 4 tür alıştırma: boşluk doldurma, hatayı düzeltme, çoktan seçmeli, cümle birleştirme/dönüştürme. %80 ile ders tamamlanır. |
| 🎧 Okuma | Seviyeli okuma parçaları. Altı çizili kelimeye dokununca IPA, Türkçe, Uygurca (sağdan sola) ve kalıplar; kelime kasasına ekleme. Sesli okuma (normal/yavaş), 4 soru. **Dikte:** 0.8× / 1× / 1.15× hızda dinle-yaz, kelime kelime karşılaştırma; atlanan küçük kelimeler (is, are, have, had, a, the…) kırmızı. |
| 🎯 Hatalar | Derslerdeki, diktedeki ve AI değerlendirmesindeki her yanlış SM-2 ile tekrar listesine girer. Farklı günlerde 3 kez üst üste doğru cevaplanınca "ustalaşıldı" olur. 15 teşhis hatasıyla başlar. |
| 🗂️ Kelimeler | SM-2 kelime kartları (Tekrar / Zor / İyi / Kolay), kendi kartını ekleme, **Anki için .tsv dışa aktarma**. **📚 Sözlük:** A1–C2 seviyeli 8.648 kelime (IPA, İngilizce tanım ve örnek); Türkçe anlamı yazıp kasaya eklenir. Okuma parçalarında herhangi bir kelimeye dokununca da bu sözlük açılır. |
| ✨ AI (Öğretmen → Diğer) | Kendi Gemini anahtarınla (BYOK): anahtar ve model ayarı, paragraf değerlendirme, rol yapma sohbeti, en çok hata yapılan konuya göre sınırsız alıştırma, Markdown ilerleme özeti, yedek indir/yükle. |

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

### Öğretmen hafızası
`content/tutor.json` ilk açılışta öğretmen hafızasına kopyalanır (profil, modüller, konum, ders günlüğü, bekleyen ödev, hata günlüğü). Sonrasında hafıza yalnızca telefonda (`localStorage` → `tutor`) güncellenir; yedek dosyasına da girer.

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

## Açık kaynak veriler ve lisanslar

`content/lexicon/` dosyaları `tools/build_lexicon.py` ile şu kaynaklardan üretilir (betik kaynakları kendisi indirir: `pip install cmudict && python3 tools/build_lexicon.py`):

| Kaynak | Kullanım | Lisans |
|---|---|---|
| [CEFR-J Vocabulary Profile 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) — Yukio Tono, Tokyo University of Foreign Studies | A1–B2 seviye ve sözcük türü | Atıf yapılarak araştırma ve ticari kullanım serbest |
| [Octanove Vocabulary Profile C1/C2 1.0](https://github.com/openlanguageprofiles/olp-en-cefrj) — Octanove Labs | C1–C2 seviyeleri | CC BY-SA 4.0 (`content/lexicon/C1.json` ve `C2.json` bu lisansı taşır) |
| [Princeton WordNet 3.1](https://wordnet.princeton.edu/), [Openjam](https://github.com/amirj4m/openjam) üzerinden | İngilizce tanımlar ve örnek cümleler | WordNet lisansı / MIT |
| [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) | ABD telaffuzu (IPA'ya çevrildi) | BSD tarzı |

Atıf: *The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.* · *Octanove Vocabulary Profile C1/C2 1.0, Octanove Labs, CC BY-SA 4.0.*

Ders, okuma ve dikte içerikleri ile Türkçe/Uygurca açıklamalar EngBridge için yazılmıştır. Uygurca çeviriler henüz anadili Uygurca olan biri tarafından kontrol edilmedi.
