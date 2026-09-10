import { downloadContentFromMessage } from "@whiskeysockets/baileys";

export default {
  name: "photo",
  description: "𝚂𝚝𝚒𝚌𝚔𝚎𝚛 𝚝𝚘 𝚒𝚖𝚊𝚐𝚎",
  
  async execute(sock, message) {
    const { from, reply, quoted } = message;
    
    try {
      if (!quoted?.message?.stickerMessage) {
        return await reply("❌ 𝚁𝚎𝚙𝚕𝚢 𝚝𝚘 𝚜𝚝𝚒𝚌𝚔𝚎𝚛");
      }
      
      const stream = await downloadContentFromMessage(quoted.message.stickerMessage, "sticker");
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      await sock.sendMessage(from, {
        image: Buffer.concat(chunks)
      });
      
      await reply("✅");
      
    } catch {
      await reply("❌");
    }
  }
};