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

[
    {
        "agent level":"LV1",
        "Team size": 5,
        "Promotion Bonus":60 usdt,
        "Weekly Team Manage Salary":20 usdt
    },
     {
        "agent level":"LV2",
        "Team size": 30,
        "Promotion Bonus":160 usdt,
        "Weekly Team Manage Salary":65 usdt
    },
     {
        "agent level":"LV3",
        "Team size": 130,
        "Promotion Bonus":300 usdt,
        "Weekly Team Manage Salary":150 usdt
    },
     {
        "agent level":"LV4",
        "Team size": 500,
        "Promotion Bonus":650 usdt,
        "Weekly Team Manage Salary":300 usdt
    },
      {
        "agent level":"LV5",
        "Team size": 1500,
        "Promotion Bonus":120 usdt,
        "Weekly Team Manage Salary":600 usdt
    },
      {
        "agent level":"LV6",
        "Team size": 3000,
        "Promotion Bonus":2500 usdt,
        "Weekly Team Manage Salary":1300 usdt
    },
]