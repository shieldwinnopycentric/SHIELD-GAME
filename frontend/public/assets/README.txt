WAJIB (game fallback ke placeholder kalau belum ada):
  tile-ground.png        -> 1 tile ground/jalan dari RPG Urban Kit
  character-nexus.png    -> avatar Nexus (The Visionary Leader)
  character-cypher.png   -> avatar Cypher (The Tech Prodigy)
  character-helix.png    -> avatar Helix (The Unstoppable Bastion)
  npc-marker.png          -> ikon marker NPC/encounter generik

CATATAN: avatar TIDAK berbasis gender lagi. Semua pemain (diri sendiri &
teman) render dari character-nexus/cypher/helix.png sesuai avatar yang
mereka pilih sendiri di halaman "Pilih Avatarmu".

OPSIONAL (bikin map jauh lebih variatif):
  map-background.png     -> DIREKOMENDASIKAN: 1 gambar background jadi
                            (dari itch.io/OpenGameArt) buat seluruh map.
                            Kalau file ini ada, tile-ground-2/3 di bawah
                            otomatis DIABAIKAN sepenuhnya untuk ground.
  tile-ground-2.png      -> cuma dipakai kalau map-background.png TIDAK
                            ada: tile ground varian ke-2
  tile-ground-3.png      -> cuma dipakai kalau map-background.png TIDAK
                            ada: tile ground varian ke-3
  tile-path.png          -> tile jalan/path (jalan bareng map-background
                            ATAU mode tile-mosaic, dua-duanya kepakai)
  decor-1.png / decor-2.png / decor-3.png -> dekorasi (cuma dipakai di
                            mode tile-mosaic, diabaikan kalau pakai
                            map-background.png)

OPSIONAL (marker beda tiap level):
  npc-marker-1.png       -> marker khusus Level 1
  npc-marker-2.png       -> marker khusus Level 2
  npc-marker-3.png       -> marker khusus Level 3

OPSIONAL (musuh & splash screen):
  enemy-icon.png         -> ikon musuh kecil, ditampilkan berkelompok di
                            tiap marker (1/3/5 sesuai jumlah musuh level itu)
  logo-sma35.png         -> logo SMA 35 (splash screen pembuka saja)
  logo-opsi.png          -> logo OPSI (splash screen pembuka saja)
  opening-background.png -> gambar background full-screen di Opening
                            screen (disarankan ukuran lebar, mis. 1920x1080
                            atau lebih, karena di-cover full layar)

Kalau file opsional tidak ada, semuanya fallback dengan aman. Lihat
README.md di root project untuk link download & detail lengkap.