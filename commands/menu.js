import fs from "fs-extra";
import path from "path";

export default {
  name: "menu",
  description: "Afficher le menu complet",

  async execute(sock, message, args) {
    const { from, sender, isGroup, bots } = message;

    const bot = Array.from(bots?.values() || []).find(
      b => b.sock?.user?.id?.split(":")[0] === from.split("@")[0]
    );

    const chatType = isGroup ? "Groupe" : "Privé";
    const userName = sender ? sender.split("@")[0] : "Invité";
    const prefix = bot?.config?.prefix || ".";

    const menuText = `
┌─────────────────────────────┐
│       *TAKAMURA BOT V1*       │
└─────────────────────────────┘

*Utilisateur* : ${userName}
*Chat*        : ${chatType}
*Préfixe*     : ${prefix}

┌─────────────── GESTION DE GROUPE ───────────────┐
│ add
│ demote
│ demoteall
│ gpp
│ kick
│ kickall
│ left
│ link
│ mute
│ promote
│ promoteall
│ purge
│ resetlink
│ unmute
└───────────────────────────────────────────────┘

┌─────────────── TÉLÉCHARGEMENTS ───────────────┐
│ img
│ save
│ url
│ vv
└───────────────────────────────────────────────┘

┌─────────────── UTILITAIRES ───────────────┐
│ ping
│ owner
└───────────────────────────────────────────────┘

┌─────────────── MODÉRATION ───────────────┐
│ autorecording
│ autotyping
│ autoread
│ autoreact
│ welcome
│ bye
└───────────────────────────────────────────────┘

┌─────────────── MEDIA ───────────────┐
│ photo
│ setpp
│ take
│ pp
│ sticker
└───────────────────────────────────────────────┘

┌─────────────── TAGS ───────────────┐
│ tag
│ tagadmin
│ tagall
└───────────────────────────────────────────────┘

┌─────────────────────────────┐
│      *Dev par takamura*      │
└─────────────────────────────┘
`;

    try {
      const imagePath = path.join("./assets/menu.jpg");

      if (await fs.pathExists(imagePath)) {
        const imageBuffer = await fs.readFile(imagePath);
        await sock.sendMessage(from, {
          image: imageBuffer,
          caption: menuText
        });
      } else {
        await sock.sendMessage(from, { text: menuText });
      }

    } catch (e) {
      console.error("Erreur menu :", e);
      await sock.sendMessage(from, { text: menuText });
    }
  }
};
