// commands/add.js
import { style } from "../lib/style.js";

export default {
  name: "add",
  description: "Ajoute un membre au groupe",

  async execute(sock, message, args) {
    const { from, reply, isGroup } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    const number = args[0]?.replace(/\D/g, "");
    if (!number) return reply(style.warn("Indique le numéro à ajouter.\nExemple : .add 2376XXXXXXXX"));

    const target = `${number}@s.whatsapp.net`;

    try {
      await sock.groupParticipantsUpdate(from, [target], "add");
      await sock.sendMessage(from, {
        text: style.ok(`@${target.split("@")[0]} a été ajouté au groupe.`),
        mentions: [target]
      });
    } catch (err) {
      console.error("❌ add:", err);
      await reply(style.err("Impossible d'ajouter ce membre. Vérifie mes permissions d'admin."));
    }
  }
};
