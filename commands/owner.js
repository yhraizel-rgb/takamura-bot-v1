import axios from "axios";

export default {
  name: "owner",
  description: "Envoie le contact des développeurs avec photo",

  async execute(sock, msg, args) {
    try {
      // Vérifie d’où envoyer le message
      const to = msg.from || msg.key?.remoteJid;
      if (!to) return;

      // VCARD de RAIZEL
      const vcardRaizel =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:RAIZEL\n' +
        'ORG:ROK XD;\n' +
        'TEL;type=CELL;type=VOICE;waid=237699777530:+237699777530\n' +
        'END:VCARD';

      // VCARD de KNUT
      const vcardKnut =
        'BEGIN:VCARD\n' +
        'VERSION:3.0\n' +
        'FN:KNUT\n' +
        'ORG:ROK XD;\n' +
        'TEL;type=CELL;type=VOICE;waid=237673941535:+237673941535\n' +
        'END:VCARD';

      // Télécharger les images depuis les URL
      const ppRaizel = (await axios.get("https://files.catbox.moe/l4o82h.jpg", { responseType: "arraybuffer" })).data;
      const ppKnut = (await axios.get("https://files.catbox.moe/harwbb.jpg", { responseType: "arraybuffer" })).data;

      // Envoi des deux contacts avec photo
      await sock.sendMessage(to, {
        contacts: {
          displayName: "_*ROK XD Developers*_",
          contacts: [
            { vcard: vcardRaizel, jpegThumbnail: ppRaizel },
            { vcard: vcardKnut, jpegThumbnail: ppKnut }
          ]
        }
      });

    } catch (err) {
      console.error("Erreur commande owner:", err);
      await sock.sendMessage(msg.from || msg.key?.remoteJid, { text: "❌ Une erreur est survenue." });
    }
  }
};