import TelegramBot   from "node-telegram-bot-api"

const token = '8484922145:AAHKKsv21mMzdkcT4N2sGYZSHrIVI7-FzoA';
const bot = new TelegramBot(token, { polling: true });
const group_chatId = "-1003616087750"
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  console.log(msg)
  if(chatId===group_chatId){
      bot.sendMessage(chatId, 'Received your message');
  }
});
