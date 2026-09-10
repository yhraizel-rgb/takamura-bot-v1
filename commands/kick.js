// commands/kick.js
export default {
  name: "kick",
  description: "Kick user from group",

  async execute(sock, message, args) {
    const { from, reply, isGroup, raw } = message;

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
        text: `✅ 𝙺𝚒𝚌𝚔𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`,
        mentions: targets
      });

    } catch (err) {
      console.error("❌ Kick error:", err);
      await reply("❌ Impossible to kick these members. Check my permissions.");
    }
  }
};