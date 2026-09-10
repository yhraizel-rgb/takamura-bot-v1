// commands/kickall.js
import { style } from "../lib/style.js";

export default {
  name: "kickall",
  description: "Expulse tous les membres non-admins",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const metadata = await sock.groupMetadata(from);
      const botJid = sock.user.id;

      const targets = metadata.participants
        .filter(p => !p.admin && p.id !== botJid)
        .map(p => p.id);

      if (targets.length === 0) return reply(style.warn("Aucun membre à expulser."));

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        await sock.groupParticipantsUpdate(from, [t], "remove");
        await sock.sendMessage(from, {
          text: style.ok(`@${t.split("@")[0]} expulsé.`),
          mentions: [t]
        });
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 3000));
      }
    } catch (err) {
      console.error("❌ kickall:", err);
      await reply(style.err("Impossible d'expulser les membres. Vérifie mes permissions."));
    }
  }
};
