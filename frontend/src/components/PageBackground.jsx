import { useState } from "react";

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
      <div className="absolute inset-0 bg-gradient-to-b from-void/85 via-void/70 to-void/90" />
    </div>
  );
}
