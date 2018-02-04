const functions = require('firebase-functions');
const admin = require('firebase-admin');
const TelegramBot = require('node-telegram-bot-api');
const get = require('lodash.get');
const { v4 } = require('uuid');

const { applicationName, commands } = require('./constants');

const EmailService = require('./services/email.service');

const { email, password } = functions.config().gmail;
const emailService = new EmailService(email, password, applicationName);

const bot = new TelegramBot(functions.config().telegram.token);
admin.initializeApp(functions.config().firebase);


const parseTelegramMessage = (message) => {
  const entity = get(message, 'entities.0', { offset: 0, length: 0 });
  const text = get(message, 'text', '').slice(1);
  return Object.assign(
    message,
    {
      parsed: {
        text,
        isBotCommand: get(entity, 'type') === 'bot_command',
        command: text.slice(entity.offset, entity.length).trim(),
        chatId: get(message, 'chat.id'),
      },
    });
};

const loginHandler = (message) => {
  const matchSchoolId = /\d{8}/.exec(message.parsed.text);

  if (!matchSchoolId) {
    bot.sendMessage(message.parsed.chatId, 'Invalid school id provided.');
    return;
  }

  const studentId = message.parsed.text.slice(matchSchoolId.index, matchSchoolId.index + 8).trim();
  const studentRef = admin.database().ref(`/students/${studentId}`);

  studentRef.once('value', (result) => {
    const student = result.val();

    if (!student) {
      return bot.sendMessage(message.chat.id, `Invalid student id ${studentId}`);
    }

    const confirmationCode = v4();
    const confirmationUrl = `${functions.config().functions['email-confirm-url']}?code=${confirmationCode}&tid=${message.from.id}`;

    studentRef.update({ confirmation_code: confirmationCode, confirmation_user: message.from.id });

    emailService.sendConfirmationCodeEmail(student.email, confirmationUrl, () => {
      const eParts = student.email.split('@');
      const initialLetters = eParts[0].slice(0, 2);
      const lastLetters = eParts[0].slice(-2);

      const filteredEmail = `${initialLetters}${'*'.repeat(eParts[0].length - 2)}${lastLetters}@${eParts[1]}`;
      bot.sendMessage(message.chat.id, `We have sent you a confirmation link to ${filteredEmail}`);
    });
  });
};

exports.telegramHook = functions.https.onRequest((req, res) => {
  const message = parseTelegramMessage(req.body.message);

  if (req.method !== 'POST' || !message.parsed.chatId) {
    return res.status(403).send('Forbidden');
  }

  if (!message.parsed.isBotCommand) {
    bot.sendMessage(message.parsed.chatId, `Can't understand text "${message.text}", use /help to see available commands`);
    return res.sendStatus(400);
  }
  switch (message.parsed.command) {
    case commands.login:
      loginHandler(message);
      break;
    default:
      bot.sendMessage(message.parsed.chatId, `Command "${message.text}" is not valid.`);
  }

  return res.sendStatus(200);
});

exports.emailConfirm = functions.https.onRequest((req, res) => {
  res.sendStatus(200);
});
