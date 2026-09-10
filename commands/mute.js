export default {
  name: "mute",
  description: "🔇 Mute the group (only admins can send messages)",
  
  async execute(sock, message, args) {
    const { from, reply, isGroup } = message;
    if (!isGroup) return await reply("❌ This command works only in groups");

    try {
      await sock.groupSettingUpdate(from, "announcement"); // only admins can send
      await reply("🔇 𝙶𝚛𝚘𝚞𝚙 muted: only admins can send messages");
    } catch (e) {
      console.error("Mute error:", e);
      await reply("❌ Cannot mute the group");
    }
  }
};