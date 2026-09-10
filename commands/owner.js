// commands/owner.js
// Utilise node-fetch (déjà présent dans package.json) plutôt qu'axios,
// qui n'était pas listé comme dépendance et aurait fait planter la commande.
import fetch from "node-fetch";

export default {
  name: "owner",
  description: "Envoie le contact des développeurs",

  async execute(sock, message) {
    const { from, reply } = message;

    try {
      const vcardRaizel =
        "BEGIN:VCARD\n" +
        "VERSION:3.0\n" +
        "FN:RAIZEL\n" +
        "ORG:ROK XD;\n" +
        "TEL;type=CELL;type=VOICE;waid=237699777530:+237699777530\n" +
        "END:VCARD";

      const vcardKnut =
        "BEGIN:VCARD\n" +
        "VERSION:3.0\n" +
        "FN:KNUT\n" +
        "ORG:ROK XD;\n" +
        "TEL;type=CELL;type=VOICE;waid=237673941535:+237673941535\n" +
        "END:VCARD";

      const [ppRaizel, ppKnut] = await Promise.all([
        fetch("https://files.catbox.moe/l4o82h.jpg").then(r => r.arrayBuffer()).then(Buffer.from),
        fetch("https://files.catbox.moe/harwbb.jpg").then(r => r.arrayBuffer()).then(Buffer.from)
      ]);

      await sock.sendMessage(from, {
        contacts: {
          displayName: "ROK XD Developers",
          contacts: [
            { vcard: vcardRaizel, jpegThumbnail: ppRaizel },
            { vcard: vcardKnut, jpegThumbnail: ppKnut }
          ]
        }
      });
    } catch (err) {
      console.error("❌ owner:", err);
      await reply("❌ Une erreur est survenue.");
    }
  }
};
