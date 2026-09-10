// commands/tag.js
import { style, bi } from "../lib/style.js";

export default {
  name: "tag",
  description: "Tague tous les membres avec un message ou un média cité",

  async execute(sock, message, args) {
    const { from, reply, raw, isGroup } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const groupMetadata = await sock.groupMetadata(from);
      const mentions = groupMetadata.participants.map(p => p.id);

      const quotedMsg = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (quotedMsg) {
        const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
        if (text) return sock.sendMessage(from, { text, mentions }, { quoted: raw });

        if (quotedMsg.imageMessage) return sock.sendMessage(from, { image: quotedMsg.imageMessage, mentions }, { quoted: raw });
        if (quotedMsg.videoMessage) return sock.sendMessage(from, { video: quotedMsg.videoMessage, mentions }, { quoted: raw });
        if (quotedMsg.stickerMessage) return sock.sendMessage(from, { sticker: quotedMsg.stickerMessage, mentions }, { quoted: raw });
        if (quotedMsg.documentMessage) return sock.sendMessage(from, { document: quotedMsg.documentMessage, mentions }, { quoted: raw });

        return sock.sendMessage(from, { text: bi("Type de message non supporté."), mentions }, { quoted: raw });
      }

      if (args.length) {
        return sock.sendMessage(from, { text: args.join(" "), mentions }, { quoted: raw });
      }

      await sock.sendMessage(from, { text: bi("Hey"), mentions }, { quoted: raw });
    } catch (err) {
      console.error("❌ tag:", err);
      await reply(style.err(err.message));
    }
  }
};
