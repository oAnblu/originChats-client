import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import html from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", html);
hljs.registerLanguage("xml", html);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);

const YOUTUBE_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/;

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg", "avi", "mkv"];
const TRUSTED_DOMAINS = [
  "avatars.rotur.dev",
  "photos.rotur.dev",
  "roturcdn.milosantos.com",
  "img.youtube.com",
  "media.tenor.com",
  "media.discordapp.net",
  "cdn.discordapp.com",
];

let shortcodeMap: Record<string, string> = {};

export function setShortcodeMap(map: Record<string, string>) {
  shortcodeMap = map;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function hasExtension(url: string, extensions: string[]): boolean {
  const urlLower = url.toLowerCase();
  return extensions.some(
    (ext) =>
      urlLower.endsWith(`.${ext}`) ||
      urlLower.includes(`.${ext}?`) ||
      urlLower.includes(`.${ext}#`),
  );
}

function proxyImageUrl(url: string): string {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  try {
    const urlObj = new URL(url);
    if (TRUSTED_DOMAINS.includes(urlObj.hostname)) return url;
  } catch {}
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
}

export function replaceShortcodes(text: string): string {
  if (!shortcodeMap) return text;
  return text.replace(/:[\w][^:\n]*?:/g, (match) => {
    if (shortcodeMap[match]) return shortcodeMap[match];
    const trimmed = `:${match.slice(1, -1).trim()}:`;
    return shortcodeMap[trimmed] || match;
  });
}

export interface MentionContext {
  validUsernames: Set<string>; // lowercase
  validChannels: Set<string>; // lowercase
  validRoles?: Set<string>; // lowercase
}

export function parseMarkdown(
  text: string,
  embedLinks: string[] = [],
  mentionCtx?: MentionContext,
): string {
  const codeBlocks: Array<{ placeholder: string; lang: string; code: string }> =
    [];

  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || "plaintext";
    const placeholder = `§CODEBLOCK_${codeBlocks.length}§${Math.random().toString(36).substring(2, 11)}§`;
    codeBlocks.push({ placeholder, lang: language, code });
    return placeholder;
  });

  // Extract spoilers early so their content is not processed by other rules.
  const spoilers: Array<{ placeholder: string; inner: string }> = [];
  text = text.replace(/\|\|(.+?)\|\|/gs, (_, inner) => {
    const placeholder = `§SPOILER_${spoilers.length}§${Math.random().toString(36).substring(2, 11)}§`;
    spoilers.push({ placeholder, inner });
    return placeholder;
  });

  text = text.replace(/`([^`]+)`/g, (match, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<code>${escaped}</code>`;
  });

  text = text.replace(
    /^#{6} (.*)$/gm,
    (_, content) => `<h6>${escapeHtml(content)}</h6>`,
  );
  text = text.replace(
    /^#{5} (.*)$/gm,
    (_, content) => `<h5>${escapeHtml(content)}</h5>`,
  );
  text = text.replace(
    /^#{4} (.*)$/gm,
    (_, content) => `<h4>${escapeHtml(content)}</h4>`,
  );
  text = text.replace(
    /^### (.*)$/gm,
    (_, content) => `<h3>${escapeHtml(content)}</h3>`,
  );
  text = text.replace(
    /^## (.*)$/gm,
    (_, content) => `<h2>${escapeHtml(content)}</h2>`,
  );
  text = text.replace(
    /^# (.*)$/gm,
    (_, content) => `<h1>${escapeHtml(content)}</h1>`,
  );

  text = text.replace(
    /^> (.*)$/gm,
    (_, content) => `<blockquote>${escapeHtml(content)}</blockquote>`,
  );

  text = text.replace(
    /\*\*\*(.+?)\*\*\*/g,
    (_, content) => `<strong><em>${escapeHtml(content)}</em></strong>`,
  );
  text = text.replace(
    /___(.+?)___/g,
    (_, content) => `<strong><em>${escapeHtml(content)}</em></strong>`,
  );

  text = text.replace(
    /\*\*(.+?)\*\*/g,
    (_, content) => `<strong>${escapeHtml(content)}</strong>`,
  );
  text = text.replace(
    /__(.+?)__/g,
    (_, content) => `<strong>${escapeHtml(content)}</strong>`,
  );

  text = text.replace(
    /\*(.+?)\*/g,
    (_, content) => `<em>${escapeHtml(content)}</em>`,
  );
  text = text.replace(
    /_(.+?)_/g,
    (_, content) => `<em>${escapeHtml(content)}</em>`,
  );

  text = text.replace(/@&([a-zA-Z0-9_]+)/g, (match, roleName) => {
    if (
      mentionCtx?.validRoles &&
      !mentionCtx.validRoles.has(roleName.toLowerCase())
    ) {
      return escapeHtml(match);
    }
    return `<span class="role-mention" data-role="${escapeAttribute(roleName)}">@${escapeHtml(roleName)}</span>`;
  });

  text = text.replace(/@([a-zA-Z0-9_]+)/g, (match, user) => {
    if (mentionCtx && !mentionCtx.validUsernames.has(user.toLowerCase())) {
      return escapeHtml(match);
    }
    return `<span class="mention" data-user="${escapeAttribute(user)}">@${escapeHtml(user)}</span>`;
  });

  text = text.replace(/#([a-zA-Z0-9_-]+)/g, (match, channelName) => {
    if (
      mentionCtx &&
      !mentionCtx.validChannels.has(channelName.toLowerCase())
    ) {
      return escapeHtml(match);
    }
    return `<span class="channel-mention" data-channel="${escapeAttribute(channelName)}">#${escapeHtml(channelName)}</span>`;
  });

  text = text.replace(/(https?:\/\/[^\s"']+\.[^\s"']+)/g, (match, url) => {
    embedLinks.push(url);
    const safeUrl = escapeAttribute(url);
    const safeDisplayText = escapeHtml(url);

    if (YOUTUBE_REGEX.test(url)) {
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
    }

    if (url.match(/tenor\.com\/view\/[\w-]+-\d+(?:\?.*)?$/i)) {
      return `<a href="${safeUrl}" class="tenor-embed" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
    }

    if (hasExtension(url, VIDEO_EXTENSIONS)) {
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeDisplayText}</a>`;
    }

    if (hasExtension(url, IMAGE_EXTENSIONS)) {
      return `<img src="${proxyImageUrl(safeUrl)}" alt="image" class="message-image" data-image-url="${safeDisplayText}">`;
    }

    return `<a href="${safeUrl}" class="potential-image" target="_blank" rel="noopener noreferrer" data-image-url="${safeDisplayText}">${safeDisplayText}</a>`;
  });

  text = text.replace(/\n(?!<\/?(h[1-6]|pre|blockquote))/g, "<br>");

  for (const block of codeBlocks) {
    const escapedCode = block.code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<pre><code class="language-${block.lang}">${escapedCode}</code></pre>`;
    text = text.replace(block.placeholder, html);
  }

  for (const spoiler of spoilers) {
    // The spoiler inner text is passed through the same markdown pipeline
    // so formatting like **bold** still works inside spoilers.
    const innerHtml = parseMarkdown(spoiler.inner, [], mentionCtx);
    text = text.replace(
      spoiler.placeholder,
      `<span class="spoiler" role="button" tabindex="0" aria-label="Spoiler">${innerHtml}</span>`,
    );
  }

  return text;
}

export function highlightCodeInContainer(container: HTMLElement): void {
  container.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block as HTMLElement);
  });
}
