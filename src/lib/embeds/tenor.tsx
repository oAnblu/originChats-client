import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";

interface TenorEmbedProps {
  tenorId: string;
  originalUrl: string;
}

export function TenorEmbed({ tenorId, originalUrl }: TenorEmbedProps) {
  const [gifUrl, setGifUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`https://apps.mistium.com/tenor/get?id=${tenorId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Tenor API failed");
        return res.json();
      })
      .then((data) => {
        if (!data?.[0]?.media?.[0]) throw new Error("Invalid Tenor response");
        const media = data[0].media[0];
        const url =
          media.mediumgif?.url || media.gif?.url || media.tinygif?.url;
        if (!url) throw new Error("No GIF URL found");
        setGifUrl(url);
      })
      .catch(() => setError(true));
  }, [tenorId]);

  if (error || !gifUrl) {
    return (
      <a href={originalUrl} target="_blank" rel="noopener noreferrer">
        {originalUrl}
      </a>
    );
  }

  return (
    <div className="embed-container tenor-embed">
      <div className="chat-image-wrapper">
        <img
          src={proxyImageUrl(gifUrl)}
          alt="Tenor GIF"
          className="tenor-gif message-image"
          data-image-url={gifUrl}
          loading="lazy"
        />
      </div>
    </div>
  );
}
