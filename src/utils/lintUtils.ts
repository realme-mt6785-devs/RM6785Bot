import type { MessageEntity } from "node-telegram-bot-api";

import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "utils", "lintUtils"]);

export const NO_BANNER_ERROR =
  "# ERROR: No ROM banner was found. Please provide a banner for the ROM.";

const RELEASE_TYPE = ["OFFICIAL", "UNOFFICIAL"];
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

const VALID_TITLES: Record<string, string> = {
  RM6785:
    "for Realme 6/6i(Indian)/6s/7/Narzo/Narzo 20 Pro/Narzo 30 4G [STABLE/BETA/ALPHA]",
  nemo: "for Realme 6/6i(Indian)/6s/Narzo ONLY [STABLE/BETA/ALPHA]",
  RMX2001: "for Realme 6/6i(Indian)/6s/Narzo ONLY [STABLE/BETA/ALPHA]",
  salaa: "for Realme 7/Narzo 20 Pro/Narzo 30 4G ONLY [STABLE/BETA/ALPHA]",
  RMX2151: "for Realme 7/Narzo 20 Pro/Narzo 30 4G ONLY [STABLE/BETA/ALPHA]",
};

const TITLE_PATTERNS: Record<string, RegExp> = {
  RM6785:
    /.* for Realme 6\/6i\(Indian\)\/6s\/7\/Narzo\/Narzo 20 Pro\/Narzo 30 4G \[(STABLE|BETA|ALPHA)\]/,
  nemo: /.* for Realme 6\/6i\(Indian\)\/6s\/Narzo ONLY \[(STABLE|BETA|ALPHA)\]/,
  RMX2001:
    /.* for Realme 6\/6i\(Indian\)\/6s\/Narzo ONLY \[(STABLE|BETA|ALPHA)\]/,
  salaa:
    /.* for Realme 7\/Narzo 20 Pro\/Narzo 30 4G ONLY \[(STABLE|BETA|ALPHA)\]/,
  RMX2151:
    /.* for Realme 7\/Narzo 20 Pro\/Narzo 30 4G ONLY \[(STABLE|BETA|ALPHA)\]/,
};

const BOLD_TITLE_MARKERS = [
  "for Realme 6/6i(Indian)/6s/7/Narzo/Narzo 20 Pro/Narzo 30 4G",
  "for Realme 6/6i(Indian)/6s/Narzo ONLY",
  "for Realme 7/Narzo 20 Pro/Narzo 30 4G ONLY",
];

interface BoldSections {
  title: boolean;
  notes: boolean;
  changelog: boolean;
  bugs: boolean;
  downloads: boolean;
}

const section = (name: string, errors: string): string =>
  errors ? `## ${name}:\n${errors}` : "";

const detectBoldSections = (
  text: string,
  entities: MessageEntity[],
): BoldSections => {
  const bold: BoldSections = {
    title: false,
    notes: !text.includes("Notes"),
    changelog: false,
    bugs: false,
    downloads: false,
  };

  for (const entity of entities) {
    if (entity.type !== "bold") continue;

    const word = text.substring(entity.offset, entity.offset + entity.length);

    if (word.includes("Notes")) bold.notes = true;
    else if (word.includes("Changelog")) bold.changelog = true;
    else if (word.includes("Bugs")) bold.bugs = true;
    else if (word.includes("Downloads")) bold.downloads = true;
    else if (BOLD_TITLE_MARKERS.some((marker) => word.includes(marker))) {
      bold.title = true;
    }
  }

  return bold;
};

const validateHashtags = (
  hashtags: string[],
): { errors: string; kernel: boolean; device: string | null } => {
  const buildTag = hashtags[1];
  const releaseTag = hashtags[2];
  const kernel = buildTag === "KERNEL";

  let deviceTag = hashtags[3];
  let androidTag = hashtags[4];
  let ruiTag = hashtags[5];

  if (kernel) {
    deviceTag = hashtags[2];
    ruiTag = hashtags[3];
  } else if (androidTag?.includes("RMX")) {
    androidTag = hashtags[5];
    ruiTag = hashtags[6];
  }

  if (hashtags.length === 0) {
    return {
      errors: section("Hashtags", "- No hashtags were found.\n"),
      kernel,
      device: null,
    };
  }

  let errors = "";
  let device: string | null = null;

  if (!BUILD_TYPE.includes(buildTag)) {
    errors += `- Incorrect build type mentioned on the second hashtag. (${BUILD_TYPE.join("/")})\n`;
  }

  if (!kernel && !RELEASE_TYPE.includes(releaseTag)) {
    errors += `- Incorrect release type mentioned on the third hashtag. (${RELEASE_TYPE.join("/")})\n`;
  }

  if (DEVICE.includes(deviceTag)) {
    device = deviceTag;
  } else {
    const position = kernel ? "third" : "fourth";
    errors += `- Incorrect device mentioned on the ${position} hashtag. (${DEVICE.join("/")})\n`;
  }

  if (!kernel && !ANDROID_VERSION.includes(androidTag)) {
    errors += `- Incorrect Android version mentioned on the fifth hashtag. (${ANDROID_VERSION.join("/")})\n`;
  }

  if (!RUI_VERSION.includes(ruiTag)) {
    errors += `- Incorrect RealmeUI version mentioned on the last hashtag. (${RUI_VERSION.join("/")})\n`;
  }

  return { errors: section("Hashtags", errors), kernel, device };
};

