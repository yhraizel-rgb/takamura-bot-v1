// commands/save.js
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: "save",
  description: "Sauvegarde un texte ou un média en message privé",

  async execute(sock, message, args) {
    const { from, reply, isGroup, sender, raw } = message;
    const selfJid = sock.user.id;

    try {
      // 📌 Message ciblé (reply ou direct)
      const quoted =
        raw.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        raw.message;

      if (!quoted) {
        return await reply(
          "⚠️ 𝚁𝚎́𝚙𝚘𝚗𝚍𝚜 𝚊̀ 𝚞𝚗 𝚖𝚎𝚜𝚜𝚊𝚐𝚎, 𝚖𝚎́𝚍𝚒𝚊 𝚘𝚞 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚊𝚟𝚎𝚌 .𝚜𝚊𝚟𝚎"
        );
      }

      const type = Object.keys(quoted)[0];

      // ========= TEXTE =========
      if (type === "conversation" || type === "extendedTextMessage") {
        const text =
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          "⚡ 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚟𝚒𝚍𝚎";

        await sock.sendMessage(selfJid, {
          text:
            "📜 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚂𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́\n\n" +
            "⚔️ 𝙲𝚘𝚗𝚝𝚎𝚗𝚞 : " +
            text,
        });

        await reply("✅ 𝙻𝚎 𝚝𝚎𝚡𝚝𝚎 𝚊 𝚎́𝚝𝚎́ 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́.");
        return;
      }

      // ========= MÉDIAS =========
      const buffer = await downloadMediaMessage(
        { message: quoted },
        "buffer",
        {},
        { logger: console }
      );

      let content = {};

      if (type === "imageMessage") {
        content = { image: buffer, caption: "🖼️ 𝙸𝚖𝚊𝚐𝚎 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́𝚎" };
      } else if (type === "videoMessage") {
        content = { video: buffer, caption: "🎥 𝚅𝚒𝚍𝚎́𝚘 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́𝚎" };
      } else if (type === "audioMessage") {
        content = {
          audio: buffer,
          mimetype: "audio/mpeg",
          fileName: "saved_audio.mp3",
        };
      } else if (type === "documentMessage") {
        content = {
          document: buffer,
          fileName: quoted.documentMessage?.fileName || "saved_file",
        };
      } else if (type === "stickerMessage") {
        content = { sticker: buffer };
      } else {
        await reply(
          "❌ 𝙲𝚎 𝚝𝚢𝚙𝚎 𝚍𝚎 𝚖𝚎́𝚍𝚒𝚊 𝚗’𝚎𝚜𝚝 𝚙𝚊𝚜 𝚜𝚞𝚙𝚙𝚘𝚛𝚝𝚎́."
        );
        return;
      }

      // 📥 Envoi privé
      await sock.sendMessage(selfJid, content);

      await reply("✅ 𝙻𝚎 𝚖𝚎́𝚍𝚒𝚊 𝚊 𝚎́𝚝𝚎́ 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́ 𝚊𝚟𝚎𝚌 𝚜𝚞𝚌𝚌𝚎̀𝚜.");
    } catch (err) {
      console.error("❌ SAVE error:", err);
      await reply(
        "❌ 𝙸𝚖𝚙𝚘𝚜𝚜𝚒𝚋𝚕𝚎 𝚍𝚎 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎𝚛 𝚕𝚎 𝚌𝚘𝚗𝚝𝚎𝚗𝚞."
      );
    }
  }
};
