// commands/vv.js
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

export default {
  name: "vv",
  description: "Récupère un média en vue unique",

  async execute(sock, message) {
    const msg = message.raw;
    const from = msg.key.remoteJid;

    try {
      const context = msg.message?.extendedTextMessage?.contextInfo;

      if (!context?.quotedMessage) {
        return sock.sendMessage(from, { text: style.warn("Réponds à une photo, vidéo ou audio en vue unique.") });
      }

      const quoted =
        context.quotedMessage.viewOnceMessageV2?.message ||
        context.quotedMessage.viewOnceMessageV2Extension?.message ||
        context.quotedMessage.ephemeralMessage?.message ||
        context.quotedMessage;

      if (quoted.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(from, { image: buffer, caption: style.ok("Vue unique désactivée") }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "📸", key: msg.key } });
        return;
      }

      if (quoted.videoMessage) {
        const stream = await downloadContentFromMessage(quoted.videoMessage, "video");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(from, { video: buffer, caption: style.ok("Vue unique désactivée") }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "🎥", key: msg.key } });
        return;
      }

      if (quoted.audioMessage) {
        const stream = await downloadContentFromMessage(quoted.audioMessage, "audio");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mp4",
          ptt: quoted.audioMessage.ptt || false
        }, { quoted: msg });
        await sock.sendMessage(from, { react: { text: "🎵", key: msg.key } });
        return;
      }

      await sock.sendMessage(from, { text: style.err("Ce message n'est pas un média en vue unique.") });
    } catch (err) {
      console.error("❌ vv:", err);
      await sock.sendMessage(from, { text: style.err("Erreur lors de la récupération du média.") });
    }
  }
};