const validateTitle = (
  text: string,
  hashtags: string[],
  device: string | null,
  boldTitle: boolean,
): string => {
  if (device === null) {
    return section(
      "Title",
      "- Cannot be validated because of hashtag errors\n",
    );
  }

  const title = text.match(TITLE_PATTERNS[device])?.[0] ?? null;

  if (!title) {
    return section(
      "Title",
      `- No title or invalid title found. Based on your hashtag, it should be ${VALID_TITLES[device]}\n`,
    );
  }

  const lastHashtag = hashtags[hashtags.length - 1];
  const afterHashtags = text.slice(
    text.lastIndexOf(lastHashtag) + lastHashtag.length,
  );
  const titleNewlines = afterHashtags
    .slice(0, afterHashtags.search(/\S/))
    .match(/\n/g);

  let errors = "";

  if (titleNewlines?.length !== 2) {
    errors += "- Missing two newlines before the title\n";
  }

  if (!boldTitle) {
    errors += "- Missing bold format on title\n";
  }

  return section("Title", errors);
};

const validateBuildInfo = (text: string, kernel: boolean): string => {
  const type = kernel ? "Kernel" : "Android";
  const infoPattern = `(.+)\n• Author:(.+)?\n• ${type} version:(.+)?\n• Build date:(.+)?`;

  if (!text.match(new RegExp(infoPattern, "i"))) {
    return section("Build info", "- Invalid build info section.\n");
  }

  let errors = "";

  if (!text.match(new RegExp(infoPattern))) {
    errors += "- Incorrect case\n";
  }

  if (!text.match(/(.+)\n• Author: (.+)/)) {
    errors += "- Invalid author info\n";
  }

  if (!text.match(new RegExp(`\n• ${type} version: (.+)`))) {
    errors += `- Invalid ${type} version info\n`;
  }

  if (
    !text.match(
      /\n• Build date: (0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\d{4}/,
    )
  ) {
    errors += "- Invalid build date info (Required format: DD-MM-YY)\n";
  }

  return section("Build info", errors);
};

const validateChangelogBugs = (text: string, bold: BoldSections): string => {
  const matchPattern =
    "\n\nChangelog\n(.+\n)+\nBugs\n(.+\n)+(\nNotes\n(.+\n)+)?";

  if (!text.match(new RegExp(matchPattern, "i"))) {
    return section("Changelog/Bugs", "- Invalid Changelog/Bugs section.\n");
  }

  let errors = "";

  if (!text.match(new RegExp(matchPattern))) {
    errors += "- Incorrect case.\n";
  } else {
    if (!bold.changelog) errors += "- Missing bold format on Changelog\n";
    if (!bold.bugs) errors += "- Missing bold format on Bugs\n";
    if (!bold.notes) errors += "- Missing bold format on Notes\n";
  }

  if (!text.match(/\n\nChangelog\n•/)) {
    errors += "- Invalid Changelog section.\n";
  }

  if (!text.match(/\nBugs\n•/)) {
    errors += "- Invalid Bugs section.\n";
  }

  if (text.match(/\nNote/i) && !text.match(/\nNotes\n•/)) {
    errors += "- Invalid notes section.\n";
  }

  return section("Changelog/Bugs", errors);
};

const validateDownloads = (
  text: string,
  kernel: boolean,
  boldDownloads: boolean,
): string => {
  const matchPattern = kernel
    ? "\n\nDownloads\n• File size:(.+)?\n• Download\n"
    : "\n\nDownloads\n• Build type:(.+)?\n• File size:(.+)?\n• Download\n";

  if (!text.match(new RegExp(matchPattern, "i"))) {
    return section("Downloads", "- Invalid Downloads section.\n");
  }

  let errors = "";

  if (!text.match(new RegExp(matchPattern))) {
    errors += "- Incorrect case.\n";
  } else if (!boldDownloads) {
    errors += "- Missing bold format on Downloads.\n";
  }

  if (!kernel && !text.match(/(.+)\n• Build type: (.+)/)) {
    errors += "- Invalid build type\n";
  }

  if (!text.match(/(.+)\n• File size: (.+)/)) {
    errors += "- Invalid file size\n";
  }

  return section("Downloads", errors);
};

const validateFooter = (text: string, kernel: boolean): string => {
  const matchPattern = kernel
    ? "\nSources\nSupport group"
    : "\nSources\nScreenshots\nSupport group";

  if (!text.match(new RegExp(matchPattern, "i"))) {
    return section(
      "Footer",
      `- Invalid footer section.\n  Should be written exactly like this:${matchPattern}\n`,
    );
  }

  if (!text.match(new RegExp(matchPattern))) {
    return section(
      "Footer",
      `- Incorrect case.\n  Correct usage:${matchPattern}\n`,
    );
  }

  return "";
};

const lintTelegramPost = (
  text: string,
  entities: MessageEntity[],
): [string, boolean] => {
  const hashtags = text.match(/#\w+/g)?.map((tag) => tag.slice(1)) ?? [];
  const { errors: hashtagErrors, kernel, device } = validateHashtags(hashtags);
  const bold = detectBoldSections(text, entities);

  const errors = [
    hashtagErrors,
    validateTitle(text, hashtags, device, bold.title),
    validateBuildInfo(text, kernel),
    validateChangelogBugs(text, bold),
    validateDownloads(text, kernel, bold.downloads),
    validateFooter(text, kernel),
  ]
    .filter((part) => part.trim())
    .join("\n");

  const lintStatus = !errors.trim();
  const lintResult = lintStatus
    ? "# Seems good 🤌\nBot approves"
    : `# ERRORS\n\n${errors}`;

  logger.debug(
    `lintTelegramPost: kernel=${kernel} status=${lintStatus ? "pass" : "fail"} hashtags=${hashtags.length}`,
  );

  return [lintResult, lintStatus];
};

export default lintTelegramPost;
