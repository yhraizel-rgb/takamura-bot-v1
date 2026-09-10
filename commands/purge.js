// commands/purge.js
import { style } from "../lib/style.js";

export default {
  name: "purge",
  description: "Expulse instantanément tous les non-admins",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const metadata = await sock.groupMetadata(from);
      const botJid = sock.user.id;

      const targets = metadata.participants
        .filter(p => !p.admin && p.id !== botJid)
        .map(p => p.id);

      if (targets.length === 0) return reply(style.warn("Aucun membre à purger."));

      await sock.groupParticipantsUpdate(from, targets, "remove");
      await sock.sendMessage(from, {
        text: style.ok(`${targets.map(t => `@${t.split("@")[0]}`).join(", ")} expulsé(s).`),
        mentions: targets
      });
    } catch (err) {
      console.error("❌ purge:", err);
      await reply(style.err("Impossible de purger les membres. Vérifie mes permissions."));
    }
  }
};
