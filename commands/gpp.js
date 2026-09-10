// commands/gpp.js
import { style } from "../lib/style.js";

export default {
  name: "gpp",
  aliases: ["grouppp", "groupicon", "groupavatar"],
  description: "Révèle la photo de profil du groupe",

  async execute(sock, message) {
    const { from, reply, raw, isGroup } = message;

    if (!isGroup) return reply(style.err("Cette commande est réservée aux groupes."));

    try {
      let ppUrl;
      try {
        ppUrl = await sock.profilePictureUrl(from, "image");
      } catch {
        ppUrl = "https://files.catbox.moe/2yz2qu.jpg";
      }

      const metadata = await sock.groupMetadata(from);
      const captionText = style.ok(
        `👥 Nom : ${metadata.subject}\n📊 Membres : ${metadata.participants.length}`,
        "Photo du groupe"
      );

      await sock.sendMessage(from, { image: { url: ppUrl }, caption: captionText }, { quoted: raw });
    } catch (err) {
      console.error("❌ gpp:", err);
      await reply(style.err(`Impossible de récupérer la photo du groupe : ${err.message}`));
    }
  }
};
