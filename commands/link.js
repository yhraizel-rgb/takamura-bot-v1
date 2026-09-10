// commands/link.js
import { style } from "../lib/style.js";

export default {
  name: "link",
  description: "Donne le lien d'invitation du groupe",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const code = await sock.groupInviteCode(from);
      await reply(style.ok(`https://chat.whatsapp.com/${code}`, "Lien du groupe"));
    } catch (err) {
      console.error("❌ link:", err);
      await reply(style.err("Impossible de récupérer le lien du groupe."));
    }
  }
};
