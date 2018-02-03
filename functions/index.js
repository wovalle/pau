const functions = require('firebase-functions');
const TelegramBot = require('node-telegram-bot-api');
const get = require('lodash.get');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const commands = {
    login: 'login',
    grades: 'grades',
    codewars: 'codewars',
    help: 'help',
};

const commandIsValid = (command, message) => {
    return get(message, 'entities.0.type') === 'bot_command' && commands[command];
};

exports.helloWorld = functions.https.onRequest((req, res) => {
    const { message } = req.body;
    const messageText = get(message, 'text', '').slice(1);
    const chatId = get(message, 'chat.id', null);

    if (req.method !== 'POST' || !chatId) {
        return res.status(403).send('Forbidden');
    }

    if (commandIsValid(messageText, message)) {
        const telegramEntity = message.entities[0];
        const command = messageText.slice(telegramEntity.offset, telegramEntity.length);

        switch (command) {
            case commands.login:
                loginHandler(message);
                break;
            default:
                bot.sendMessage(chatId, `Command "${message.text}", valid but is not handled yet.`);
        }
    } else {
        bot.sendMessage(chatId, `Can't understand text "${message.text}", use /help to see available commands`);
    }

    return res.sendStatus(200);
});

const loginHandler = (message) => {
    bot.sendMessage(message.chat.id, `Login is not handled yet.`);
};