import dotenv from "dotenv";
dotenv.config();

export default {
  name: "promoteall",
  description: "𝙿𝚛𝚘𝚖𝚘𝚝𝚎 𝚝𝚘𝚞𝚜 𝚕𝚎𝚜 𝚖𝚎𝚖𝚋𝚛𝚎𝚜 𝚍𝚞 𝚐𝚛𝚘𝚞𝚙𝚎",

  async execute(sock, message, args) {
    const { from, reply } = message;

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
        { text, mentions: targets },
        { quoted: message.raw }
      );

    } catch (err) {
      console.error("promoteall error:", err);
      await reply("❌ 𝙴𝚛𝚛𝚎𝚞𝚛 𝚕𝚘𝚛𝚜 𝚍𝚎 𝚕’𝚎𝚡é𝚌𝚞𝚝𝚒𝚘𝚗.");
    }
  }
};