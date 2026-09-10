export default {
  name: "unmute",
  description: "🔊 Unmute the group (everyone can send messages)",
  
  async execute(sock, message, args) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return await reply("❌ This command works only in groups");

    try {
      await sock.groupSettingUpdate(from, "not_announcement"); // everyone can send
      await reply("🔊 𝙶𝚛𝚘𝚞𝚙 unmuted: everyone can send messages");
    } catch (e) {
      console.error("Unmute error:", e);
      await reply("❌ Cannot unmute the group");
    }
  }
};