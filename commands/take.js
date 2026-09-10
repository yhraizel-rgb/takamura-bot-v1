// commands/take.js
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

export default {
  name: "take",
  description: "Reprend un sticker et le re-signe",

  async execute(sock, message) {
    const { from, reply, raw } = message;

    try {
      const quotedSticker = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;

      if (!quotedSticker) return reply(style.warn("Réponds à un sticker pour que je le re-scelle sous ton nom."));

      const stream = await downloadContentFromMessage(quotedSticker, "sticker");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // raw.pushName (et non sender, qui est un JID et non un objet)
      const sticker = new Sticker(buffer, {
        pack: "",
        author: raw.pushName || "ROK",
        type: StickerTypes.FULL,
        quality: 80
      });

      await sock.sendMessage(from, { sticker: await sticker.build() }, { quoted: raw });
      await reply(style.ok("Le sticker a été re-scellé avec succès."));
    } catch (err) {
      console.error("❌ take:", err);
      await reply(style.err("Échec de la réincarnation du sceau."));
    }
  }
};
