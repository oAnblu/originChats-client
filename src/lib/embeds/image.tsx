import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";
import {
  getCachedImage,
  getCachedImageSync,
  scheduleCleanup,
} from "../image-cache";

export function ImageEmbed({ url }: { url: string }) {
  const initialCached = getCachedImageSync(url);
  const [isValid, setIsValid] = useState<boolean | null>(
    initialCached ? true : null,
  );
  const [cachedSrc, setCachedSrc] = useState<string | null>(
    () => initialCached,
  );

  useEffect(() => {
    let cancelled = false;

    const checkAndCacheImage = async () => {
      scheduleCleanup();

      try {
        const urlObj = new URL(url);
        if (
          urlObj.hostname === "localhost" ||
          urlObj.hostname === "127.0.0.1"
        ) {
          setIsValid(false);
          return;
        }
      } catch {}

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: "HEAD",
          mode: "cors",
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (cancelled) return;

        if (res.ok) {
          const ct = res.headers.get("Content-Type") || "";
          const isImage = ct.startsWith("image/");
          setIsValid(isImage);

          if (isImage && !getCachedImageSync(url)) {
            const cached = await getCachedImage(url);
            if (!cancelled && cached) {
              setCachedSrc(cached);
            }
          }
        } else {
          setIsValid(false);
        }
      } catch (err) {
        if (!cancelled) setIsValid(false);
      }
    };

    checkAndCacheImage();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (isValid === null) {
    return <div className="embed-container image-embed skeleton" />;
  }
  if (!isValid)
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );

  return (
    <div className="embed-container image-embed">
      <div className="chat-image-wrapper">
        <img
          src={cachedSrc || proxyImageUrl(url)}
          alt="image"
          className="message-image"
          data-image-url={url}
          loading="lazy"
          style="cursor: pointer"
        />
      </div>
    </div>
  );
}
