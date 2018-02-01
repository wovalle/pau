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
}

exports.helloWorld = functions.https.onRequest((req, res) => {
    const { message } = req.body;

    if (!commandIsValid(message.text.slice(1), message)) {
        bot.sendMessage(message.chat.id, `Can't understand text "${message.text}", use /help to see available commands`);
    } else {
        bot.sendMessage(message.chat.id, `Command "${message.text}", valid`);
    }

    res.send('Hello world');
});
