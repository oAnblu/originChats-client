export function VideoEmbed({ url }: { url: string }) {
  return (
    <div className="embed-container video-embed">
      <video src={url} controls preload="metadata" className="video-player">
        <a href={url} target="_blank" rel="noopener noreferrer">
          Video failed to load - click to open
        </a>
      </video>
    </div>
  );
}
