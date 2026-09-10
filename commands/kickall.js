// commands/kickall.js
export default {
  name: "kickall",
  description: "Kick all non-admin members",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
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
          text: `✅ 𝙺𝚒𝚌𝚔𝚎𝚍 @${t.split("@")[0]} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`,
          mentions: [t]
        });
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 3000)); // 3s delay
      }

    } catch (err) {
      console.error("❌ KickAll error:", err);
      await reply("❌ Impossible to kick all. Check my permissions.");
    }
  }
};