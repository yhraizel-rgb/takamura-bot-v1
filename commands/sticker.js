// commands/sticker.js
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  name: "sticker",
  description: "Transforme une image ou vidéo en sticker",

  async execute(sock, message) {
    const { from, raw, reply } = message;

    try {
      const quoted = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const mediaMsg = quoted || raw.message;

      const type = mediaMsg.imageMessage ? "imageMessage" : mediaMsg.videoMessage ? "videoMessage" : null;
      if (!type) return reply(style.warn("Réponds à une image ou vidéo, ou envoie-en une avec la commande."));

      const stream = await downloadContentFromMessage(mediaMsg[type], type === "imageMessage" ? "image" : "video");
      const buffer = await streamToBuffer(stream);

      // raw.pushName (et non message.pushName, qui n'existe pas sur le contexte)
      const sticker = new Sticker(buffer, { pack: "ROK", author: raw.pushName || "XD", type: StickerTypes.FULL, quality: 80 });
      await sock.sendMessage(from, { sticker: await sticker.build() }, { quoted: raw });
    } catch (err) {
      console.error("❌ sticker:", err);
      await reply(style.err(err.message));
    }
  }
};
