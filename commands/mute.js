// commands/mute.js
import { style } from "../lib/style.js";

export default {
  name: "mute",
  description: "Restreint l'envoi de messages aux admins",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      await sock.groupSettingUpdate(from, "announcement");
      await reply(style.ok("Seuls les admins peuvent maintenant envoyer des messages.", "Groupe muté"));
    } catch (err) {
      console.error("❌ mute:", err);
      await reply(style.err("Impossible de muter le groupe. Vérifie mes permissions."));
    }
  }
};
