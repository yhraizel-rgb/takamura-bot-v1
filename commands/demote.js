// commands/demote.js
export default {
  name: "demote",
  description: "Demote admin to member",

  async execute(sock, message, args) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return await reply("❌ Group only");

    try {
      const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

      let targets = [...mentioned];
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
      if (targets.length === 0) return await reply("⚠️ Mention or reply a user to demote");

      await sock.groupParticipantsUpdate(from, targets, "demote");

      await sock.sendMessage(from, {
        text: `✅ 𝙳𝚎𝚖𝚘𝚝𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚝𝚘 𝚖𝚎𝚖𝚋𝚎𝚛.`,
        mentions: targets
      });

    } catch (err) {
      console.error("❌ Demote error:", err);
      await reply("❌ Impossible to demote. Check my permissions.");
    }
  }
};