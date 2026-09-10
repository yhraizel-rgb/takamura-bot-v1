// commands/take.js
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export default {
  name: "take",
  description: "Reprendre un sticker et le re-signer au nom d'Hadès",

  async execute(sock, message, args) {
    const { from, reply, isGroup, sender, raw } = message;

    try {
      // 🎯 Sticker cité
      const quotedSticker =
        raw.message?.extendedTextMessage?.contextInfo?.quotedMessage
          ?.stickerMessage;

      if (!quotedSticker) {
        return await reply(
          "⚔️ 𝚁𝚎́𝚙𝚘𝚗𝚍𝚜 𝚊̀ 𝚞𝚗 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚙𝚘𝚞𝚛 𝚚𝚞𝚎 𝚓𝚎 𝚕𝚎 𝚜𝚌𝚎𝚕𝚕𝚎 𝚜𝚘𝚞𝚜 𝚝𝚘𝚗 𝚗𝚘𝚖."
        );
      }

      // ⬇️ Téléchargement du sticker
      const stream = await downloadContentFromMessage(
        quotedSticker,
        "sticker"
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // 🔥 Re-création du sticker
      const sticker = new Sticker(buffer, {
        pack: "",
        author: sender?.pushName||"ROK",
        type: StickerTypes.FULL,
        quality: 80,
      });

      await sock.sendMessage(
        from,
        { sticker: await sticker.build() },
        { quoted: raw }
      );

      await reply("✅ 𝙻𝚎 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚊 𝚎́𝚝𝚎́ 𝚛𝚎-𝚜𝚌𝚎𝚕𝚕𝚎́ 𝚊𝚟𝚎𝚌 𝚜𝚞𝚌𝚌𝚎̀𝚜.");
    } catch (err) {
      console.error("❌ TAKE error:", err);
      await reply(
        "☠️ 𝙴́𝚌𝚑𝚎𝚌 𝚍𝚎 𝚕𝚊 𝚛𝚎́𝚒𝚗𝚌𝚊𝚛𝚗𝚊𝚝𝚒𝚘𝚗 𝚍𝚞 𝚜𝚌𝚎𝚊𝚞."
      );
    }
  }
};
