// commands/promote.js
export default {
  name: "promote",
  description: "Promote user to admin",

  async execute(sock, message, args) {
    const { from, reply, isGroup, raw } = message;

    if (!isGroup) return await reply("❌ Group only");

    try {
      const mentioned = raw.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quotedUser = raw.message?.extendedTextMessage?.contextInfo?.participant;

      let targets = [...mentioned];
      if (quotedUser && !targets.includes(quotedUser)) targets.push(quotedUser);
      if (targets.length === 0) return await reply("⚠️ Mention or reply a user to promote");

      await sock.groupParticipantsUpdate(from, targets, "promote");

      await sock.sendMessage(from, {
        text: `✅ 𝙿𝚛𝚘𝚖𝚘𝚝𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚝𝚘 𝚊𝚍𝚖𝚒𝚗.`,
        mentions: targets
      });

    } catch (err) {
      console.error("❌ Promote error:", err);
      await reply("❌ Impossible to promote. Check my permissions.");
    }
  }
};