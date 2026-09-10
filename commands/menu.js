// commands/menu.js
import fs from "fs-extra";
import path from "path";
import { style } from "../lib/style.js";

const SECTIONS = {
  "Gestion de groupe": ["add", "demote", "demoteall", "gpp", "kick", "kickall", "left", "link", "mute", "promote", "promoteall", "purge", "resetlink"],
  "Téléchargements": ["img", "save"],
  "Utilitaires": ["owner"],
  "Médias": ["photo", "pp", "setpp"]
};

export default {
  name: "menu",
  description: "Affiche le menu complet du bot",

  async execute(sock, message) {
    const { from, sender, isGroup, bots } = message;

    const botNumber = sock.user.id.split(":")[0];
    const prefix = bots?.get(botNumber)?.config?.prefix || ".";
    const chatType = isGroup ? "Groupe" : "Privé";
    const userName = sender ? sender.split("@")[0] : "Invité";

    const body = [
      `Utilisateur : ${userName}`,
      `Chat : ${chatType}`,
      `Préfixe : ${prefix}`,
      "",
      ...Object.entries(SECTIONS).map(([title, cmds]) =>
        style.section(title, cmds.map(c => `${prefix}${c}`))
      )
    ].join("\n");

    const menuText = `${style.header("Console de commandes")}\n\n${body}`;

    try {
      const imagePath = path.join("./assets/menu.jpg");
      if (await fs.pathExists(imagePath)) {
        const imageBuffer = await fs.readFile(imagePath);
        await sock.sendMessage(from, { image: imageBuffer, caption: menuText });
      } else {
        await sock.sendMessage(from, { text: menuText });
      }
    } catch (err) {
      console.error("❌ menu:", err);
      await sock.sendMessage(from, { text: menuText });
    }
  }
};
