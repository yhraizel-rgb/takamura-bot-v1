// commands/promoteall.js
import "dotenv/config";
import { style } from "../lib/style.js";

export default {
  name: "promoteall",
  description: "Promeut tous les membres du groupe",

  async execute(sock, message) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants || [];

      const botJid = (sock?.user?.id?.split(":")[0] || "") + "@s.whatsapp.net";
      const ownerNumber = process.env.NUMBER?.replace(/\D/g, "");
      const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;

      const isAdmin = p => p?.admin === "admin" || p?.admin === "superadmin";

      const targets = participants
        .filter(p => p.id && !isAdmin(p) && p.id !== botJid && p.id !== ownerJid)
        .map(p => p.id);

      if (targets.length === 0) return reply(style.ok("Tous les membres sont déjà admins."));

      await sock.groupParticipantsUpdate(from, targets, "promote");

      await sock.sendMessage(
        from,
        { text: style.ok(`${targets.length} membre(s) promu(s) admin.`), mentions: targets },
        { quoted: raw }
      );
    } catch (err) {
      console.error("❌ promoteall:", err);
      await reply(style.err("Erreur lors de l'exécution."));
    }
  }
};
