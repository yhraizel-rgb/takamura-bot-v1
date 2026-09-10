// commands/promote.js
import { style } from "../lib/style.js";

export default {
  name: "promote",
  description: "Promeut un membre admin",

  async execute(sock, message) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

      const targets = [...mentioned];
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
      if (targets.length === 0) return reply(style.warn("Mentionne ou réponds à un membre à promouvoir."));

      await sock.groupParticipantsUpdate(from, targets, "promote");

      await sock.sendMessage(from, {
        text: style.ok(`${targets.map(t => `@${t.split("@")[0]}`).join(", ")} promu(s) admin.`),
        mentions: targets
      });
    } catch (err) {
      console.error("❌ promote:", err);
      await reply(style.err("Impossible de promouvoir ce membre. Vérifie mes permissions."));
    }
  }
};
