// commands/save.js
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

export default {
  name: "save",
  description: "Sauvegarde un texte ou un média en message privé",

  async execute(sock, message) {
    const { reply, raw } = message;
    const selfJid = sock.user.id;

    try {
      const quoted =
        raw.message?.extendedTextMessage?.contextInfo?.quotedMessage || raw.message;

      if (!quoted) return reply(style.warn("Réponds à un message, média ou sticker avec .save"));

      const type = Object.keys(quoted)[0];

      if (type === "conversation" || type === "extendedTextMessage") {
        const text = quoted.conversation || quoted.extendedTextMessage?.text || "Message vide";
        await sock.sendMessage(selfJid, { text: style.info(text, "Message sauvegardé") });
        return reply(style.ok("Le texte a été sauvegardé."));
      }

      const buffer = await downloadMediaMessage({ message: quoted }, "buffer", {}, { logger: console });
      let content = null;

      if (type === "imageMessage") content = { image: buffer, caption: "Image sauvegardée" };
      else if (type === "videoMessage") content = { video: buffer, caption: "Vidéo sauvegardée" };
      else if (type === "audioMessage") content = { audio: buffer, mimetype: "audio/mpeg", fileName: "saved_audio.mp3" };
      else if (type === "documentMessage") content = { document: buffer, fileName: quoted.documentMessage?.fileName || "saved_file" };
      else if (type === "stickerMessage") content = { sticker: buffer };
      else return reply(style.err("Ce type de média n'est pas supporté."));

      await sock.sendMessage(selfJid, content);
      await reply(style.ok("Le média a été sauvegardé avec succès."));
    } catch (err) {
      console.error("❌ save:", err);
      await reply(style.err("Impossible de sauvegarder ce contenu."));
    }
  }
};
