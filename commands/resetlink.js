// commands/resetlink.js
export default {
  name: "resetlink",
  description: "Réinitialise le lien du groupe actuel",

  async execute(sock, message, args) {
    const { from, reply, isGroup } = message;

    try {
      if (!isGroup) {
        return await reply("𝙲𝚘𝚖𝚖𝚊𝚗𝚍𝚎 𝚐𝚛𝚘𝚞𝚙𝚎 𝚞𝚗𝚒𝚚𝚞𝚎𝚖𝚎𝚗𝚝.");
      }

      // Réinitialise le lien DU GROUPE COURANT
      await sock.groupRevokeInvite(from);

      await reply("𝙻𝚒𝚎𝚗 𝚍𝚞 𝚐𝚛𝚘𝚞𝚙𝚎 𝚛𝚎́𝚒𝚗𝚒𝚝𝚒𝚊𝚕𝚒𝚜𝚎́.");
    } catch (err) {
      console.error("❌ RESETLINK error:", err);
      await reply("𝙿𝚎𝚛𝚖𝚒𝚜𝚜𝚒𝚘𝚗𝚜 𝚒𝚗𝚜𝚞𝚏𝚏𝚒𝚜𝚊𝚗𝚝𝚎𝚜.");
    }
  }
};
