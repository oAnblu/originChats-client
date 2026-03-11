import { useState, useEffect } from "preact/hooks";
import { proxyImageUrl } from "./utils";

export function ImageEmbed({ url }: { url: string }) {
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    const checkImage = async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: "HEAD",
          mode: "cors",
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const ct = res.headers.get("Content-Type") || "";
          setIsValid(ct.startsWith("image/"));
        } else {
          setIsValid(false);
        }
      } catch (err) {
        setIsValid(false);
      }
    };

    checkImage();
  }, [url]);

  if (isValid === null) return null;
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
          src={proxyImageUrl(url)}
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
