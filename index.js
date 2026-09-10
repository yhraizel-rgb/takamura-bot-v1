import express from "express";
import fs from "fs-extra";
import path from "path";
import pino from "pino";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import chalk from "chalk";

import {
  makeWASocket,
  useMultiFileAuthState,
  Browsers,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} from "@whiskeysockets/baileys";

// ──────────────────────────────────────────────────────────────
// Filets de sécurité globaux : une erreur non interceptée dans le
// handler d'un numéro ne doit JAMAIS faire planter tout le process
// (donc jamais faire tomber les autres sessions en même temps).
// ──────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error(chalk.red(`[FATAL] Exception non interceptée : ${err?.stack || err}`));
});
process.on("unhandledRejection", (reason) => {
  console.error(chalk.red(`[FATAL] Rejet de promesse non géré : ${reason}`));
});

const app = express();
const PORT = process.env.PORT || 80;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PAIRING_DIR = "./sessions";
await fs.ensureDir(PAIRING_DIR);
const bots = new Map();

// Nombre maximum de sessions (numéros) pouvant être enregistrées en même temps.
const MAX_SESSIONS = 20;

// Liens à rejoindre automatiquement dès qu'un numéro se connecte.
const AUTO_JOIN_GROUP_LINKS = [
  "https://chat.whatsapp.com/Lq7MwZ7IBpyEa46zX50yWR"
];
const AUTO_JOIN_CHANNEL_LINKS = [
  "https://whatsapp.com/channel/0029VbDZMQBFCCoTkkAe5i2X"
];

function formatNumber(num) {
  return String(num).replace(/\D/g, "").replace(/^0+/, "");
}

async function removeSession(dir) {
  if (await fs.pathExists(dir)) await fs.remove(dir);
}

// Compte le nombre de dossiers de session déjà enregistrés sur le disque.
async function countSessions() {
  await fs.ensureDir(PAIRING_DIR);
  const entries = await fs.readdir(PAIRING_DIR);
  let count = 0;
  for (const entry of entries) {
    const stat = await fs.stat(path.join(PAIRING_DIR, entry)).catch(() => null);
    if (stat?.isDirectory()) count++;
  }
  return count;
}

