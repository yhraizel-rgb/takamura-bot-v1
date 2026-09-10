// commands/kick.js
import { style } from "../lib/style.js";

export default {
  name: "kick",
  description: "Expulse un membre du groupe",

  async execute(sock, message, args) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

      const targets = [...mentioned];
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);

      if (targets.length === 0 && args[0]) {
        const phoneNumber = args[0].replace(/\D/g, "");
        if (phoneNumber.length < 8) return reply(style.err("Numéro invalide."));
        targets.push(`${phoneNumber}@s.whatsapp.net`);
      }

      if (targets.length === 0) return reply(style.warn("Mentionne ou réponds à un membre à expulser."));

      await sock.groupParticipantsUpdate(from, targets, "remove");
      await sock.sendMessage(from, {
        text: style.ok(`${targets.map(t => `@${t.split("@")[0]}`).join(", ")} expulsé(s).`),
        mentions: targets
      });
    } catch (err) {
      console.error("❌ kick:", err);
      await reply(style.err("Impossible d'expulser ce membre. Vérifie mes permissions."));
    }
  }
};
