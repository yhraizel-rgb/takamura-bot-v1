// commands/demote.js
import { style } from "../lib/style.js";

export default {
  name: "demote",
  description: "Rétrograde un admin en membre",

  async execute(sock, message) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

      const targets = [...mentioned];
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
      if (targets.length === 0) return reply(style.warn("Mentionne ou réponds à un membre à rétrograder."));

      await sock.groupParticipantsUpdate(from, targets, "demote");

      await sock.sendMessage(from, {
        text: style.ok(`${targets.map(t => `@${t.split("@")[0]}`).join(", ")} rétrogradé(s) au rang de membre.`),
        mentions: targets
      });
    } catch (err) {
      console.error("❌ demote:", err);
      await reply(style.err("Impossible de rétrograder ce membre. Vérifie mes permissions d'admin."));
    }
  }
};
