# Ne Yapsak

İki kişi için "bugün ne yapsak?" uygulaması. Yapmak istediğiniz aktiviteleri, gitmek istediğiniz mekanları, izleyeceğiniz film ve dizileri kaydedersiniz; karar günü geldiğinde uygulama desteyi önünüze koyar:

Açılışta nokta nokta bir alan, üzerinde sol üstten sağ alta durmadan akan büyük piksel ikonlar ve ortada, macOS Dock'u gibi buzlu camdan bir gezinme çubuğu karşılar; bir sayfaya girildiğinde aynı çubuk üste çıkar.

- **Eklediklerim.** Kendi yazdıklarınız. `+` ile önce kategori (aktivite, mekan, film, dizi), sonra ne olduğu.
- **Kaydettiklerim.** Bölüm bölüm kartlar: revaçtaki filmler, revaçtaki tiyatrolar, kategorileriyle filmler, diziler ve etkinlikler. Etkinlik kategorilerinin başında yürüyüş parkları, yemek mekanları ve tatlı mekanları durur. Kalbe bastıklarınız beğenilenlere eklenir.
- **Ne Yapsak.** Önce "Hazır mısın?" ekranı, "Hazırım" deyince:
  1. **Kaydır.** Kaç seçenek arasından karar vereceğinizi siz seçersiniz (5 ile 50 arası). Destenin en çok %60'ı eklediklerinizle beğendiklerinizden, kalanı o haftanın revaçta olanlarından ve kategorilerin en popülerlerinden gelir. Sağa "olur", sola "geç".
  2. **O mu, bu mu?** "Olur" dedikleriniz ikişer ikişer karşınıza çıkar; eleme usulü, sona kalan kazanır.
  3. **Kazanan ve nereye gidileceği.** Etkinlikse mekanı, kayıtlı bir yerse konumu, film ya da aktiviteyse yakındaki uygun mekanlar; hepsi Google Haritalar bağlantısıyla.

## Çalıştırma

```bash
npm install
npm run dev
```

`npm test` eleme ve birleştirme mantığını sınar, `npm run build` yayına hazır sürümü `dist/` içine üretir.

## Yayın (GitHub Pages)

Depo ayarlarında **Settings → Pages → Source: GitHub Actions** seçin. Ardından `main` dalına her gönderimde ve her sabah 07:15'te `.github/workflows/deploy.yml` siteyi yeniden yayınlar. Adres: `https://<kullanıcı>.github.io/what-to-do/`

## Revaçta olanlar nereden geliyor

`scripts/fetch-trending.mjs` her sabah `public/trending.json` dosyasını yeniler:

| Tür | Kaynak | Not |
| --- | --- | --- |
| Etkinlik | Biletix arama dizini | Önümüzdeki 7 gün, şehir şehir. Dizinde popülerlik alanı yok; haftada en çok seansı olanlar öne alınır. |
| Film | iTunes Türkiye listesi | `TMDB_API_KEY` tanımlıysa TMDB haftalık trendleri kullanılır. |
| Dizi | TVMaze (son 7 günün yayınları) | `TMDB_API_KEY` tanımlıysa TMDB haftalık trendleri kullanılır. |

Her grupta 12 kayıt tutulur; uygulama her gün bu havuzdan 4 etkinlik, 3 film, 3 dizi seçer. Bir kaynak yanıt vermezse o grubun önceki kayıtları korunur.

### Kategoriler

Aynı iş `public/catalog.json` dosyasını da yeniler:

- **Film ve dizi:** TMDB'nin tür listesi ve her tür için o an en popüler 10 yapım. `TMDB_API_KEY` yoksa bu iki raf boş kalır ve uygulamada gösterilmez.
- **Mekan:** elle seçilmiş listeler, `data/places.json` içinde; bölüm (`walk`, `food`, `dessert`) → şehir → grup. Şimdilik Ankara: 18 yürüyüş parkı, 24 yemek mekanı, 12 tatlı mekanı. Hepsinin adı ve adresi OpenStreetMap'te doğrulandı; puan ya da popülerlik sıralaması değil. Yeni şehir ya da kategori eklemek için bu dosyaya yazmak yeterli.
- **Etkinlik:** Biletix'in alt kategorileri (tiyatro, stand-up, pop, caz, atölye, müze…), önümüzdeki 30 gün, şehir şehir; en çok seansı olan önde.

Anahtar yalnızca GitHub'da durduğu için kategoriler tarayıcıda canlı çekilmez; günde bir kez önceden hazırlanır.

### Görseller

Film ve dizilerde afiş (TMDB), etkinliklerde Biletix görseli, 10 parkta Wikipedia fotoğrafı kullanılır. Kendi görseli olmayan her şey için `public/art/` içindeki temsili görseller devreye girer: yapay zekâyla (Pollinations) üretilmiş, türü anlatan resimler (kebap, balık, baklava, göl kenarı…). Bunlar mekanın kendi fotoğrafı değildir; uygulama bunu kartların altında söyler. Elle eklenen ve görseli olmayan kayıtlar da türüne göre (`activity`, `place`, `movie`, `series`, `event`) aynı klasörden görsel alır.

TMDB kullanmak için (isteğe bağlı, ücretsiz): themoviedb.org'dan bir API anahtarı alın ve depoda **Settings → Secrets and variables → Actions** altına `TMDB_API_KEY` adıyla ekleyin.

## Ortak liste

Şimdilik kişiye özel liste yok: siteyi açan herkes aynı listeyi görür ve değiştirebilir. Liste, anahtar gerektirmeyen herkese açık bir JSON deposunda (extendsclass.com) tek dosya olarak durur; uygulama açılışta, sekmeye dönüldüğünde ve her değişiklikten hemen sonra okuyup birleştirir ve geri yazar.

Bilinmesi gerekenler:

- Bağlantıyı bilen herkes listeye ekleyebilir ve silebilir. Kişisel bir şey yazmayın.
- Depo üçüncü bir tarafa ait ve garanti vermiyor; yanıt vermezse kayıtlar o cihazda kalır ve bağlantı gelince eşitlenir.
- Dosya yaklaşık 85 kB ile sınırlı (birkaç yüz kayıt).
- İki kişi aynı saniyede yazarsa biri diğerinin üzerine yazar; kaybeden cihaz kayıtlarını bir sonraki eşitlemede geri koyar.

Kalıcı bir çözüme (hesaplı bir veritabanı, kişiye ya da çifte özel listeler) geçmek için değişecek tek yer `src/lib/sync.ts` içindeki `pull` ve `push`.

## Yakındaki mekanlar

Kazanan ekranındaki "Yakınımdaki mekanları adıyla göster" düğmesi konum izni ister ve konumu (yaklaşık 100 m'ye yuvarlanmış) yalnızca o arama için OpenStreetMap'in Nominatim servisine gönderir. İzin verilmezse Google Haritalar bağlantıları yine çalışır; onlar aramayı Haritalar'ın kendi konum bilgisiyle yapar.

## Yapı

```
scripts/fetch-trending.mjs   haftalık revaçta listesi
src/lib/tournament.ts        eleme (o mu, bu mu) mantığı
src/lib/merge.ts             cihazdaki listeyle ortak listeyi birleştirme
src/lib/sync.ts              ortak listeyle eşitleme
src/lib/venues.ts            mekan önerileri ve harita bağlantıları
src/components/PixelField.tsx açılıştaki nokta alanı ve piksel ikonlar
src/components/Dock.tsx      buzlu cam gezinme çubuğu
src/screens/                 Eklediklerim, Kaydettiklerim, Ayarlar ve seçim akışı
```
