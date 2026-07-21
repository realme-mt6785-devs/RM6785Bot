import type { MessageEntity } from "node-telegram-bot-api";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "utils", "lintUtils"]);

const lintTelegramPost = (
  text: string,
  entities: MessageEntity[]
): [string, boolean] => {
  let KERNEL = false;
  let boldTitle = false;
  let boldNotes = false;
  let boldChangelog = false;
  let boldBugs = false;
  let boldDownloads = false;
  let hashtags: string[] = [];

  const validateHashtags = (): string => {
    let errorMessage = "";
    hashtags = text.match(/#\w+/g)?.map((tag) => tag.slice(1)) || [];
    let [
      TAG_BRAND,
      TAG_BUILD,
      TAG_RELEASE_TYPE,
      TAG_DEVICE,
      TAG_ANDROID_VER,
      TAG_RUI_VER,
    ] = hashtags;

    if (TAG_BUILD === "KERNEL") {
      KERNEL = true;
      [TAG_DEVICE, TAG_RUI_VER] = [hashtags[2], hashtags[3]];
    } else if (TAG_ANDROID_VER?.includes("RMX")) {
      [TAG_ANDROID_VER, TAG_RUI_VER] = [hashtags[5], hashtags[6]];
    }

    const RELEASE_TYPE = ["UNOFFICIAL", "OFFICIAL"];
    const BUILD_TYPE = ["ROM", "KERNEL", "RECOVERY"];
    const DEVICE = ["RM6785", "RMX2001", "RMX2151", "salaa", "nemo"];
    const ANDROID_VERSION = [
      "A10",
      "A11",
      "A12",
      "A13",
      "A14",
      "A15",
      "A16",
      "A17",
    ];
    const RUI_VERSION = ["RUI1", "RUI2", "RUI3"];

    if (hashtags.length === 0) {
      return "Hashtags:\n- No hashtags were found.";
    }

    if (!BUILD_TYPE.includes(TAG_BUILD)) {
      errorMessage +=
        "- Incorrect build type mentioned on the second hashtag. (ROM/KERNEL/RECOVERY)\n";
    }

    if (!KERNEL && !RELEASE_TYPE.includes(TAG_RELEASE_TYPE)) {
      errorMessage +=
        "- Incorrect release type mentioned on the third hashtag. (OFFICIAL/UNOFFICIAL)\n";
    }

    if (!DEVICE.includes(TAG_DEVICE)) {
      if (KERNEL) {
        errorMessage += `- Incorrect device mentioned on the third hashtag. (RM6785/RMX2001/RMX2151/salaa)\n`;
      } else {
        errorMessage += `- Incorrect device mentioned on the fourth hashtag. (RM6785/RMX2001/RMX2151/salaa)\n`;
      }
    }

    if (!KERNEL && !ANDROID_VERSION.includes(TAG_ANDROID_VER)) {
      errorMessage += `- Incorrect Android version mentioned on the fifth hashtag. (A10/A11/A12/A13/A14/A15/A16)\n`;
    }

    if (!RUI_VERSION.includes(TAG_RUI_VER)) {
      errorMessage += `- Incorrect RealmeUI version mentioned on the last hashtag. (RUI1/RUI2/RUI3)\n`;
    }

    return errorMessage ? `Hashtags:\n${errorMessage}` : "";
  };

  const validateBold = (): string => {
    if (!text.includes("Notes")) {
      boldNotes = true;
    }

    const boldEntities = entities.filter((entity) => entity.type === "bold");

    boldEntities.forEach((entity) => {
      const word = text.substring(entity.offset, entity.offset + entity.length);
      if (word.includes("Notes")) boldNotes = true;
      else if (word.includes("Changelog")) boldChangelog = true;
      else if (word.includes("Bugs")) boldBugs = true;
      else if (word.includes("Downloads")) boldDownloads = true;
      else if (
        word.includes(
          "for Realme 6/6i(Indian)/6s/7/Narzo/Narzo 20 Pro/Narzo 30 4G"
        ) ||
        word.includes("for Realme 6/6i(Indian)/6s/Narzo ONLY") ||
        word.includes("for Realme 7/Narzo 20 Pro/Narzo 30 4G ONLY")
      ) {
        boldTitle = true;
      }
    });

    return "";
  };

  const validateTitle = (): string => {
    const validTitles = [
      "for Realme 6/6i(Indian)/6s/7/Narzo/Narzo 20 Pro/Narzo 30 4G",
      "for Realme 6/6i(Indian)/6s/Narzo ONLY",
      "for Realme 7/Narzo 20 Pro/Narzo 30 4G ONLY",
    ];
    let errorMessage = "";
    const titleNewlines = text
      .slice(
        text.lastIndexOf(hashtags[hashtags.length - 1]) +
          hashtags[hashtags.length - 1]?.length
      )
      .slice(
        0,
        text
          .slice(
            text.lastIndexOf(hashtags[hashtags.length - 1]) +
              hashtags[hashtags.length - 1]?.length
          )
          .search(/\S/)
      )
      .match(/\n/g);

    let title: string | null;
    try {
      title = text.match(/.*\w+(?= +for).*/)?.[0] ?? null;
    } catch {
      title = null;
    }

    if (!title) {
      return "Title:\n- No title found.";
    }

    if (titleNewlines?.length !== 2) {
      errorMessage += "- Missing two newlines before the title\n";
    }

    if (!boldTitle) {
      errorMessage += "- Missing bold format on title\n";
    }

    if (!validTitles.some((aValidTitle) => title!.includes(aValidTitle))) {
      errorMessage += "- Missing or incorrect order of device in title.\n";
    }

    if (!title.match(/\[([^\]]+)\]$/)) {
      errorMessage +=
        "- Missing build's stability stage. (ALPHA/BETA/STABLE)\n";
    }

    return errorMessage ? `\n## Title:\n${errorMessage}` : "";
  };

  const validateBuildInfo = (): string => {
    let errorMessage = "";
    let type: string;
    if (KERNEL) {
      type = "Kernel";
    } else {
      type = "Android";
    }

    const infoPattern = `(.+)\n• Author:(.+)?\n• ${type} version:(.+)?\n• Build date:(.+)?`;
    if (!text.match(new RegExp(infoPattern, "i"))) {
      return "\n## Build info:\n- Invalid build info section.\n";
    }

    if (!text.match(new RegExp(infoPattern))) {
      errorMessage += "- Incorrect case\n";
    }

    if (!text.match(/(.+)\n• Author: (.+)/)) {
      errorMessage += "- Invalid author info\n";
    }

    if (!text.match(new RegExp(`\n• ${type} version: (.+)`))) {
      errorMessage += `- Invalid ${type} version info\n`;
    }

    if (
      !text.match(
        /\n• Build date: (0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\d{4}/
      )
    ) {
      errorMessage += "- Invalid build date info (Required format: DD-MM-YY)\n";
    }

    return errorMessage ? `\n## Build info:\n${errorMessage}` : "";
  };

  const validateChangelogBugs = (): string => {
    let errorMessage = "";
    const matchPattern =
      "\n\nChangelog\n(.+\n)+\nBugs\n(.+\n)+(\nNotes\n(.+\n)+)?";

    if (!text.match(new RegExp(matchPattern, "i"))) {
      return "Changelog/Bugs:\n- Invalid Changelog/Bugs section.";
    }

    if (!text.match(new RegExp(matchPattern))) {
      errorMessage += "- Incorrect case.\n";
    } else {
      const checks = [
        {
          condition: !boldChangelog,
          errorText: "Missing bold format on Changelog",
        },
        { condition: !boldBugs, errorText: "Missing bold format on Bugs" },
        { condition: !boldNotes, errorText: "Missing bold format on Notes" },
      ];
      errorMessage += checks
        .filter((check) => check.condition)
        .map((check) => check.errorText)
        .join("\n");
    }

    if (!text.match(/\n\nChangelog\n•/)) {
      errorMessage += "- Invalid Changelog section.\n";
    }

    if (!text.match(/\nBugs\n•/)) {
      errorMessage += "- Invalid Bugs section.\n";
    }

    if (text.match(/\nNote/i)) {
      if (!text.match(/\nNotes\n•/)) {
        errorMessage += "- Invalid notes section.\n";
      }
    }

    return errorMessage ? `\n## Changelog/Bugs:\n${errorMessage}` : "";
  };

  const validateDownloads = (): string => {
    let errorMessage = "";
    let matchPattern =
      "\n\nDownloads\n• Build type:(.+)?\n• File size:(.+)?\n• Download\n";

    if (KERNEL) {
      matchPattern = "\n\nDownloads\n• File size:(.+)?\n• Download\n";
    }

    if (!text.match(new RegExp(matchPattern, "i"))) {
      return "\n## Downloads:\n- Invalid Downloads section.\n";
    }

    if (!text.match(new RegExp(matchPattern))) {
      errorMessage += "- Incorrect case.\n";
    } else if (!boldDownloads) {
      errorMessage += "- Missing bold format on Downloads.\n";
    }

    if (!KERNEL && !text.match(/(.+)\n• Build type: (.+)/)) {
      errorMessage += "- Invalid build type\n";
    }

    if (!text.match(/(.+)\n• File size: (.+)/)) {
      errorMessage += "- Invalid file size\n";
    }

    return errorMessage ? `\n## Downloads:\n${errorMessage}` : "";
  };

  const validateFooter = (): string => {
    let errorMessage = "";
    let matchPattern: string;
    if (KERNEL) {
      matchPattern = "\nSources\nSupport group";
    } else {
      matchPattern = "\nSources\nScreenshots\nSupport group";
    }

    if (!text.match(new RegExp(matchPattern, "i"))) {
      return (
        `Footer:\n- Invalid footer section.` +
        `\n  Should be written exactly like this:${matchPattern}`
      );
    }

    if (!text.match(new RegExp(matchPattern))) {
      errorMessage += "- Incorrect case.\n";
      errorMessage += `  Correct usage:${matchPattern}`;
    }

    return errorMessage ? `\n## Footer:\n${errorMessage}` : "";
  };

  const errors = `\n${validateHashtags()}${validateBold()}${validateTitle()}
${validateBuildInfo()}${validateChangelogBugs()}${validateDownloads()}
${validateFooter()}`;

  const lintStatus = !errors.trim();
  const lintResult = lintStatus
    ? "# Seems good 🤌\nBot approves"
    : `# ERRORS\n${errors}`;

  logger.debug(
    `lintTelegramPost: kernel=${KERNEL} status=${lintStatus ? "pass" : "fail"} hashtags=${hashtags.length}`
  );

  return [lintResult, lintStatus];
};

export default lintTelegramPost;