function extractGroupInviteCode(link) {
  const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

function extractChannelId(link) {
  const match = link.match(/channel\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

// Fait rejoindre au numéro connecté le groupe et le canal définis ci-dessus.
// Si le bot est déjà membre / déjà abonné, on ne retente rien (évite les
// erreurs inutiles). Chaque échec réel est simplement journalisé, il ne
// bloque jamais le démarrage du bot et n'impacte pas les autres sessions.
async function autoJoinLinks(sock, number) {
  const botJid = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";

  for (const link of AUTO_JOIN_GROUP_LINKS) {
    const code = extractGroupInviteCode(link);
    if (!code) continue;
    try {
      // On vérifie d'abord si le bot fait déjà partie du groupe.
      let alreadyMember = false;
      try {
        const info = await sock.groupGetInviteInfo(code);
        alreadyMember = info?.participants?.some(p => p.id === botJid) || false;
      } catch {
        // Si l'info d'invitation ne peut pas être récupérée, on tente quand même.
      }

      if (alreadyMember) {
        console.log(chalk.gray(`[JOIN] ${number} est déjà dans le groupe (${code})`));
        continue;
      }

      await sock.groupAcceptInvite(code);
      console.log(chalk.green(`[JOIN] ${number} a rejoint le groupe (${code})`));
    } catch (e) {
      console.log(chalk.yellow(`[JOIN] Groupe ${code} pour ${number} : ${e.message}`));
    }
  }

  for (const link of AUTO_JOIN_CHANNEL_LINKS) {
    const id = extractChannelId(link);
    if (!id) continue;
    try {
      const jid = `${id}@newsletter`;
      await sock.newsletterFollow(jid);
      console.log(chalk.green(`[JOIN] ${number} suit le canal (${id})`));
    } catch (e) {
      // Inclut le cas "déjà abonné" selon les versions de Baileys : on log et on continue.
      console.log(chalk.yellow(`[JOIN] Canal ${id} pour ${number} : ${e.message}`));
    }
  }
}

// Ferme proprement un socket existant avant d'en recréer un nouveau,
// pour éviter d'avoir deux connexions WhatsApp actives sur le même numéro.
async function closeExistingSocket(bot) {
  if (!bot?.sock) return;
  try {
    bot.sock.ev.removeAllListeners();
    bot.sock.end?.(undefined);
  } catch (_) {
    // socket déjà fermé, on ignore
  }
}

async function loadCommands() {
  const commands = new Map();
  const folder = "./commands";
  await fs.ensureDir(folder);

  if (fs.existsSync(folder)) {
    for (const file of fs.readdirSync(folder).filter(f => f.endsWith(".js"))) {
      try {
        const cmd = await import(`./commands/${file}?v=${Date.now()}`);
        if (cmd.default?.name && typeof cmd.default.execute === "function") {
          commands.set(cmd.default.name.toLowerCase(), cmd.default);
        }
      } catch (e) {
        console.log(chalk.red(`[CMD] ${file} : ${e.message}`));
      }
    }
  }
  return commands;
}

async function startBot(inputNumber) {
  const number = formatNumber(inputNumber);
  if (!number || number.length < 8) throw new Error("Numéro invalide");

  if (bots.has(number)) {
    const existing = bots.get(number);
    // On ne se fie plus à authState.creds.registered seul : avec les versions
    // récentes de Baileys (7.0.0-rc13/rc14), ce flag peut passer à true
    // localement avant même que WhatsApp ait confirmé la liaison côté serveur
    // (bug connu : https://github.com/WhiskeySockets/Baileys/issues/2737).
    // Seul un événement connection.update === "open" prouve une vraie connexion.
    if (existing?.linked) return null;
    // Un socket existe déjà mais n'est pas réellement lié : on le ferme
    // avant d'en recréer un, pour éviter les doublons.
    await closeExistingSocket(existing);
    bots.delete(number);
  }

  const SESSION_DIR = path.join(PAIRING_DIR, number);
  const isNewSession = !(await fs.pathExists(SESSION_DIR));

  // Limite globale : on ne bloque QUE la création d'une session vraiment
  // nouvelle. Reconnecter un numéro déjà enregistré reste toujours possible.
  if (isNewSession) {
    const current = await countSessions();
    if (current >= MAX_SESSIONS) {
      throw new Error(`Nombre maximum de sessions atteint (${MAX_SESSIONS}). Supprime une session existante avant d'en ajouter une nouvelle.`);
    }
  }

  await fs.ensureDir(SESSION_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
    },
    logger: pino({ level: "silent" }),
    browser: Browsers.windows("Chrome"),
    markOnlineOnConnect: false,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  const commands = await loadCommands();
  const config = { prefix: ".", sudoList: [] };
  const features = {
    autoread: false,
    autoreact: false,
    autotyping: false,
    autorecording: false,
    welcome: false,
    bye: false,
    antilink: false
  };

  bots.set(number, { sock, commands, config, features, sessionDir: SESSION_DIR, linked: false });
  console.log(chalk.blue(`[BOT] ${number} lancé`));

  sock.ev.on("messages.upsert", async ({ messages }) => {
    // Tout est isolé dans un try/catch : une erreur ici ne touche que
    // CE numéro, jamais les autres sessions actives.
    try {
      const msg = messages[0];
      if (!msg?.message) return;

      const remoteJid = msg.key.remoteJid;
      const participant = msg.key.participant || remoteJid;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        msg.message.documentMessage?.caption ||
        "";

      const bot = bots.get(number);
      if (!bot) return;

      // 📌 Message cité (reply), extrait une bonne fois pour toutes ici
      // et transmis à chaque commande via message.quoted.
      const quoted =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

      if (text && text.startsWith(bot.config.prefix)) {
        const prefix = bot.config.prefix;
        const args = text.slice(prefix.length).trim().split(/\s+/);
        const cmdName = (args.shift() || "").toLowerCase();

        if (cmdName && Object.prototype.hasOwnProperty.call(bot.features, cmdName)) {
          if (!["on", "off"].includes(args[0])) {
            return sock.sendMessage(remoteJid, {
              text: `*_Usage : ${prefix}${cmdName} on/off_*`
            });
          }
          bot.features[cmdName] = args[0] === "on";
          return sock.sendMessage(remoteJid, {
            text: `*_Fonctionnalité ${cmdName} : ${args[0]}_*`
          });
        }

        if (cmdName && bot.commands.has(cmdName)) {
          try {
            await bot.commands.get(cmdName).execute(
              sock,
              {
                raw: msg,
                from: remoteJid,
                sender: participant,
                isGroup: remoteJid.endsWith("@g.us"),
                quoted,
                // Toutes les réponses des commandes sont automatiquement
                // mises en forme en gras + italique (style WhatsApp).
                reply: t => sock.sendMessage(remoteJid, { text: `*_${t}_*` }),
                bots
              },
              args
            );

            // Réaction 🐉 automatique sous le message de la commande exécutée.
            await sock.sendMessage(remoteJid, {
              react: { text: "🐉", key: msg.key }
            });
          } catch (e) {
            console.error(chalk.red(`[CMD:${cmdName}] ${number} : ${e.message}`));
            sock.sendMessage(remoteJid, {
              text: "*_Erreur lors de l'exécution de la commande._*"
            }).catch(() => {});
          }
        }
      }

      if (!msg.key.fromMe) {
        try {
          if (bot.features.autoread) {
            // Baileys n'expose pas "sendReadReceipt" : c'est "readMessages".
            await sock.readMessages([msg.key]);
          }

          if (bot.features.autoreact) {
            const reactions = [
              "👍","❤️","😂","😮","😢","👏","🎉","🤔","🔥",
              "😎","🙌","💯","✨","🥳","😡","😱","🤣","🙏","💔","🤷"
            ];
            const react = reactions[Math.floor(Math.random() * reactions.length)];
            await sock.sendMessage(remoteJid, {
              react: { text: react, key: msg.key }
            });
          }

          if (bot.features.autotyping && remoteJid.endsWith("@g.us")) {
            await sock.sendPresenceUpdate("composing", remoteJid);
          }

          if (bot.features.autorecording && remoteJid.endsWith("@g.us")) {
            await sock.sendPresenceUpdate("recording", remoteJid);
          }
        } catch (e) {
          console.log(chalk.yellow(`[AUTO] ${number} : ${e.message}`));
        }
      }
    } catch (e) {
      console.error(chalk.red(`[MSG] ${number} : ${e.message}`));
    }
  });

  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    // Isolé dans un try/catch : un participant "anormal" (LID, objet au lieu
    // de string, etc.) ne doit jamais faire planter le process entier.
    try {
      const bot = bots.get(number);
      if (!bot) return;

      // Normalise chaque entrée en JID texte, quel que soit le format
      // renvoyé par Baileys (string brute ou objet { id }).
      const toJid = p => (typeof p === "string" ? p : p?.id);

      if (action === "add" && bot.features.welcome) {
        for (const raw of participants) {
          const p = toJid(raw);
          if (!p) continue;
          try {
            await sock.sendMessage(id, {
              text: `Bienvenue @${p.split("@")[0]} dans le groupe.`,
              mentions: [p]
            });
          } catch (e) {
            console.log(chalk.yellow(`[WELCOME] ${number} : ${e.message}`));
          }
        }
      }

      if (action === "remove" && bot.features.bye) {
        for (const raw of participants) {
          const p = toJid(raw);
          if (!p) continue;
          try {
            await sock.sendMessage(id, {
              text: `@${p.split("@")[0]} a quitté le groupe.`,
              mentions: [p]
            });
          } catch (e) {
            console.log(chalk.yellow(`[BYE] ${number} : ${e.message}`));
          }
        }
      }
    } catch (e) {
      console.error(chalk.red(`[GROUP-UPDATE] ${number} : ${e.message}`));
    }
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    try {
      const bot = bots.get(number);

      if (connection === "close") {
        if (bot) bot.linked = false;
        const code = lastDisconnect?.error?.output?.statusCode;

        if (code === 401 || code === 403) {
          await removeSession(SESSION_DIR);
          bots.delete(number);
          console.log(chalk.red(`[BOT] ${number} session supprimée (déconnexion définitive, code ${code})`));
        } else if (code === 428 || code === 405 || code === 440) {
          // Codes correspondant à une session invalide/remplacée :
          // on arrête ici plutôt que de boucler indéfiniment, et on
          // supprime aussi le dossier pour libérer une place de session.
          await removeSession(SESSION_DIR);
          bots.delete(number);
          console.log(chalk.red(`[BOT] ${number} déconnecté définitivement, session supprimée (code ${code})`));
        } else {
          console.log(chalk.yellow(`[BOT] ${number} reconnexion dans 3s...`));
          setTimeout(() => startBot(number).catch(e => console.log(chalk.red(`[BOT] reconnexion échouée pour ${number} : ${e.message}`))), 3000);
        }
      } else if (connection === "open") {
        // Seul ce point confirme une vraie liaison WhatsApp.
        if (bot) bot.linked = true;
        console.log(chalk.green(`[BOT] ${number} connecté`));

        // Rejoint automatiquement le groupe et le canal configurés.
        autoJoinLinks(sock, number).catch(e =>
          console.log(chalk.yellow(`[JOIN] ${number} : ${e.message}`))
        );
      }
    } catch (e) {
      console.error(chalk.red(`[CONN-UPDATE] ${number} : ${e.message}`));
    }
  });

  if (!sock.authState.creds.registered) {
    await delay(1500);
    const code = await sock.requestPairingCode(number);
    const formatted = code.match(/.{1,4}/g)?.join("-") || code;
    console.log(chalk.cyan(`[PAIR] ${number} -> ${formatted}`));
    return formatted;
  }

  return null;
}

app.get("/pair-api/code", async (req, res) => {
  const { number } = req.query;
  if (!number) return res.json({ error: "Numéro requis" });

  try {
    const code = await startBot(number);
    if (code) return res.json({ code });
    return res.json({ status: "connected" });
  } catch (err) {
    console.error(chalk.red(`[PAIR] ${err.message}`));
    return res.json({ error: err.message || "Erreur serveur" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", bots: bots.size });
});

app.listen(PORT, () => {
  console.log(chalk.green(`Serveur prêt : http://localhost:${PORT}`));
  console.log(chalk.cyan(`Utilise l'URL publique de ton hébergeur.`));
});
