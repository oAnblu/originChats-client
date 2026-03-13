import { useState, useEffect, useMemo, useRef } from "preact/hooks";
import DOMPurify from "dompurify";
import { parseMarkdown } from "../lib/markdown";
import type { MentionContext } from "../lib/markdown";
import {
  detectEmbedType,
  isTenorOnlyMessage,
  proxyImageUrl,
} from "../lib/embeds/utils";
import { Embed } from "../lib/embeds/index";
import type { EmbedInfo } from "../lib/embeds/types";
import { users, channels, rolesByServer, serverUrl } from "../state";

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

function hasImageExtension(url: string): boolean {
  const urlLower = url.toLowerCase();
  return IMAGE_EXTENSIONS.some(
    (ext) =>
      urlLower.endsWith(`.${ext}`) ||
      urlLower.includes(`.${ext}?`) ||
      urlLower.includes(`.${ext}#`),
  );
}

interface MessageContentProps {
  content: string;
  currentUsername?: string;
  authorUsername?: string;
}

const SINGLE_EMOJI_RE =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*[\u{1F3FB}-\u{1F3FF}]?$/u;

function isSingleEmoji(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return SINGLE_EMOJI_RE.test(trimmed);
}

export function MessageContent({
  content,
  currentUsername,
  authorUsername,
}: MessageContentProps) {
  const [embeds, setEmbeds] = useState<EmbedInfo[]>([]);
  const [inlineImages, setInlineImages] = useState<string[]>([]);
  const messageTextRef = useRef<HTMLDivElement>(null);

  const { html, embedLinks, isMentioned, isEmojiOnly } = useMemo(() => {
    const rolesMap = rolesByServer.value[serverUrl.value] || {};
    const roleColors: Record<string, string> = {};
    for (const [name, role] of Object.entries(rolesMap)) {
      if (role.color) {
        roleColors[name.toLowerCase()] = role.color;
      }
    }

    // Compute which roles the message author is allowed to mention.
    // mention_roles: true  → can mention any role
    // mention_roles: string[] → can only mention those specific roles
    // missing / false → cannot mention any role
    const authorRoles =
      (authorUsername
        ? users.value[authorUsername.toLowerCase()]?.roles
        : undefined) ?? [];

    const mentionableRoles = new Set<string>();
    for (const authorRole of authorRoles) {
      const roleDef =
        rolesMap[authorRole] ?? rolesMap[authorRole.toLowerCase()];
      if (!roleDef) continue;
      const perm = (roleDef.permissions as Record<string, any> | undefined)
        ?.mention_roles;
      if (perm === true) {
        // Can mention every role — add all and stop early.
        for (const r of Object.keys(rolesMap)) {
          mentionableRoles.add(r.toLowerCase());
        }
        break;
      } else if (Array.isArray(perm)) {
        for (const r of perm) {
          mentionableRoles.add((r as string).toLowerCase());
        }
      }
    }

    const mentionCtx: MentionContext = {
      validUsernames: new Set(
        Object.keys(users.value).map((u) => u.toLowerCase()),
      ),
      validChannels: new Set(
        channels.value.filter((c) => c.name).map((c) => c.name.toLowerCase()),
      ),
      validRoles: mentionableRoles,
      roleColors,
    };
    const links: string[] = [];
    const parsed = parseMarkdown(content, links, mentionCtx);
    let mentioned = false;
    if (currentUsername) {
      const pingRegex = /@[\w-]+/gi;
      const matches = content.toLowerCase().match(pingRegex);
      if (matches) {
        mentioned = matches.some(
          (m) => m.trim().toLowerCase() === "@" + currentUsername.toLowerCase(),
        );
      }
      if (!mentioned) {
        const myRoles =
          users.value[currentUsername.toLowerCase()]?.roles?.map((r) =>
            r.toLowerCase(),
          ) ?? [];
        if (myRoles.length > 0) {
          const rolePingRegex = /@&([\w-]+)/gi;
          let m: RegExpExecArray | null;
          while ((m = rolePingRegex.exec(content)) !== null) {
            if (myRoles.includes(m[1].toLowerCase())) {
              mentioned = true;
              break;
            }
          }
        }
      }
    }
    return {
      html: DOMPurify.sanitize(parsed, { ADD_ATTR: ["target"] }),
      embedLinks: links,
      isMentioned: mentioned,
      isEmojiOnly: isSingleEmoji(content),
    };
  }, [content, currentUsername, authorUsername]);

  const isTenorOnly = useMemo(
    () => isTenorOnlyMessage(embedLinks, content),
    [embedLinks, content],
  );

  const linksNeedingEmbeds = useMemo(
    () => embedLinks.filter((url) => !hasImageExtension(url)),
    [embedLinks],
  );

  useEffect(() => {
    setEmbeds([]);
    setInlineImages([]);

    if (linksNeedingEmbeds.length === 0) return;

    let cancelled = false;

    async function resolveEmbeds() {
      const results = await Promise.all(
        linksNeedingEmbeds.map((url) => detectEmbedType(url)),
      );
      if (!cancelled) {
        const imageUrls = results
          .filter((e) => e.type === "image")
          .map((e) => e.url);
        setInlineImages(imageUrls);
        setEmbeds(
          results.filter(
            (e) => e.type !== "unknown" && e.type !== "image",
          ) as EmbedInfo[],
        );
      }
    }

    resolveEmbeds();

    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    if (inlineImages.length === 0 || !messageTextRef.current) return;

    const messageText = messageTextRef.current;
    const potentialLinks =
      messageText.querySelectorAll<HTMLAnchorElement>("a.potential-image");

    potentialLinks.forEach((link) => {
      const url = link.dataset.imageUrl;
      if (!url) return;

      const isDetectedImage = inlineImages.some(
        (imgUrl) => imgUrl === url || imgUrl === link.href,
      );

      if (!isDetectedImage) return;

      const wrapper = document.createElement("div");
      wrapper.className = "chat-image-wrapper";

      const img = document.createElement("img");
      img.src = proxyImageUrl(url);
      img.alt = "image";
      img.className = "message-image";
      img.dataset.imageUrl = url;

      wrapper.appendChild(img);
      link.textContent = "";
      link.appendChild(wrapper);
      link.classList.remove("potential-image");
      link.removeAttribute("data-image-url");
    });
  }, [inlineImages]);

  return (
    <>
      <div
        ref={messageTextRef}
        className={`message-text${isMentioned ? " mentioned" : ""}${isEmojiOnly ? " emoji-only" : ""}`}
        style={isTenorOnly ? { display: "none" } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {embeds.length > 0 && (
        <div className="message-embeds">
          {embeds.map((info, i) => (
            <Embed key={`${info.url}-${i}`} info={info} />
          ))}
        </div>
      )}
    </>
  );
}
