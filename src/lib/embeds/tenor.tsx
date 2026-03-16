import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";
import {
  getCachedImage,
  getCachedImageSync,
  scheduleCleanup,
} from "../image-cache";

interface TenorEmbedProps {
  tenorId: string;
  originalUrl: string;
}

export function TenorEmbed({ tenorId }: TenorEmbedProps) {
  const [gifUrl, setGifUrl] = useState("");
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    scheduleCleanup();

    fetch(`https://apps.mistium.com/tenor/get?id=${tenorId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tenor API failed");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!data?.[0]?.media?.[0]) throw new Error("Invalid Tenor response");
        const media = data[0].media[0];
        const url =
          media.mediumgif?.url || media.gif?.url || media.tinygif?.url;
        if (!url) throw new Error("No GIF URL found");
        setGifUrl(url);

        const syncCached = getCachedImageSync(url);
        if (syncCached) {
          setCachedSrc(syncCached);
        } else {
          getCachedImage(url).then((cached) => {
            if (!cancelled && cached) {
              setCachedSrc(cached);
            }
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tenorId]);

  if (error || !gifUrl) {
    return (
      <div
        className="embed-container tenor-embed skeleton"
        style="width: 200px; height: 150px;"
      />
    );
  }

  return (
    <div className="embed-container tenor-embed">
      <div className="chat-image-wrapper">
        <img
          src={cachedSrc || proxyImageUrl(gifUrl)}
          alt="Tenor GIF"
          className="tenor-gif message-image"
          data-image-url={gifUrl}
          loading="lazy"
        />
      </div>
    </div>
  );
}
