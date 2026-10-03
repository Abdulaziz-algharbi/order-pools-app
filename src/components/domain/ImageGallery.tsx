import { useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import type { ImageRef } from "@/types/domain";

interface ImageGalleryProps {
  images: ImageRef[];
  /** Used in the images' alt text, e.g. "Basmati Rice 25kg, image 2 of 4". */
  name: string;
  className?: string;
}

/**
 * A product's images: the selected one large, with a strip of thumbnails
 * to switch between them when there's more than one. Starts on the first
 * (the cover). Renders nothing for an empty list — the caller decides
 * whether to show a placeholder instead.
 */
export function ImageGallery({ images, name, className }: ImageGalleryProps) {
  const [selected, setSelected] = useState(0);
  if (images.length === 0) return null;

  // The list can shrink (e.g. after an edit) below the selected index.
  const index = Math.min(selected, images.length - 1);
  const label = (i: number) =>
    images.length > 1 ? `${name}, image ${i + 1} of ${images.length}` : name;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
        <img src={cldUrl(images[index], "gallery")} alt={label(index)} className="h-full w-full object-contain" />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, i) => (
            <li key={image.publicId} className="shrink-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  "block h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors",
                  i === index ? "border-tertiary" : "border-transparent hover:border-slate-300",
                )}
              >
                <img src={cldUrl(image, "thumb")} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
