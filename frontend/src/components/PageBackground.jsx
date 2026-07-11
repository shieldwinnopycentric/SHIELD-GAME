import { useState } from "react";

// Full-bleed pixel-art background untuk halaman setup/menu. Duduk fixed di
// belakang kartu yang berada di tengah (App membungkus tiap page dengan
// flex-center). Kalau aset gambarnya belum ada, komponen ini tidak
// merender apa-apa (return null) sehingga latar palet dari body tetap
// tampil — jadi aman ditaruh sekarang meski gambarnya menyusul.
//
// Cara pakai: taruh <PageBackground src="/assets/bg-xxx.jpg" /> sebagai
// elemen pertama di dalam page. Drop file gambarnya ke frontend/public/assets/.
export default function PageBackground({ src }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        className="pixelated absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay bernuansa palet supaya teks & kartu tetap kontras di atas
          gambar apa pun. */}
      <div className="absolute inset-0 bg-gradient-to-b from-void/85 via-void/70 to-void/90" />
    </div>
  );
}
