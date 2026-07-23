import { getLogger } from "@logtape/logtape";
import { Message } from "node-telegram-bot-api";

const logger = getLogger(["RM6785Bot", "utils", "postParser"]);

// TODO: also preserve bolds, italics, monospace and whatnot
export const parsePostAndConstructRichMarkdown = (
  m: Message,
  bannerLink?: string | undefined,
): string | undefined => {
  if (!m.caption_entities) return undefined;

  let title = "";
  const anchorLinks = [];

  for (const entity of m.caption_entities) {
    if (entity.type != "text_link") continue;
    const url = entity.url!;
    const length = entity.length;
    const offset = entity.offset;
    const theText = m.caption!.substring(offset, offset + length);
    logger.debug(`text_link text=${theText}, url=${url}`);
    anchorLinks.push([theText, url]);
  }

  const titleRaw = m.caption!.match(/^.* for Realme .* \[\w+\]$/gm)![0].trim();
  title = titleRaw.split("for")[0].trim();

  let richMarkdown = m
    .caption!.replaceAll(/^• /gm, "- ")
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

// /* export */ const _constructPostRichBlock = (
//   pd: ParsedPostData,
//   banner: PhotoSize
// ): { blocks: RichBlock[] } => {
//   const changelogRichListItems = pd.changelogs.map((v) => {
//     return {
//       label: v,
//       blocks: [] as RichBlock[],
//     } as RichBlockListItem;
//   });
//   const bugsRichListItems = pd.bugs.map((v) => {
//     return {
//       label: v,
//       blocks: [] as RichBlock[],
//     } as RichBlockListItem;
//   });
//   const downloadsRichListItems = pd.downloads.map((v) => {
//     return {
//       label: v,
//       blocks: [] as RichBlock[],
//     } as RichBlockListItem;
//   });
//
//   // notes is optional, so it's handled differently
//   const notesBlock = [];
//   if (pd.notes) {
//     const notesRichListItems = pd.notes.map((v) => {
//       return {
//         label: v,
//         blocks: [] as RichBlock[],
//       } as RichBlockListItem;
//     });
//     notesBlock.push(
//       {
//         type: "heading",
//         text: { type: "bold", text: "Notes" } as unknown as RichTextBold,
//         size: 2,
//       } as RichBlockSectionHeading,
//       {
//         type: "list",
//         items: notesRichListItems,
//       } as RichBlockList
//     );
//   }
//
//   const built = {
//     blocks: [
//       {
//         type: "photo",
//         photo: [banner] as PhotoSize[],
//       } as RichBlockPhoto,
//       {
//         type: "paragraph",
//         text: pd.hashtags.join(" ") as unknown as RichTextHashtag,
//         size: 6,
//       } as RichBlockParagraph,
//       {
//         type: "heading",
//         text: { type: "bold", text: pd.title } as unknown as RichTextBold,
//         size: 1,
//       } as RichBlockSectionHeading,
//       {
//         type: "list",
//         items: [
//           {
//             label: `Author: ${pd.buildAuthor}`,
//             blocks: [] as RichBlock[],
//           } as RichBlockListItem,
//           {
//             label: `Android version: ${pd.buildAndroidVersion}`,
//             blocks: [] as RichBlock[],
//           } as RichBlockListItem,
//           {
//             label: `Build date: ${pd.buildDate}`,
//             blocks: [] as RichBlock[],
//           } as RichBlockListItem,
//         ],
//       } as RichBlockList,
//       {
//         type: "heading",
//         text: { type: "bold", text: "Changelog" } as unknown as RichTextBold,
//         size: 2,
//       } as RichBlockSectionHeading,
//       {
//         type: "list",
//         items: changelogRichListItems,
//       } as RichBlockList,
//       {
//         type: "heading",
//         text: { type: "bold", text: "Bugs" } as unknown as RichTextBold,
//         size: 2,
//       } as RichBlockSectionHeading,
//       {
//         type: "list",
//         items: bugsRichListItems,
//       } as RichBlockList,
//       ...notesBlock,
//       {
//         type: "heading",
//         text: { type: "bold", text: "Downloads" } as unknown as RichTextBold,
//         size: 2,
//       } as RichBlockSectionHeading,
//       {
//         type: "list",
//         items: [
//           ...downloadsRichListItems,
//           {
//             label: `[Download](${pd.downloadLink})`,
//             blocks: [] as RichBlock[],
//           } as RichBlockListItem,
//         ],
//       } as RichBlockList,
//     ],
//   };
//
//   return built;
// };
