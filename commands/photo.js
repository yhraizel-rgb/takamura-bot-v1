// commands/photo.js
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

export default {
  name: "photo",
  description: "Convertit un sticker cité en image",

  async execute(sock, message) {
    const { from, reply, quoted } = message;

    // ctx.quoted (fourni par index.js) est déjà le contenu du message cité,
    // pas la citation d'une citation — donc quoted.stickerMessage, pas
    // quoted.message.stickerMessage.
    if (!quoted?.stickerMessage) {
      return reply(style.warn("Réponds à un sticker avec .photo pour le convertir en image."));
    }

    try {
      const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);

      await sock.sendMessage(from, { image: Buffer.concat(chunks) });
    } catch (err) {
      console.error("❌ photo:", err);
      await reply(style.err("Impossible de convertir ce sticker."));
    }
  }
};
