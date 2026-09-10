// commands/url.js
import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import { join } from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import { style } from "../lib/style.js";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  name: "url",
  description: "Génère une URL à partir d'une image, vidéo ou audio",

  async execute(sock, message) {
    const { raw, reply } = message;

    try {
      const quoted = raw.message?.extendedTextMessage?.contextInfo?.quotedMessage || raw.message;
      const type = quoted.imageMessage ? "image" : quoted.videoMessage ? "video" : quoted.audioMessage ? "audio" : null;
      if (!type) return reply(style.warn("Réponds à un média (image, vidéo ou audio)."));

      const stream = await downloadContentFromMessage(quoted[`${type}Message`], type);
      const buffer = await streamToBuffer(stream);

      const tempDir = "./temp";
      fs.mkdirSync(tempDir, { recursive: true });
      const ext = type === "image" ? "jpg" : type === "video" ? "mp4" : "mp3";
      const filePath = join(tempDir, `media_${Date.now()}.${ext}`);
      fs.writeFileSync(filePath, buffer);

      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("fileToUpload", fs.createReadStream(filePath));

      const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form, headers: form.getHeaders() });
      const url = await res.text();
      fs.unlinkSync(filePath);

      await reply(style.ok(url, "Lien généré"));
    } catch (err) {
      console.error("❌ url:", err);
      await reply(style.err(err.message));
    }
  }
};
