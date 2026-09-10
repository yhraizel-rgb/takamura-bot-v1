// commands/purge.js
export default {
  name: "purge",
  description: "Remove all non-admin members instantly",

  async execute(sock, message) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return await reply("❌ Group only");

    try {
      const metadata = await sock.groupMetadata(from);
      const botJid = sock.user.id;

      const targets = metadata.participants
        .filter(p => !p.admin && p.id !== botJid)
        .map(p => p.id);

      if (targets.length === 0) return await reply("⚠️ No members to purge");

      await sock.groupParticipantsUpdate(from, targets, "remove");

      await sock.sendMessage(from, {
        text: `✅ 𝙿𝚞𝚛𝚐𝚎𝚍 ${targets.map(t => `@${t.split("@")[0]}`).join(", ")} 𝚜𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢.`,
        mentions: targets
      });

    } catch (err) {
      console.error("❌ Purge error:", err);
      await reply("❌ Impossible to purge members. Check my permissions.");
    }
  }
};