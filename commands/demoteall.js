// commands/demoteall.js
import { style } from "../lib/style.js";

export default {
  name: "demoteall",
  description: "Rétrograde tous les admins, sauf le bot et la liste sudo",

  async execute(sock, message) {
    const { from, reply, raw, sender, isGroup, bots } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const groupMeta = await sock.groupMetadata(from);
      const participants = groupMeta.participants;

      const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
      const botLid = sock.user.lid ? sock.user.lid.split(":")[0] + "@lid" : "";

      // Liste sudo récupérée depuis la config du bot courant (passée via ctx.bots),
      // pas depuis une variable globale qui n'existe pas dans index.js.
      const botNumber = sock.user.id.split(":")[0];
      const sudoList = (bots?.get(botNumber)?.config?.sudoList || []).map(n => n.split("@")[0]);

      const toDemote = participants
        .filter(p =>
          p.admin &&
          p.id !== botJid &&
          p.id.split("@")[0] !== botLid.split("@")[0] &&
          !sudoList.includes(p.id.split("@")[0])
        )
        .map(p => p.id);

      if (toDemote.length === 0) return reply(style.warn("Aucun admin à rétrograder."));

      await sock.groupParticipantsUpdate(from, toDemote, "demote");
      await sock.sendMessage(from, { react: { text: "⬇️", key: raw.key } });

      await sock.sendMessage(from, {
        text: style.ok(
          `${toDemote.map(t => `@${t.split("@")[0]}`).join(", ")} rétrogradé(s).\nDemandé par @${sender.split("@")[0]}`
        ),
        mentions: [...toDemote, sender]
      });
    } catch (err) {
      console.error("❌ demoteall:", err);
      await reply(style.err("Impossible de rétrograder les admins. Vérifie mes permissions."));
    }
  }
};
