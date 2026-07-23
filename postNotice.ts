import { TelegramBot } from "node-telegram-bot-api";

import { TELEGRAM_RM6785_CHANNEL } from "./src/constants";

export const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("please set BOT_TOKEN");
export const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const RICH_NOTICE: string = `
# How to Post Your ROM in This Channel

1. Write your post following the template
   <sub>(all posts in this channel follows the template and
    passes the linter's checks, so just follow them)</sub>
2. Send your post to @RM6785Bot, the bot will auto-lint
   and let you know what's wrong. If the lint is
   successful, the bot will auto forward your post
   to the _release request group_ and we'll post it right
   away.
3. If you plan on posting regularly <sub>(i.e., you plan on
   maintaning the ROM you built)</sub>, tag any admin in the
   group to be added to the _release request_ group.
   Or PM @hakimifr. For any other admins, please ask
   them in group first if you can PM them.

<aside>
I will <b>NOT</b> entertain any PM that is unrelated
to channel post. I don't use realme 6 anymore so
don't PM me for device/ROM/recovery issues thx.
<cite>hakimi</cite>
</aside>

<details><summary>More info</summary>
## Some Other Sidenotes

1. Fun fact: the post standardisation for this channel
   happens thanks to Samar and Sundae back then.
   Now the channel's posts are always consistent.

2. **If** you're having trouble following the template,
   you can also ask to be added in the group so that we
   can assist.

3. We're also testing new post format using Telegram's
   new rich message API, so let us know what you think.
</details>
`;

// ************** RM6785 Channel **************
bot.editMessageText({
  chat_id: TELEGRAM_RM6785_CHANNEL,
  message_id: 2559,
  rich_message: { markdown: RICH_NOTICE },
});
// bot.sendRichMessage(TELEGRAM_RM6785_CHANNEL, { markdown: RICH_NOTICE });
// ********************************************

// ************** Bot Wars **************
// bot.editMessageText({
//   chat_id: -1001801695556,
//   message_id: 3839,
//   rich_message: { markdown: RICH_NOTICE },
// });
// bot.sendRichMessage(-1001801695556, { markdown: RICH_NOTICE });
// **************************************
