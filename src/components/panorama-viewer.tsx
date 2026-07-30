"use client";

import { useRef, useState } from "react";

/**
 * A drag-to-pan viewer for equirectangular panoramas.
 *
 * Deliberately not a WebGL sphere: this pans a repeating strip rather than
 * projecting one, which means no shader, no library, and it works on any device
 * that can show a background image. The trade-off is honest — vertical look and
 * true perspective are missing, so a panorama reads slightly flatter than it would
 * in a dedicated viewer. For "what does this room look like all the way round",
 * which is what a couple actually asks of a venue tour, it is enough.
 *
 * `repeat-x` is what makes it loop seamlessly past the seam of the image.
 */
export function PanoramaViewer({
  src,
  caption,
}: {
  src: string;
  caption?: string | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ startX: number; startOffset: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function begin(event: React.PointerEvent) {
    drag.current = { startX: event.clientX, startOffset: offset };
    setDragging(true);
    frame.current?.setPointerCapture(event.pointerId);
  }

  function move(event: React.PointerEvent) {
    if (!drag.current) return;
    setOffset(drag.current.startOffset + (event.clientX - drag.current.startX));
  }

  function end(event: React.PointerEvent) {
    drag.current = null;
    setDragging(false);
    frame.current?.releasePointerCapture(event.pointerId);
  }

  return (
    <figure>
      <div
        ref={frame}
        role="img"
        aria-label={caption ?? "360 degree panorama — drag to look around"}
        tabIndex={0}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={(event) => {
          // Arrow keys, so this is usable without a pointer at all.
          if (event.key === "ArrowLeft") setOffset((value) => value + 40);
          if (event.key === "ArrowRight") setOffset((value) => value - 40);
        }}
        className="h-56 w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:h-72"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
          backgroundPosition: `${offset}px center`,
          cursor: dragging ? "grabbing" : "grab",
        }}
      />
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
        <span aria-hidden>↔</span>
        <span>Drag to look around</span>
        {caption && <span className="text-ink-soft">· {caption}</span>}
      </figcaption>
    </figure>
  );
}
