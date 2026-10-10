"use client";

import { useEffect, useRef, useState } from "react";
import type { NavEntry } from "@/lib/navigation";

/**
 * Icône d'une page : `public/icons/<key>.png` si le fichier existe, sinon
 * l'emoji de secours défini dans src/lib/navigation.ts.
 */
export function NavIcon({ entry, size = 56 }: { entry: NavEntry; size?: number }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Si l'image a déjà échoué avant que React ne branche onError (chargement
  // très rapide), on le détecte ici pour basculer quand même sur l'emoji.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span aria-hidden className="leading-none" style={{ fontSize: size * 0.78 }}>
        {entry.emoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={`/icons/${entry.key}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
