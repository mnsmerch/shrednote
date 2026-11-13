'use client';

import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';

import type { LivePlace } from '@/lib/server/presence';

const DEG = Math.PI / 180;

/** Marker radius grows with the number of visitors, but slowly. */
function markerSize(count: number): number {
  return Math.min(0.14, 0.045 + Math.log2(count + 1) * 0.018);
}

/**
 * A slowly turning globe with a dot for each place visitors are in.
 *
 * Purely decorative: the same information is in the list beside it, so the
 * canvas is hidden from assistive technology. It can be dragged to turn it,
 * and holds still for visitors who ask for reduced motion.
 */
export function VisitorGlobe({ places }: { places: LivePlace[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placesRef = useRef(places);
  const drag = useRef<{ startX: number; startPhi: number } | null>(null);
  const phi = useRef(0);
  const focused = useRef(false);

  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let size = canvas.offsetWidth;
    let frame = 0;
    let globe: ReturnType<typeof createGlobe>;

    const markers = () =>
      placesRef.current
        .filter((place) => place.lat !== null && place.lon !== null)
        .map((place) => ({
          location: [place.lat as number, place.lon as number] as [number, number],
          size: markerSize(place.count),
        }));

    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: 2,
        width: size * 2,
        height: size * 2,
        phi: 0,
        theta: 0.28,
        dark: 1,
        diffuse: 1.25,
        mapSamples: 16000,
        mapBrightness: 5.5,
        baseColor: [0.27, 0.31, 0.4],
        markerColor: [0.47, 0.62, 1],
        glowColor: [0.13, 0.19, 0.36],
        markerElevation: 0,
        markers: markers(),
      });
    } catch {
      // No WebGL. The list next to the globe carries the same information.
      return;
    }

    const onResize = () => {
      size = canvas.offsetWidth;
    };
    window.addEventListener('resize', onResize);

    const render = () => {
      // Turn to face the busiest place once, so a lone visitor is not hidden
      // on the far side; after that the globe just drifts.
      const first = placesRef.current.find((place) => place.lon !== null);
      if (!focused.current && first && first.lon !== null) {
        phi.current = -(first.lon + 90) * DEG;
        focused.current = true;
      }
      if (!drag.current && !reduceMotion) phi.current += 0.0025;

      globe.update({
        phi: phi.current,
        width: size * 2,
        height: size * 2,
        markers: markers(),
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    canvas.style.opacity = '1';

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      globe.destroy();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="aspect-square w-full max-w-[26rem] cursor-grab touch-none opacity-0 transition-opacity duration-700 active:cursor-grabbing"
      onPointerDown={(event) => {
        drag.current = { startX: event.clientX, startPhi: phi.current };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        phi.current = drag.current.startPhi + (event.clientX - drag.current.startX) / 160;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
