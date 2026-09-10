// commands/setpp.js
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { style } from "../lib/style.js";

export default {
  name: "setpp",
  description: "Change la photo de profil du bot via une image citée",

  async execute(sock, message) {
    const { reply, quoted } = message;

    if (!quoted?.imageMessage) {
      return reply(style.warn("Réponds à une image avec .setpp pour changer la photo de profil du bot."));
    }

    try {
      const stream = await downloadContentFromMessage(quoted.imageMessage, "image");
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      await sock.updateProfilePicture(sock.user.id, buffer);
      await reply(style.ok("La photo de profil du bot a été mise à jour !"));
    } catch (err) {
      console.error("❌ setpp:", err);
      await reply(style.err("Impossible de changer la photo de profil."));
    }
  }
};
