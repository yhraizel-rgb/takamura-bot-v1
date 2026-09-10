// commands/pp.js
import { style } from "../lib/style.js";

export default {
  name: "pp",
  description: "Récupère la photo de profil d'un ou plusieurs membres",

  async execute(sock, message) {
    const { from, reply, raw, sender } = message;

    try {
      let targets = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
      if (targets.length === 0) targets = [sender];

      let sent = 0;

      for (const target of targets) {
        let ppUrl;
        try {
          ppUrl = await sock.profilePictureUrl(target, "image");
        } catch {
          ppUrl = null;
        }

        if (!ppUrl) {
          await sock.sendMessage(from, { text: style.err(`Aucune photo disponible pour @${target.split("@")[0]}`), mentions: [target] });
          continue;
        }

        await sock.sendMessage(from, { image: { url: ppUrl }, caption: `📸 @${target.split("@")[0]}`, mentions: [target] });
        sent++;
      }

      if (sent === 0) await reply(style.err("Aucune photo de profil n'a pu être récupérée."));
    } catch (err) {
      console.error("❌ pp:", err);
      await reply(style.err("Une erreur est survenue lors de la récupération des photos."));
    }
  }
};
