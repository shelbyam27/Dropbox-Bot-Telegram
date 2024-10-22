const express = require("express");
const bodyParser = require("body-parser");
const TelegramBot = require("node-telegram-bot-api");
const { Dropbox } = require("dropbox");
const fetch = require("isomorphic-fetch");
const mime = require("mime-types");

const app = express();
app.use(bodyParser.json());

// Ganti dengan token bot Telegram Anda
const telegramBotToken = "TOKEN_BOT";
const bot = new TelegramBot(telegramBotToken, { polling: true });

let dropboxAccessToken = ""; // Menyimpan token Dropbox di memori

// Menangani pesan dari Telegram
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  // Jika pengguna mengirim token Dropbox
  if (msg.text && msg.text.startsWith("dropbox_token:")) {
    dropboxAccessToken = msg.text.split(":")[1].trim();
    bot.sendMessage(
      chatId,
      "Token Dropbox telah disimpan. Anda sekarang dapat meng-upload file atau link."
    );
    return;
  }

  // Jika token Dropbox belum disetel
  if (!dropboxAccessToken) {
    bot.sendMessage(
      chatId,
      "Silakan kirim token Dropbox Anda dengan format: dropbox_token: YOUR_DROPBOX_ACCESS_TOKEN"
    );
    return;
  }

  const dbx = new Dropbox({ accessToken: dropboxAccessToken, fetch });

  // Jika pengguna mengirim link
  if (msg.text && msg.text.startsWith("http")) {
    const url = msg.text;

    try {
      const response = await fetch(url);
      const buffer = await response.buffer();

      const contentDisposition = response.headers.get("content-disposition");
      let fileName;

      if (contentDisposition) {
        const matches = /filename="?([^";]+)"?/.exec(contentDisposition);
        if (matches[1]) {
          fileName = matches[1];
        }
      }

      if (!fileName) {
        const contentType = response.headers.get("content-type");
        const extension = mime.extension(contentType) || "bin";
        fileName = `downloaded_file_${Date.now()}.${extension}`;
      }

      const dropboxPath = "/" + fileName;
      const uploadResponse = await dbx.filesUpload({
        path: dropboxPath,
        contents: buffer,
      });

      const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: uploadResponse.result.path_lower,
      });

      const sharedLink = sharedLinkResponse.result.url;

      bot.sendMessage(
        chatId,
        `File berhasil di-upload ke Dropbox dari link! Link: ${sharedLink}`
      );
      console.log(
        `User: ${username} telah berhasil meng-upload file dari link: ${url}`
      );
    } catch (error) {
      console.error(
        "Terjadi kesalahan saat meng-upload file dari link:",
        error
      );
      bot.sendMessage(
        chatId,
        "Terjadi kesalahan saat meng-upload file dari link."
      );
    }
  }
  // Jika pengguna mengirim dokumen atau media
  else if (msg.document || msg.photo || msg.video || msg.audio || msg.voice) {
    let fileId;
    let fileName;

    if (msg.document) {
      fileId = msg.document.file_id;
      fileName = msg.document.file_name || `document_${Date.now()}.pdf`;
    } else if (msg.photo) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
      fileName = `image_${Date.now()}.jpg`;
    } else if (msg.video) {
      fileId = msg.video.file_id;
      fileName = msg.video.file_name || `video_${Date.now()}.mp4`;
    } else if (msg.audio) {
      fileId = msg.audio.file_id;
      fileName = msg.audio.file_name || `audio_${Date.now()}.mp3`;
    } else if (msg.voice) {
      fileId = msg.voice.file_id;
      fileName = `voice_${Date.now()}.ogg`;
    }

    try {
      const file = await bot.getFile(fileId);
      const filePath = `https://api.telegram.org/file/bot${telegramBotToken}/${file.file_path}`;
      const response = await fetch(filePath);
      const buffer = await response.buffer();

      const dropboxPath = "/" + fileName;
      const uploadResponse = await dbx.filesUpload({
        path: dropboxPath,
        contents: buffer,
      });

      const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: uploadResponse.result.path_lower,
      });

      const sharedLink = sharedLinkResponse.result.url;

      bot.sendMessage(
        chatId,
        `File berhasil di-upload ke Dropbox! Link: ${sharedLink}`
      );
      console.log(
        `User: ${username} telah berhasil meng-upload file: ${fileName}`
      );
    } catch (error) {
      console.error("Terjadi kesalahan saat meng-upload file:", error);
      bot.sendMessage(chatId, "Terjadi kesalahan saat meng-upload file.");
    }
  } else {
    bot.sendMessage(
      chatId,
      "Silakan kirim dokumen, media, atau link untuk di-upload ke Dropbox."
    );
  }
});

// Menjalankan server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
