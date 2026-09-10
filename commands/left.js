// commands/left.js
import { style } from "../lib/style.js";

export default {
  name: "left",
  description: "Fait quitter le bot du groupe",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      await sock.groupLeave(from);
    } catch (err) {
      console.error("❌ left:", err);
      await reply(style.err("Impossible de quitter le groupe."));
    }
  }
};
