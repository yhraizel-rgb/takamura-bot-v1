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

// ======================= EXPRESS =======================
const app = express();
const PORT = process.env.PORT || 80;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ======================= ES MODULE DIRNAME =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// ======================= GLOBALS =======================
const PAIRING_DIR = "./sessions";
await fs.ensureDir(PAIRING_DIR);
const bots = new Map();

// ======================= UTILITIES =======================
function formatNumber(num) {
  return String(num).replace(/\D/g, "").replace(/^0+/, "");
}

async function removeSession(dir) {
  if (await fs.pathExists(dir)) await fs.remove(dir);
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
        console.log(chalk.red(`[CMD] Erreur chargement ${file} : ${e.message}`));
      }
    }
  }
  return commands;
}

// ======================= START BOT =======================
async function startBot(number) {
  number = formatNumber(number);

  if (!number || number.length < 8) {
    throw new Error("Numéro invalide");
  }

  // Si le bot est déjà lancé et enregistré, on ne refait rien
  if (bots.has(number)) {
    const existing = bots.get(number);
    if (existing?.sock?.authState?.creds?.registered) {
      return null; // déjà connecté
    }
  }

  const SESSION_DIR = path.join(PAIRING_DIR, number);
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

  bots.set(number, { sock, commands, config, features });
  console.log(chalk.blue(`[BOT] ${number} lancé`));

  // ======================= MESSAGE HANDLER =======================
  sock.ev.on("messages.upsert", async ({ messages }) => {
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

    if (!text) return;

    const bot = bots.get(number);
    if (!bot) return;

    const prefix = bot.config.prefix;

    if (text.startsWith(prefix)) {
      const args = text.slice(prefix.length).trim().split(/\s+/);
      const cmdName = args.shift().toLowerCase();

      // Fonctionnalités on/off
      if (Object.prototype.hasOwnProperty.call(bot.features, cmdName)) {
        if (!["on", "off"].includes(args[0])) {
          return sock.sendMessage(remoteJid, {
            text: `Usage : ${prefix}${cmdName} on/off`
          });
        }
        bot.features[cmdName] = args[0] === "on";
        return sock.sendMessage(remoteJid, {
          text: `Fonctionnalité ${cmdName} : ${args[0]}`
        });
      }

      // Commandes personnalisées
      if (bot.commands.has(cmdName)) {
        try {
          await bot.commands.get(cmdName).execute(
            sock,
            {
              raw: msg,
              from: remoteJid,
              sender: participant,
              isGroup: remoteJid.endsWith("@g.us"),
              reply: t => sock.sendMessage(remoteJid, { text: t }),
              bots
            },
            args
          );
        } catch (e) {
          console.error(e);
          sock.sendMessage(remoteJid, { text: "Erreur lors de l'exécution de la commande." });
        }
      }
    }

    // ======================= AUTO FEATURES =======================
    if (!msg.key.fromMe) {
      try {
        if (bot.features.autoread) {
          await sock.sendReadReceipt(remoteJid, participant, [msg.key.id]);
        }

        if (bot.features.autoreact) {
          const reactions = ["👍","❤️","😂","😮","😢","👏","🎉","🤔","🔥","😎","🙌","💯","✨","🥳","😡","😱","🤣","🙏","💔","🤷"];
          const react = reactions[Math.floor(Math.random() * reactions.length)];
          await sock.sendMessage(remoteJid, { react: { text: react, key: msg.key } });
        }

        if (bot.features.autotyping && remoteJid.endsWith("@g.us")) {
          await sock.sendPresenceUpdate("composing", remoteJid);
        }

        if (bot.features.autorecording && remoteJid.endsWith("@g.us")) {
          await sock.sendPresenceUpdate("recording", remoteJid);
        }
      } catch (e) {
        console.log(chalk.yellow(`[AUTO] ${e.message}`));
      }
    }
  });

  // ======================= GROUP EVENTS (welcome / bye / antilink basique) =======================
  sock.ev.on("group-participants.update", async (update) => {
    const bot = bots.get(number);
    if (!bot) return;

    const { id, participants, action } = update;

    if (action === "add" && bot.features.welcome) {
      for (const p of participants) {
        await sock.sendMessage(id, {
          text: `Bienvenue @${p.split("@")[0]} dans le groupe.`,
          mentions: [p]
        });
      }
    }

    if (action === "remove" && bot.features.bye) {
      for (const p of participants) {
        await sock.sendMessage(id, {
          text: `@${p.split("@")[0]} a quitté le groupe.`,
          mentions: [p]
        });
      }
    }
  });

  // ======================= CONNECTION HANDLER =======================
  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code === 401 || code === 403) {
        await removeSession(SESSION_DIR);
        bots.delete(number);
        console.log(chalk.red(`[BOT] ${number} session supprimée (déconnexion définitive)`));
      } else {
        console.log(chalk.yellow(`[BOT] ${number} reconnexion dans 3s...`));
        setTimeout(() => startBot(number).catch(() => {}), 3000);
      }
    } else if (connection === "open") {
      console.log(chalk.green(`[BOT] ${number} connecté`));
    }
  });

  // ======================= PAIRING CODE =======================
  if (!sock.authState.creds.registered) {
    await delay(1500);
    const code = await sock.requestPairingCode(number);
    const formatted = code.match(/.{1,4}/g)?.join("-") || code;
    console.log(chalk.cyan(`[PAIR] ${number} -> ${formatted}`));
    return formatted;
  }

  return null;
}

// ======================= ROUTES =======================
app.get("/pair-api/code", async (req, res) => {
  const { number } = req.query;

  if (!number) {
    return res.json({ error: "Numéro requis" });
  }

  try {
    const code = await startBot(number);
    if (code) {
      return res.json({ code });
    }
    return res.json({ status: "connected" });
  } catch (err) {
    console.error(chalk.red(`[PAIR] ${err.message}`));
    return res.json({ error: err.message || "Erreur serveur" });
  }
});

// Endpoint de santé (optionnel, pratique pour hébergeurs)
app.get("/health", (req, res) => {
  res.json({ status: "ok", bots: bots.size });
});

// ======================= START SERVER =======================
app.listen(PORT, () => {
  console.log(chalk.green(`Serveur prêt : http://localhost:${PORT}`));
  console.log(chalk.cyan(`Utilise l'URL publique de ton hébergeur pour le pairage.`));
});
