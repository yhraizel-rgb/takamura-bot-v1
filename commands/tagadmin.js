// commands/tagadmin.js
import fs from "fs-extra";
import { style, bi } from "../lib/style.js";

export default {
  name: "tagadmin",
  aliases: ["admins", "admin", "tagadmins"],
  description: "Mentionne tous les administrateurs du groupe",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;

    if (!isGroup) return reply(style.warn("Cette commande est réservée aux groupes."));

    try {
      const start = Date.now();
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants || [];

      const admins = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
      const mentions = admins.map(p => p.id);
      const latency = Date.now() - start;

      if (admins.length === 0) return reply(style.err("Aucun administrateur trouvé dans ce groupe."));

      const adminList = admins.map((p, i) => `➤ ${i + 1}. @${p.id.split("@")[0]}`).join("\n");

      const caption = bi(
        `MENTION ADMINISTRATEURS\n\n` +
        `Statistiques :\n` +
        `├ Admins : ${admins.length}/${participants.length}\n` +
        `├ Temps : ${latency}ms\n` +
        `└ ${new Date().toLocaleDateString()}\n\n` +
        `Liste des administrateurs :\n${adminList}`
      );

      try {
        const imageBuffer = await fs.readFile("./assets/menu.jpg");
        await sock.sendMessage(from, { image: imageBuffer, caption, mentions });
      } catch (imageError) {
        console.error("Erreur avec l'image:", imageError);
        await sock.sendMessage(from, { text: caption, mentions });
      }
    } catch (err) {
      console.error("❌ tagadmin:", err);
      await reply(style.err("Erreur lors de la recherche des administrateurs."));
    }
  }
};
