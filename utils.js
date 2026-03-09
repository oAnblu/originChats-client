const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'ogg', 'avi', 'mkv'];

const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/;

function hasExtension(url, extensions) {
    const urlLower = url.toLowerCase();
    return extensions.some(ext =>
        urlLower.endsWith(`.${ext}`) ||
        urlLower.includes(`.${ext}?`) ||
        urlLower.includes(`.${ext}#`)
    );
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function blobToDataURL(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

const TRUSTED_DOMAINS = ['avatars.rotur.dev', 'photos.rotur.dev', 'img.youtube.com', 'media.tenor.com', 'media.discordapp.net', 'cdn.discordapp.com'];

function proxyImageUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
        const urlObj = new URL(url);
        if (TRUSTED_DOMAINS.includes(urlObj.hostname)) return url;
    } catch (err) {
        console.debug('URL parsing failed for proxy:', url, err);
    }
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
}
