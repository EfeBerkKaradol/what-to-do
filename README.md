# Ne Yapsak

İki kişi için "bugün ne yapsak?" uygulaması. Yapmak istediğiniz aktiviteleri, gitmek istediğiniz mekanları, izleyeceğiniz film ve dizileri kaydedersiniz; karar günü geldiğinde uygulama desteyi önünüze koyar:

1. **Kaydır.** Kayıtlı fikirleriniz ve o hafta revaçta olan 10 şey (etkinlik, film, dizi) tek destede gelir. Sağa "olur", sola "geç".
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

TMDB kullanmak için (isteğe bağlı, ücretsiz): themoviedb.org'dan bir API anahtarı alın ve depoda **Settings → Secrets and variables → Actions** altına `TMDB_API_KEY` adıyla ekleyin.

## İki telefonda ortak liste

Ayrı bir sunucu yok. Liste bu deponun `data` dalındaki `list.json` dosyasında durur; uygulama onu GitHub API'siyle okur ve yazar.

- **Okumak** için bir şey gerekmez (depo herkese açık olduğu sürece). Bu aynı zamanda listenin herkese açık olduğu anlamına gelir.
- **Yazmak** için her telefonda bir kez, uygulamanın Ayarlar ekranına bir anahtar girilir:
  GitHub → Settings → Developer settings → **Fine-grained tokens** → yalnızca bu depo seçili, **Contents: Read and write**. Anahtar yalnızca o telefonun tarayıcısında saklanır.

Anahtar girilmezse uygulama yine çalışır; eklenenler yalnızca o cihazda kalır. İki telefon aynı anda değişiklik yaparsa kayıtlar tek tek birleştirilir (her kayıtta son değişiklik geçerlidir, silmeler dahil).

## Yakındaki mekanlar

Kazanan ekranındaki "Yakınımdaki mekanları adıyla göster" düğmesi konum izni ister ve konumu (yaklaşık 100 m'ye yuvarlanmış) yalnızca o arama için OpenStreetMap'in Nominatim servisine gönderir. İzin verilmezse Google Haritalar bağlantıları yine çalışır; onlar aramayı Haritalar'ın kendi konum bilgisiyle yapar.

## Yapı

```
scripts/fetch-trending.mjs   haftalık revaçta listesi
src/lib/tournament.ts        eleme (o mu, bu mu) mantığı
src/lib/merge.ts             iki telefonun listesini birleştirme
src/lib/sync.ts              GitHub deposuyla eşitleme
src/lib/venues.ts            mekan önerileri ve harita bağlantıları
src/screens/                 Bugün, Liste, Ayarlar ve seçim akışı
```
