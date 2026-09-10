// commands/unmute.js
import { style } from "../lib/style.js";

export default {
  name: "unmute",
  description: "Autorise à nouveau tout le monde à écrire",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      await sock.groupSettingUpdate(from, "not_announcement");
      await reply(style.ok("Tout le monde peut maintenant envoyer des messages.", "Groupe démuté"));
    } catch (err) {
      console.error("❌ unmute:", err);
      await reply(style.err("Impossible de démuter le groupe. Vérifie mes permissions."));
    }
  }
};
