"use client";
import { useEffect, useState } from "react";
import { loadImage } from "../mockup/render";

export function useLoadedImage(src: string | null | undefined) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    if (!src) {
      setImg(null);
      return;
    }
    loadImage(src)
      .then((i) => alive && setImg(i))
      .catch(() => alive && setImg(null));
    return () => {
      alive = false;
    };
  }, [src]);
  return img;
}
