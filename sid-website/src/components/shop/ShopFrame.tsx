import { SidIcon } from "@/components/icons/SidIcon";

/**
 * Cadre d'image de la boutique (Lot 56) : l'objet est montré EN ENTIER
 * (object-contain), quelle que soit la forme de la photo, posé sur un fond
 * tiré de la photo elle-même (floutée) — fini les bagues coupées en deux.
 */
export function ShopFrame({
  src,
  alt,
  className = "",
  pad = "p-4",
  zoom = true,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  pad?: string;
  zoom?: boolean;
}) {
  return (
    <div className={`shop-frame relative overflow-hidden ${className}`}>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" aria-hidden className="shop-frame-bg absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
          <span className="shop-frame-vignette absolute inset-0" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className={`relative z-[1] h-full w-full object-contain ${pad} drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)] transition duration-500 ${zoom ? "group-hover:scale-[1.05]" : ""}`}
          />
        </>
      ) : (
        <div className="shop-frame-empty flex h-full w-full items-center justify-center" aria-hidden>
          <SidIcon name="gift" size={44} className="opacity-60" />
        </div>
      )}
    </div>
  );
}
