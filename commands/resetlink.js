// commands/resetlink.js
import { style } from "../lib/style.js";

export default {
  name: "resetlink",
  description: "Réinitialise le lien d'invitation du groupe",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      await sock.groupRevokeInvite(from);
      await reply(style.ok("Le lien du groupe a été réinitialisé."));
    } catch (err) {
      console.error("❌ resetlink:", err);
      await reply(style.err("Permissions insuffisantes pour réinitialiser le lien."));
    }
  }
};
