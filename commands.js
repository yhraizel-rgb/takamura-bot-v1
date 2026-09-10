// commands.js
// ⚠️ Fichier fusionné — toutes les commandes sont regroupées ici.
// Chaque commande réagit avec 🐉 sur le message dès le début de son exécution,
// pour indiquer visuellement que le traitement est en cours.

import { downloadContentFromMessage, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import dotenv from "dotenv";
import axios from "axios";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import FormData from "form-data";

dotenv.config();

// Convertit un flux Baileys (downloadContentFromMessage) en Buffer complet.
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

// ───────────────────────────────────────────────
// Helper commun : réagit 🐉 sur le message d'origine
// dès que la commande commence à s'exécuter.
// Ne bloque jamais la commande si la réaction échoue.
// ───────────────────────────────────────────────
// Formate un texte en gras-italique façon WhatsApp (_*texte*_).
// Utilisé pour tous les messages de réponse envoyés directement via
// sock.sendMessage (les appels via reply() sont déjà stylés dans index.js).
function bi(text) {
  return `_*${text}*_`;
}

async function reactWorking(sock, message) {
  try {
    const key = message?.raw?.key;
    const jid = message?.from;
    if (key && jid) {
      await sock.sendMessage(jid, { react: { text: "🐉", key } });
    }
  } catch (_) {
    // silencieux : la réaction n'est qu'un indicateur visuel
  }
}

const commands = [

  // ========= add =========
  {
    name: "add",
    description: "Add user to group",
    async execute(sock, message, args) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ Group only");

      try {
        const number = args[0]?.replace(/\D/g, "");
        if (!number) return await reply("⚠️ Number required");

        const target = `${number}@s.whatsapp.net`;
        await sock.groupParticipantsUpdate(from, [target], "add");

        await sock.sendMessage(from, {
          text: bi(`✅ 𝙰𝚍𝚍𝚎𝚍 @${target.split("@")[0]} 𝚝𝚘 𝚐𝚛𝚘𝚞𝚙.`),
          mentions: [target]
        });

      } catch (err) {
        console.error("❌ Add error:", err);
        await reply("❌ Impossible to add this member. Check my permissions.");
      }
    }
  },

  // ========= gpp =========
  {
    name: "gpp",
    aliases: ["grouppp", "groupicon", "groupavatar"],
    description: "Révéler la photo de profil d’un groupe",
    async execute(sock, message) {
      const { from, reply, raw } = message;
      await reactWorking(sock, message);

      if (!from.endsWith("@g.us")) {
        return await reply("𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ❌ Commande réservée aux groupes.");
      }

      try {
        let ppUrl;
        try {
          ppUrl = await sock.profilePictureUrl(from, "image");
        } catch {
          ppUrl = "https://files.catbox.moe/2yz2qu.jpg";
        }

        const metadata = await sock.groupMetadata(from);

        const captionText = `𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜
👥 Nom : ${metadata.subject}
📊 Membres : ${metadata.participants.length}`;

        await sock.sendMessage(from, {
          image: { url: ppUrl },
          caption: captionText
        }, { quoted: raw });

      } catch (err) {
        console.error("❌ Erreur gpp :", err);
        await reply(`𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ❌ Impossible de récupérer la photo du groupe : ${err.message}`);
      }
    }
  },

  // ========= demote =========
  {
    name: "demote",
    description: "Demote admin to member",
    async execute(sock, message, args) {
      const { from, reply, isGroup, raw } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ Group only");

      try {
        const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

        let targets = [...mentioned];
        if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
        if (targets.length === 0) return await reply("⚠️ Mention or reply a user to demote");

        await sock.groupParticipantsUpdate(from, targets, "demote");

        await sock.sendMessage(from, {
          text: bi(`✅ 𝙳𝚎𝚖𝚘𝚝𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚝𝚘 𝚖𝚎𝚖𝚋𝚎𝚛.`),
          mentions: targets
        });

      } catch (err) {
        console.error("❌ Demote error:", err);
        await reply("❌ Impossible to demote. Check my permissions.");
      }
    }
  },

  // ========= demoteall =========
  {
    name: "demoteall",
    description: "𝙳𝚎𝚖𝚘𝚝𝚎 𝚊𝚕𝚕 𝚊𝚍𝚖𝚒𝚗𝚜 𝚎𝚡𝚌𝚎𝚙𝚝 𝚋𝚘𝚝, 𝚘𝚠𝚗𝚎𝚛𝚜, 𝚜𝚞𝚍𝚘 & 𝚋𝚘𝚝 𝙻𝙸𝙳",
    async execute(sock, message, args) {
      const { from, reply, raw, sender } = message;
      await reactWorking(sock, message);

      try {
        const groupMeta = await sock.groupMetadata(from);
        const participants = groupMeta.participants;

        const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
        const botLid = sock.user.lid?.split(":")[0] + "@lid" || "";

        const owners = global.owners || [];
        const sudoList = (global.bots?.get(botJid)?.config?.sudoList || []).map(n => n.split("@")[0]);

        const toDemote = participants
          .filter(p =>
            p.admin &&
            p.id !== botJid &&
            p.id.split("@")[0] !== botLid &&
            !owners.includes(p.id.split("@")[0]) &&
            !sudoList.includes(p.id.split("@")[0])
          )
          .map(p => p.id);

        if (toDemote.length === 0) {
          return await reply("⚠️ 𝙽𝚘 admins to demote.");
        }

        await sock.groupParticipantsUpdate(from, toDemote, "demote");
        await sock.sendMessage(from, { react: { text: "⬇️", key: raw.key } });

        const teks = `⬇️ 𝙳𝚎𝚖𝚘𝚝𝚎𝚍 ${toDemote.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚏𝚛𝚘𝚖 admin.\nRequested by: ${sender}`;
        await sock.sendMessage(from, { text: bi(teks), mentions: toDemote });

      } catch (err) {
        console.error("❌ demoteall error:", err);
        await reply("❌ Can't demote admins. Check my permissions.");
      }
    }
  },

  // ========= kick =========
  {
    name: "kick",
    description: "Kick user from group",
    async execute(sock, message, args) {
      const { from, reply, isGroup, raw } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ 𝙶𝚛𝚘𝚞𝚙 𝚘𝚗𝚕𝚢");

      try {
        const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

        let targets = [...mentioned];
        if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);

        if (targets.length === 0 && args[0]) {
          const phoneNumber = args[0].replace(/\D/g, "");
          if (phoneNumber.length < 8) return await reply("❌ Invalid phone number");
          targets.push(`${phoneNumber}@s.whatsapp.net`);
        }

        if (targets.length === 0) return await reply("⚠️ Mention or reply a user to kick");

        await sock.groupParticipantsUpdate(from, targets, "remove");

        await sock.sendMessage(from, {
          text: bi(`✅ 𝙺𝚒𝚌𝚔𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`),
          mentions: targets
        });

      } catch (err) {
        console.error("❌ Kick error:", err);
        await reply("❌ Impossible to kick these members. Check my permissions.");
      }
    }
  },

  // ========= kickall =========
  {
    name: "kickall",
    description: "Kick all non-admin members",
    async execute(sock, message) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ Group only");

      try {
        const metadata = await sock.groupMetadata(from);
        const botJid = sock.user.id;

        const targets = metadata.participants
          .filter(p => !p.admin && p.id !== botJid)
          .map(p => p.id);

        if (targets.length === 0) return await reply("⚠️ No members to kick");

        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          await sock.groupParticipantsUpdate(from, [t], "remove");
          await sock.sendMessage(from, {
            text: bi(`✅ 𝙺𝚒𝚌𝚔𝚎𝚍 @${t.split("@")[0]} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`),
            mentions: [t]
          });
          if (i < targets.length - 1) await new Promise(r => setTimeout(r, 3000));
        }

      } catch (err) {
        console.error("❌ KickAll error:", err);
        await reply("❌ Impossible to kick all. Check my permissions.");
      }
    }
  },

  // ========= promote =========
  {
    name: "promote",
    description: "Promote user to admin",
    async execute(sock, message, args) {
      const { from, reply, isGroup, raw } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ Group only");

      try {
        const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

        let targets = [...mentioned];
        if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
        if (targets.length === 0) return await reply("⚠️ Mention or reply a user to promote");

        await sock.groupParticipantsUpdate(from, targets, "promote");

        await sock.sendMessage(from, {
          text: bi(`✅ 𝙿𝚛𝚘𝚖𝚘𝚝𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚝𝚘 𝚊𝚍𝚖𝚒𝚗.`),
          mentions: targets
        });

      } catch (err) {
        console.error("❌ Promote error:", err);
        await reply("❌ Impossible to promote. Check my permissions.");
      }
    }
  },

  // ========= promoteall =========
  {
    name: "promoteall",
    description: "𝙿𝚛𝚘𝚖𝚘𝚝𝚎 𝚝𝚘𝚞𝚜 𝚕𝚎𝚜 𝚖𝚎𝚖𝚋𝚛𝚎𝚜 𝚍𝚞 𝚐𝚛𝚘𝚞𝚙𝚎",
    async execute(sock, message, args) {
      const { from, reply } = message;
      await reactWorking(sock, message);

      if (!from.endsWith("@g.us")) {
        return await reply("❌ 𝙲𝚘𝚖𝚖𝚊𝚗𝚍𝚎 𝚛é𝚜𝚎𝚛𝚟é𝚎 𝚊𝚞𝚡 𝚐𝚛𝚘𝚞𝚙𝚎𝚜.");
      }

      try {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants || [];

        const botJid =
          (sock?.user?.id?.split(":")[0] || sock?.user?.jid?.split(":")[0] || "") +
          "@s.whatsapp.net";

        const ownerNumber = process.env.NUMBER?.replace(/\D/g, "");
        const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;

        if (!ownerJid) {
          return await reply("⚠️ 𝙽𝚞𝚖é𝚛𝚘 𝚍𝚞 𝚙𝚛𝚘𝚙𝚛𝚒é𝚝𝚊𝚒𝚛𝚎 𝚗𝚘𝚗 𝚌𝚘𝚗𝚏𝚒𝚐𝚞𝚛é.");
        }

        const isAdmin = p =>
          p?.admin === "admin" || p?.admin === "superadmin";

        const targets = participants
          .filter(p => {
            const jid = p.id;
            return jid && !isAdmin(p) && jid !== botJid && jid !== ownerJid;
          })
          .map(p => p.id);

        if (targets.length === 0) {
          return await reply("✅ 𝚃𝚘𝚞𝚜 𝚕𝚎𝚜 𝚖𝚎𝚖𝚋𝚛𝚎𝚜 𝚜𝚘𝚗𝚝 𝚍é𝚓à 𝚊𝚍𝚖𝚒𝚗𝚜.");
        }

        await sock.groupParticipantsUpdate(from, targets, "promote");

        const text =
          `✅ 𝙿𝚛𝚘𝚖𝚘𝚝𝚒𝚘𝚗 𝚛é𝚞𝚜𝚜𝚒𝚎\n` +
          `𝙼𝚎𝚖𝚋𝚛𝚎𝚜 𝚙𝚛𝚘𝚖𝚞𝚜 : ${targets.length}`;

        await sock.sendMessage(
          from,
          { text: bi(text), mentions: targets },
          { quoted: message.raw }
        );

      } catch (err) {
        console.error("promoteall error:", err);
        await reply("❌ 𝙴𝚛𝚛𝚎𝚞𝚛 𝚕𝚘𝚛𝚜 𝚍𝚎 𝚕’𝚎𝚡é𝚌𝚞𝚝𝚒𝚘𝚗.");
      }
    }
  },

  // ========= mute =========
  {
    name: "mute",
    description: "🔇 Mute the group (only admins can send messages)",
    async execute(sock, message, args) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ This command works only in groups");

      try {
        await sock.groupSettingUpdate(from, "announcement");
        await reply("🔇 𝙶𝚛𝚘𝚞𝚙 muted: only admins can send messages");
      } catch (e) {
        console.error("Mute error:", e);
        await reply("❌ Cannot mute the group");
      }
    }
  },

  // ========= setpp =========
  {
    name: "setpp",
    description: "Changer la photo de profil du bot via une image citée",
    async execute(sock, message, args) {
      const { from, reply, raw } = message;
      await reactWorking(sock, message);

      const ctxInfo = raw.message?.extendedTextMessage?.contextInfo;

      if (!ctxInfo || !ctxInfo.quotedMessage?.imageMessage) {
        return await reply(
          "𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ⚠️ Réponds à une image pour changer la photo de profil du bot."
        );
      }

      try {
        const quoted = ctxInfo.quotedMessage.imageMessage;

        const stream = await downloadContentFromMessage(quoted, "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.updateProfilePicture(sock.user.id, buffer);

        await reply("𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ✅ La photo de profil du bot a été mise à jour !");
      } catch (err) {
        console.error("❌ Erreur setpp :", err);
        await reply("𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ❌ Impossible de changer la photo de profil.");
      }
    }
  },

  // ========= owner =========
  {
    name: "owner",
    description: "Envoie le contact des développeurs avec photo",
    async execute(sock, message, args) {
      await reactWorking(sock, message);
      try {
        const to = message.from || message.raw?.key?.remoteJid;
        if (!to) return;

        const vcardRaizel =
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          'FN:RAIZEL\n' +
          'ORG:ROK XD;\n' +
          'TEL;type=CELL;type=VOICE;waid=237699777530:+237699777530\n' +
          'END:VCARD';

        const vcardKnut =
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          'FN:KNUT\n' +
          'ORG:ROK XD;\n' +
          'TEL;type=CELL;type=VOICE;waid=237673941535:+237673941535\n' +
          'END:VCARD';

        const ppRaizel = (await axios.get("https://files.catbox.moe/l4o82h.jpg", { responseType: "arraybuffer" })).data;
        const ppKnut = (await axios.get("https://files.catbox.moe/harwbb.jpg", { responseType: "arraybuffer" })).data;

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
        await sock.sendMessage(message.from || message.raw?.key?.remoteJid, { text: bi("❌ Une erreur est survenue.") });
      }
    }
  },

  // ========= photo =========
  {
    name: "photo",
    description: "𝚂𝚝𝚒𝚌𝚔𝚎𝚛 𝚝𝚘 𝚒𝚖𝚊𝚐𝚎",
    async execute(sock, message) {
      const { from, reply, quoted } = message;
      await reactWorking(sock, message);

      try {
        if (!quoted?.message?.stickerMessage) {
          return await reply("❌ 𝚁𝚎𝚙𝚕𝚢 𝚝𝚘 𝚜𝚝𝚒𝚌𝚔𝚎𝚛");
        }

        const stream = await downloadContentFromMessage(quoted.message.stickerMessage, "sticker");
        const chunks = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        await sock.sendMessage(from, {
          image: Buffer.concat(chunks)
        });

        await reply("✅");

      } catch {
        await reply("❌");
      }
    }
  },

  // ========= purge =========
  {
    name: "purge",
    description: "Remove all non-admin members instantly",
    async execute(sock, message) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ Group only");

      try {
        const metadata = await sock.groupMetadata(from);
        const botJid = sock.user.id;

        const targets = metadata.participants
          .filter(p => !p.admin && p.id !== botJid)
          .map(p => p.id);

        if (targets.length === 0) return await reply("⚠️ No members to purge");

        await sock.groupParticipantsUpdate(from, targets, "remove");

        const caption = bi(`✅ 𝙿𝚞𝚛𝚐𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`);

        try {
          const imageBuffer = await fs.readFile('./takamura.jpg');
          await sock.sendMessage(from, {
            image: imageBuffer,
            caption,
            mentions: targets
          });
        } catch (imgErr) {
          // Image absente : on retombe sur un message texte simple.
          await sock.sendMessage(from, { text: caption, mentions: targets });
        }

      } catch (err) {
        console.error("❌ Purge error:", err);
        await reply("❌ Impossible to purge members. Check my permissions.");
      }
    }
  },

  // ========= pp =========
  {
    name: "pp",
    description: "Récupère la photo de profil de plusieurs membres (reply/mention)",
    async execute(sock, message, args) {
      const { from, reply, raw, sender } = message;
      await reactWorking(sock, message);

      try {
        let targets = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;
        if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);

        if (targets.length === 0) targets.push(sender);

        const photos = [];
        const captions = [];

        for (const target of targets) {
          let ppUrl;
          try {
            ppUrl = await sock.profilePictureUrl(target, "image");
          } catch {
            ppUrl = null;
          }

          if (!ppUrl) {
            captions.push(`❌ Impossible de récupérer la photo de ${target.split("@")[0]}`);
            continue;
          }

          photos.push({ url: ppUrl });
          captions.push(`📸 ${target.split("@")[0]}`);
        }

        if (photos.length === 0) {
          await reply("❌ Aucune photo de profil disponible.");
          return;
        }

        const mediaMessages = photos.map((p, i) => ({
          image: { url: p.url },
          caption: captions[i]
        }));

        for (const media of mediaMessages) {
          await sock.sendMessage(from, media);
        }

      } catch (err) {
        console.error("❌ PP error:", err);
        await reply("❌ Une erreur est survenue lors de la récupération des photos.");
      }
    }
  },

  // ========= resetlink =========
  {
    name: "resetlink",
    description: "Réinitialise le lien du groupe actuel",
    async execute(sock, message, args) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      try {
        if (!isGroup) {
          return await reply("𝙲𝚘𝚖𝚖𝚊𝚗𝚍𝚎 𝚐𝚛𝚘𝚞𝚙𝚎 𝚞𝚗𝚒𝚚𝚞𝚎𝚖𝚎𝚗𝚝.");
        }

        await sock.groupRevokeInvite(from);

        await reply("𝙻𝚒𝚎𝚗 𝚍𝚞 𝚐𝚛𝚘𝚞𝚙𝚎 𝚛𝚎́𝚒𝚗𝚒𝚝𝚒𝚊𝚕𝚒𝚜𝚎́.");
      } catch (err) {
        console.error("❌ RESETLINK error:", err);
        await reply("𝙿𝚎𝚛𝚖𝚒𝚜𝚜𝚒𝚘𝚗𝚜 𝚒𝚗𝚜𝚞𝚏𝚏𝚒𝚜𝚊𝚗𝚝𝚎𝚜.");
      }
    }
  },

  // ========= save =========
  {
    name: "save",
    description: "Sauvegarde un texte ou un média en message privé",
    async execute(sock, message, args) {
      const { from, reply, isGroup, sender, raw } = message;
      await reactWorking(sock, message);
      const selfJid = sock.user.id;

      try {
        const quoted =
          raw.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
          raw.message;

        if (!quoted) {
          return await reply(
            "⚠️ 𝚁𝚎́𝚙𝚘𝚗𝚍𝚜 𝚊̀ 𝚞𝚗 𝚖𝚎𝚜𝚜𝚊𝚐𝚎, 𝚖𝚎́𝚍𝚒𝚊 𝚘𝚞 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚊𝚟𝚎𝚌 .𝚜𝚊𝚟𝚎"
          );
        }

        const type = Object.keys(quoted)[0];

        if (type === "conversation" || type === "extendedTextMessage") {
          const text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            "⚡ 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚟𝚒𝚍𝚎";

          await sock.sendMessage(selfJid, {
            text:
              "📜 𝙼𝚎𝚜𝚜𝚊𝚐𝚎 𝚂𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́\n\n" +
              "⚔️ 𝙲𝚘𝚗𝚝𝚎𝚗𝚞 : " +
              text,
          });

          await reply("✅ 𝙻𝚎 𝚝𝚎𝚡𝚝𝚎 𝚊 𝚎́𝚝𝚎́ 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́.");
          return;
        }

        const buffer = await downloadMediaMessage(
          { message: quoted },
          "buffer",
          {},
          { logger: console }
        );

        let content = {};

        if (type === "imageMessage") {
          content = { image: buffer, caption: "🖼️ 𝙸𝚖𝚊𝚐𝚎 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́𝚎" };
        } else if (type === "videoMessage") {
          content = { video: buffer, caption: "🎥 𝚅𝚒𝚍𝚎́𝚘 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́𝚎" };
        } else if (type === "audioMessage") {
          content = {
            audio: buffer,
            mimetype: "audio/mpeg",
            fileName: "saved_audio.mp3",
          };
        } else if (type === "documentMessage") {
          content = {
            document: buffer,
            fileName: quoted.documentMessage?.fileName || "saved_file",
          };
        } else if (type === "stickerMessage") {
          content = { sticker: buffer };
        } else {
          await reply(
            "❌ 𝙲𝚎 𝚝𝚢𝚙𝚎 𝚍𝚎 𝚖𝚎́𝚍𝚒𝚊 𝚗’𝚎𝚜𝚝 𝚙𝚊𝚜 𝚜𝚞𝚙𝚙𝚘𝚛𝚝𝚎́."
          );
          return;
        }

        await sock.sendMessage(selfJid, content);

        await reply("✅ 𝙻𝚎 𝚖𝚎́𝚍𝚒𝚊 𝚊 𝚎́𝚝𝚎́ 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎́ 𝚊𝚟𝚎𝚌 𝚜𝚞𝚌𝚌𝚎̀𝚜.");
      } catch (err) {
        console.error("❌ SAVE error:", err);
        await reply(
          "❌ 𝙸𝚖𝚙𝚘𝚜𝚜𝚒𝚋𝚕𝚎 𝚍𝚎 𝚜𝚊𝚞𝚟𝚎𝚐𝚊𝚛𝚍𝚎𝚛 𝚕𝚎 𝚌𝚘𝚗𝚝𝚎𝚗𝚞."
        );
      }
    }
  },

  // ========= link =========
  {
    name: "link",
    async execute(sock, message) {
      const { from, reply } = message;
      await reactWorking(sock, message);

      if (!from.endsWith("@g.us"))
        return reply("🔴 𝙶𝚛𝚘𝚞𝚙 𝚘𝚗𝚕𝚢");

      try {
        const code = await sock.groupInviteCode(from);
        reply(`🔗 𝙶𝚛𝚘𝚞𝚙 𝙻𝚒𝚗𝚔\nhttps://chat.whatsapp.com/${code}`);
      } catch {
        reply("🔴 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚐𝚎𝚝 𝚕𝚒𝚗𝚔");
      }
    }
  },

  // ========= left =========
  {
    name: "left",
    async execute(sock, message) {
      const { from, reply } = message;
      await reactWorking(sock, message);

      try {
        await sock.groupLeave(from);
      } catch {
        reply("🔴 𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚕𝚎𝚊𝚟𝚎");
      }
    }
  },

  // ========= img =========
  {
    name: "img",
    description: "Recherche et envoie des images depuis un mot-clé",
    category: "Images",
    async execute(sock, message, args, prefix = ".") {
      const { from, reply } = message;
      await reactWorking(sock, message);

      if (!args[0]) {
        return await reply(`⚠️ Utilisation : ${prefix}img <mot-clé> [nombre]\nExemples :\n• ${prefix}img naruto\n• ${prefix}img voiture 5`);
      }

      const lastArg = args[args.length - 1];
      const count = !isNaN(lastArg) ? Math.min(parseInt(lastArg), 10) : 5;
      const query = !isNaN(lastArg) ? args.slice(0, -1).join(" ") : args.join(" ");

      try {
        await sock.sendMessage(from, { text: bi(`🖼️ Recherche de ${count} image(s) pour : ${query}...\n⏳ Veuillez patienter...`) });

        const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
        const res = await fetch(bingUrl);
        const html = await res.text();

        const imageUrls = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)]
          .map(m => m[1])
          .filter(u => u.startsWith("http"));

        if (!imageUrls.length) {
          return await reply(`⚠️ Aucune image trouvée pour : *${query}*`);
        }

        const imagesToSend = imageUrls.slice(0, count);
        for (let i = 0; i < imagesToSend.length; i++) {
          try {
            const response = await fetch(imagesToSend[i]);
            const buffer = Buffer.from(await response.arrayBuffer());

            if (buffer.length < 5000) continue;

            await sock.sendMessage(from, {
              image: buffer,
              caption: `🖼️ ${query} (${i + 1}/${imagesToSend.length})`
            });

            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error("Erreur envoi image :", e.message);
          }
        }

        await sock.sendMessage(from, { text: bi(`✅ ${imagesToSend.length}/${count} image(s) envoyée(s) pour ${query}.`) });

      } catch (err) {
        console.error("❌ Img error:", err);
        await reply("❌ Une erreur est survenue lors de la recherche d'images.");
      }
    }
  },

  // ========= tagall =========
  {
    name: "tagall",
    description: "𝙰𝚏𝚏𝚒𝚌𝚑𝚎 𝚎𝚝 𝚖𝚎𝚗𝚝𝚒𝚘𝚗𝚗𝚎 𝚝𝚘𝚞𝚜 𝚕𝚎𝚜 𝚖𝚎𝚖𝚋𝚛𝚎𝚜",
    async execute(sock, message) {
      const { from, reply } = message;
      await reactWorking(sock, message);

      try {
        if (!from.endsWith('@g.us')) {
          return await reply("🟡 𝚁𝚎́𝚜𝚎𝚛𝚟𝚎́ 𝚊𝚞𝚡 𝚐𝚛𝚘𝚞𝚙𝚎𝚜");
        }

        await reply("⏳ 𝚁𝚎𝚌𝚎𝚗𝚜𝚎𝚖𝚎𝚗𝚝 𝚎𝚗 𝚌𝚘𝚞𝚛𝚜...");

        const start = Date.now();
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants || [];
        const mentions = participants.map(p => p.id);
        const latency = Date.now() - start;

        let membersList = "";
        const maxDisplay = 15;

        if (participants.length <= maxDisplay) {
          membersList = participants
            .map((p, i) => `➤ ${i + 1}. @${p.id.split("@")[0]}`)
            .join("\n");
        } else {
          membersList = participants
            .slice(0, maxDisplay)
            .map((p, i) => `➤ ${i + 1}. @${p.id.split("@")[0]}`)
            .join("\n");
          membersList += `\n... 𝚎𝚝 ${participants.length - maxDisplay} 𝚊𝚞𝚝𝚛𝚎𝚜`;
        }

        const caption = `🔊 *𝙰𝙿𝙿𝙴𝙻 𝙶𝙴𝙽𝙴𝚁𝙰𝙻*\n\n` +
                       `📊 𝚂𝚝𝚊𝚝𝚒𝚜𝚝𝚒𝚚𝚞𝚎𝚜 :\n` +
                       `┣ 👥 𝙼𝚎𝚖𝚋𝚛𝚎𝚜 : ${participants.length}\n` +
                       `┣ ⚡ 𝚃𝚎𝚖𝚙𝚜 : ${latency}𝚖𝚜\n` +
                       `┗ 📅 ${new Date().toLocaleDateString()}\n\n` +
                       `👤 𝙻𝚒𝚜𝚝𝚎 𝚍𝚎𝚜 𝚖𝚎𝚖𝚋𝚛𝚎𝚜 :\n${membersList}`;

        const imagePath = './takamura.jpg';
        const imageBuffer = await fs.readFile(imagePath);

        await sock.sendMessage(from, {
          image: imageBuffer,
          caption: caption,
          mentions: mentions
        });

      } catch (error) {
        console.error("Erreur tagall:", error);

        try {
          const groupMetadata = await sock.groupMetadata(from);
          const participants = groupMetadata.participants || [];
          const mentions = participants.map(p => p.id);

          const fallbackText = `🔊 *𝙰𝙿𝙿𝙴𝙻 𝙶𝙴𝙽𝙴𝚁𝙰𝙻*\n\n` +
                             `📊 𝚂𝚝𝚊𝚝𝚒𝚜𝚝𝚒𝚚𝚞𝚎𝚜 :\n` +
                             `┣ 👥 𝙼𝚎𝚖𝚋𝚛𝚎𝚜 : ${participants.length}\n` +
                             `┗ 📅 ${new Date().toLocaleDateString()}\n\n` +
                             `⚠️ 𝙸𝚖𝚊𝚐𝚎 𝚛𝚘𝚔.𝚓𝚙𝚐 𝚗𝚘𝚗 𝚝𝚛𝚘𝚞𝚟𝚎́𝚎`;

          await sock.sendMessage(from, {
            text: bi(fallbackText),
            mentions: mentions
          });
        } catch (fallbackError) {
          await reply("❌ 𝙴𝚛𝚛𝚎𝚞𝚛 𝚍𝚎 𝚛𝚎𝚌𝚎𝚗𝚜𝚎𝚖𝚎𝚗𝚝");
        }
      }
    }
  },

  // ========= tagadmin =========
  {
    name: "tagadmin",
    aliases: ["admins", "admin", "tagadmins"],
    description: "Mentionne tous les administrateurs du groupe",
    async execute(sock, message) {
      const { from, reply } = message;
      await reactWorking(sock, message);

      try {
        if (!from.endsWith('@g.us')) {
          return await reply("🟡 Réservé aux groupes");
        }

        await reply("⏳ Recherche des administrateurs...");

        const start = Date.now();
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants || [];

        const admins = participants.filter(p =>
          p.admin === 'admin' || p.admin === 'superadmin'
        );

        const mentions = admins.map(p => p.id);
        const latency = Date.now() - start;

        if (admins.length === 0) {
          return await reply("❌ Aucun administrateur trouvé dans ce groupe");
        }

        const adminList = admins
          .map((p, i) => `➤ ${i + 1}. @${p.id.split("@")[0]}`)
          .join("\n");

        const caption = `⚡ *MENTION ADMINISTRATEURS*\n\n` +
                       `📊 Statistiques :\n` +
                       `├ 👑 Admins : ${admins.length}/${participants.length}\n` +
                       `├ ⚡ Temps : ${latency}ms\n` +
                       `└ 📅 ${new Date().toLocaleDateString()}\n\n` +
                       `🔧 Liste des administrateurs :\n${adminList}`;

        try {
          const imageBuffer = await fs.readFile('./takamura.jpg');

          await sock.sendMessage(from, {
            image: imageBuffer,
            caption: caption,
            mentions: mentions
          });

        } catch (imageError) {
          console.error("Erreur avec l'image:", imageError);

          await sock.sendMessage(from, {
            text: bi(caption),
            mentions: mentions
          });
        }

      } catch (error) {
        console.error("Erreur tagadmin:", error);
        await reply("❌ Erreur lors de la recherche des administrateurs");
      }
    }
  },

  // ========= tag =========
  {
    name: "tag",
    description: "Taguer tous les membres d’un groupe avec un message ou un média cité",
    async execute(sock, message, args) {
      const { from, reply, raw } = message;
      await reactWorking(sock, message);

      if (!from.endsWith("@g.us")) {
        return await reply("❌ Commande réservée aux groupes.");
      }

      try {
        const groupMetadata = await sock.groupMetadata(from);
        const mentions = groupMetadata.participants.map(p => p.id);

        const quotedMsg = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (quotedMsg) {
          const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
          if (text) return await sock.sendMessage(from, { text, mentions }, { quoted: raw });

          if (quotedMsg.imageMessage) {
            return await sock.sendMessage(from, { image: quotedMsg.imageMessage, mentions }, { quoted: raw });
          }

          if (quotedMsg.videoMessage) {
            return await sock.sendMessage(from, { video: quotedMsg.videoMessage, mentions }, { quoted: raw });
          }

          if (quotedMsg.stickerMessage) {
            return await sock.sendMessage(from, { sticker: quotedMsg.stickerMessage, mentions }, { quoted: raw });
          }

          if (quotedMsg.documentMessage) {
            return await sock.sendMessage(from, { document: quotedMsg.documentMessage, mentions }, { quoted: raw });
          }

          return await sock.sendMessage(from, { text: bi("❌ Type de message non supporté."), mentions }, { quoted: raw });
        }

        if (args.length) {
          return await sock.sendMessage(from, { text: bi(args.join(" ")), mentions }, { quoted: raw });
        }

        await sock.sendMessage(from, { text: bi("hey"), mentions }, { quoted: raw });

      } catch (err) {
        await reply(`❌ Erreur tag : ${err.message}`);
      }
    }
  },

  // ========= unmute =========
  {
    name: "unmute",
    description: "🔊 Unmute the group (everyone can send messages)",
    async execute(sock, message, args) {
      const { from, reply, isGroup } = message;
      await reactWorking(sock, message);

      if (!isGroup) return await reply("❌ This command works only in groups");

      try {
        await sock.groupSettingUpdate(from, "not_announcement");
        await reply("🔊 𝙶𝚛𝚘𝚞𝚙 unmuted: everyone can send messages");
      } catch (e) {
        console.error("Unmute error:", e);
        await reply("❌ Cannot unmute the group");
      }
    }
  },

  // ========= sticker =========
  {
    name: "sticker",
    description: "Transformer une image/vidéo en sceau démoniaque (sticker)",
    async execute(sock, message) {
      const { from, raw, reply, pushName } = message;
      await reactWorking(sock, message);

      try {
        const quoted = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const mediaMsg = quoted || raw.message;

        const type = mediaMsg.imageMessage ? "imageMessage" : mediaMsg.videoMessage ? "videoMessage" : null;
        if (!type) return await reply("𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ⚠️ Réponds ou envoie une image ou vidéo.");

        const stream = await downloadContentFromMessage(mediaMsg[type], type === "imageMessage" ? "image" : "video");
        const buffer = await streamToBuffer(stream);

        const sticker = new Sticker(buffer, { pack: "ROK", author: pushName || "XD", type: StickerTypes.FULL, quality: 80 });
        await sock.sendMessage(from, { sticker: await sticker.build() }, { quoted: raw });

      } catch (err) {
        await reply(`𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ❌ ${err.message}`);
      }
    }
  },

  // ========= take =========
  {
    name: "take",
    description: "Reprendre un sticker et le re-signer au nom d'Hadès",
    async execute(sock, message, args) {
      const { from, reply, isGroup, sender, raw } = message;
      await reactWorking(sock, message);

      try {
        const quotedSticker =
          raw.message?.extendedTextMessage?.contextInfo?.quotedMessage
            ?.stickerMessage;

        if (!quotedSticker) {
          return await reply(
            "⚔️ 𝚁𝚎́𝚙𝚘𝚗𝚍𝚜 𝚊̀ 𝚞𝚗 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚙𝚘𝚞𝚛 𝚚𝚞𝚎 𝚓𝚎 𝚕𝚎 𝚜𝚌𝚎𝚕𝚕𝚎 𝚜𝚘𝚞𝚜 𝚝𝚘𝚗 𝚗𝚘𝚖."
          );
        }

        const stream = await downloadContentFromMessage(
          quotedSticker,
          "sticker"
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const sticker = new Sticker(buffer, {
          pack: "",
          author: sender?.pushName || "ROK",
          type: StickerTypes.FULL,
          quality: 80,
        });

        await sock.sendMessage(
          from,
          { sticker: await sticker.build() },
          { quoted: raw }
        );

        await reply("✅ 𝙻𝚎 𝚜𝚝𝚒𝚌𝚔𝚎𝚛 𝚊 𝚎́𝚝𝚎́ 𝚛𝚎-𝚜𝚌𝚎𝚕𝚕𝚎́ 𝚊𝚟𝚎𝚌 𝚜𝚞𝚌𝚌𝚎̀𝚜.");
      } catch (err) {
        console.error("❌ TAKE error:", err);
        await reply(
          "☠️ 𝙴́𝚌𝚑𝚎𝚌 𝚍𝚎 𝚕𝚊 𝚛𝚎́𝚒𝚗𝚌𝚊𝚛𝚗𝚊𝚝𝚒𝚘𝚗 𝚍𝚞 𝚜𝚌𝚎𝚊𝚞."
        );
      }
    }
  },

  // ========= url =========
  {
    name: "url",
    description: "Génère une URL à partir d'une image, vidéo ou audio",
    async execute(sock, message) {
      const { from, raw, reply } = message;
      await reactWorking(sock, message);

      try {
        const quoted = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage || raw.message;
        const type = quoted.imageMessage ? "image" : quoted.videoMessage ? "video" : quoted.audioMessage ? "audio" : null;
        if (!type) return await reply("𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ⚠️ Réponds à un média.");

        const stream = await downloadContentFromMessage(quoted[`${type}Message`], type);
        const buffer = await streamToBuffer(stream);

        const tempDir = "./temp"; fs.mkdirSync(tempDir, { recursive: true });
        const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3";
        const filePath = path.join(tempDir, `media_${Date.now()}.${ext}`);
        fs.writeFileSync(filePath, buffer);

        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", fs.createReadStream(filePath));

        const url = (await axios.post("https://catbox.moe/user/api.php", form, { headers: form.getHeaders() })).data;
        fs.unlinkSync(filePath);

        await reply(`𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 🔗 ${url}`);
      } catch (err) {
        await reply(`𝙵𝚊𝚒𝚕𝚎𝚍 𝚝𝚘 𝚜𝚎𝚊𝚛𝚌𝚑 𝚏𝚘𝚛 𝚒𝚖𝚊𝚐𝚎𝚜 ❌ ${err.message}`);
      }
    }
  },

  // ========= vv =========
  {
    name: "vv",
    description: "Récupère le média vue unique",
    async execute(sock, message, args) {
      const msg = message.raw;
      const from = msg.key.remoteJid;
      await reactWorking(sock, message);

      try {
        const context = msg.message?.extendedTextMessage?.contextInfo;

        if (!context?.quotedMessage) {
          return await sock.sendMessage(from, {
            text: "```⚠️ Réponds à une photo, vidéo ou audio vue unique.```"
          });
        }

        const quoted =
          context.quotedMessage.viewOnceMessageV2?.message ||
          context.quotedMessage.viewOnceMessageV2Extension?.message ||
          context.quotedMessage.ephemeralMessage?.message ||
          context.quotedMessage;

        if (quoted.imageMessage) {
          const stream = await downloadContentFromMessage(
            quoted.imageMessage,
            "image"
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream)
            buffer = Buffer.concat([buffer, chunk]);

          await sock.sendMessage(from, {
            image: buffer,
            caption: "```📸 Vue unique désactivée```"
          }, { quoted: msg });

          await sock.sendMessage(from, {
            react: { text: "📸", key: msg.key }
          });
          return;
        }

        if (quoted.videoMessage) {
          const stream = await downloadContentFromMessage(
            quoted.videoMessage,
            "video"
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream)
            buffer = Buffer.concat([buffer, chunk]);

          await sock.sendMessage(from, {
            video: buffer,
            caption: "```🎥 Vue unique désactivée```"
          }, { quoted: msg });

          await sock.sendMessage(from, {
            react: { text: "🎥", key: msg.key }
          });
          return;
        }

        if (quoted.audioMessage) {
          const stream = await downloadContentFromMessage(
            quoted.audioMessage,
            "audio"
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream)
            buffer = Buffer.concat([buffer, chunk]);

          await sock.sendMessage(from, {
            audio: buffer,
            mimetype: "audio/mp4",
            ptt: quoted.audioMessage.ptt || false
          }, { quoted: msg });

          await sock.sendMessage(from, {
            react: { text: "🎵", key: msg.key }
          });
          return;
        }

        await sock.sendMessage(from, {
          text: "```❌ Ce message n’est pas un média vue unique.```"
        });

      } catch (e) {
        console.error("❌ Erreur vv :", e);
        await sock.sendMessage(from, {
          text: "```❌ Erreur lors de la récupération du média.```"
        });
      }
    }
  },

  // ========= menu =========
  {
    name: "menu",
    description: "Afficher le menu complet",
    async execute(sock, message, args) {
      const { from, sender, isGroup, bots } = message;
      await reactWorking(sock, message);

      const bot = Array.from(bots?.values() || []).find(
        b => b.sock?.user?.id?.split(":")[0] === from.split("@")[0]
      );

      const chatType = isGroup ? "Groupe" : "Privé";
      const userName = sender ? sender.split("@")[0] : "Invité";
      const prefix = bot?.config?.prefix || ".";

      const menuText = `
┌─────────────────────────────┐
│         *MR.SAMY BOT*         │
└─────────────────────────────┘

*Utilisateur* : ${userName}
*Chat*        : ${chatType}
*Préfixe*     : ${prefix}

┌─────────────── GESTION DE GROUPE ───────────────┐
│ add
│ demote
│ demoteall
│ desc
│ gpp
│ infosgroups
│ invite
│ kick
│ kickall
│ left
│ link
│ manga
│ mute
│ online
│ promote
│ promoteall
│ purge
│ resetlink
│ unmute
└───────────────────────────────────────────────┘

┌─────────────── TÉLÉCHARGEMENTS ───────────────┐
│ apk
│ down-url
│ img
│ save
│ telegram-sticker
│ tiktok
│ toaudio
│ url
│ vv
└───────────────────────────────────────────────┘

┌─────────────── UTILITAIRES ───────────────┐
│ ai
│ news
│ weather
│ checkban
│ country
│ delete
│ device
│ dico
│ infos
│ meteo
│ ping
│ owner
└───────────────────────────────────────────────┘

┌─────────────── MODÉRATION ───────────────┐
│ block
│ unblock
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
│ principal
│ tag
│ tagadmin
│ tagall
└───────────────────────────────────────────────┘

┌─────────────────────────────┐
│   *Développé par MR._SAMY TOUT MIGNON *     │
└─────────────────────────────┘
`;

      try {
        const imagePath = path.join("./takamura.jpg");

        if (await fs.pathExists(imagePath)) {
          const imageBuffer = await fs.readFile(imagePath);
          await sock.sendMessage(from, {
            image: imageBuffer,
            caption: menuText
          });
        } else {
          await sock.sendMessage(from, { text: bi(menuText) });
        }

      } catch (e) {
        console.error("Erreur menu :", e);
        await sock.sendMessage(from, { text: bi(menuText) });
      }
    }
  }

];

export default commands;
