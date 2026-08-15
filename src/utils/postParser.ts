import { getLogger } from "@logtape/logtape";
import { Message } from "node-telegram-bot-api";

const logger = getLogger(["RM6785Bot", "utils", "postParser"]);

// TODO: also preserve bolds, italics, monospace and whatnot
export const parsePostAndConstructRichMarkdown = (
  m: Message,
  bannerLink?: string | undefined,
): string | undefined => {
  if (!m.caption_entities || !m.caption) return undefined;

  const caption = m.caption;
  const titleMatch = caption.match(/^.* for Realme .* \[\w+\]$/gm);

  if (!titleMatch) {
    logger.warn("no title line found in caption, cannot build rich markdown");
    return undefined;
  }

  const title = titleMatch[0].trim().split("for")[0].trim();
  const anchorLinks: [string, string][] = [];

  for (const entity of m.caption_entities) {
    if (entity.type != "text_link") continue;
    const url = entity.url!;
    const length = entity.length;
    const offset = entity.offset;
    const theText = caption.substring(offset, offset + length);
    logger.debug(`text_link text=${theText}, url=${url}`);
    anchorLinks.push([theText, url]);
  }

  let richMarkdown = caption
    .replaceAll(/^• /gm, "- ")
    .replace(/^(.* for Realme .* \[\w+\])$/m, "# $1\n")
    .replace(/^(Changelog|Bugs|Notes|Downloads)$/gm, "## $1\n")
    .replace(
      /^(Sources|Screenshots|Support group|Donate)$/gm,
      "\n<sub>$1</sub>\n",
    );

  let cursor = 0;

  for (const [name, url] of anchorLinks) {
    let matchIndex = richMarkdown.indexOf(name, cursor);
    while (matchIndex !== -1) {
      // guard against edge case where download matches
      // the "## Downloads" header instead of "- Download"
      const charBefore = richMarkdown[matchIndex - 1] || "";
      const charAfter = richMarkdown[matchIndex + name.length] || "";
      if (!/\w/.test(charBefore) && !/\w/.test(charAfter)) {
        break;
      }

      matchIndex = richMarkdown.indexOf(name, matchIndex + 1);
    }

    if (matchIndex !== -1) {
      const anchorTag = `<a href="${url}">${name}</a>`;

      richMarkdown =
        richMarkdown.slice(0, matchIndex) +
        anchorTag +
        richMarkdown.slice(matchIndex + name.length);

      cursor = matchIndex + anchorTag.length;
    }
  }

  if (bannerLink) return `![](${bannerLink} "${title}")` + richMarkdown;
  return richMarkdown;
};
