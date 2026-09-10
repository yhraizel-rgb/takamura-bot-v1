// commands/add.js
export default {
  name: "add",
  description: "Add user to group",

  async execute(sock, message, args) {
    const { from, reply, isGroup } = message;

    if (!isGroup) return await reply("❌ Group only");

    try {
      const number = args[0]?.replace(/\D/g, "");
      if (!number) return await reply("⚠️ Number required");

      const target = `${number}@s.whatsapp.net`;
      await sock.groupParticipantsUpdate(from, [target], "add");

      await sock.sendMessage(from, {
        text: `✅ 𝙰𝚍𝚍𝚎𝚍 @${target.split("@")[0]} 𝚝𝚘 𝚐𝚛𝚘𝚞𝚙.`,
        mentions: [target]
      });

    } catch (err) {
      console.error("❌ Add error:", err);
      await reply("❌ Impossible to add this member. Check my permissions.");
    }
  }
};