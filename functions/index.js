const functions = require('firebase-functions');
const admin = require('firebase-admin');
const TelegramBot = require('node-telegram-bot-api');
const get = require('lodash.get');
const { v4 } = require('uuid');
const http = require('got');

const { applicationName, commands } = require('./constants');
const { formatExcercises } = require('./helpers/messageFormatter');

const EmailService = require('./services/email.service');
const CodewarsService = require('./services/codewars.service');
const { diffExcercises } = require('./helpers/codewars.helper');

const { email, password } = functions.config().gmail;
const emailService = new EmailService(email, password, applicationName);

const bot = new TelegramBot(functions.config().telegram.token);
const logger = console;
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

    studentRef.update({
      confirmation_code: confirmationCode,
      confirmation_user: message.from.id,
    });

    emailService.sendConfirmationCodeEmail(student.email, confirmationUrl, () => {
      const eParts = student.email.split('@');
      const initialLetters = eParts[0].slice(0, 2);
      const lastLetters = eParts[0].slice(-2);

      const filteredEmail = `${initialLetters}${'*'.repeat(eParts[0].length - 2)}${lastLetters}@${eParts[1]}`;
      bot.sendMessage(message.chat.id, `We have sent you a confirmation link to ${filteredEmail}`);
    });
  });
};

const codewarsHandler = (message) => {
  // TODO: we will repeat this a lot, move to somewhere else
  const studentQuery = admin
    .database()
    .ref('/students')
    .orderByChild('telegram_id')
    .equalTo(message.from.id)
    .limitToFirst(1);

  studentQuery.once('value', (queryResult) => {
    const codewarsService = new CodewarsService({ http, logger });
    const studentKey = Object.keys(queryResult.val());
    const student = queryResult.val()[studentKey];
    logger.info('student', student);
    const codewarsRef = admin.database().ref(`/codewars/${student.student_id}`);
    const exercisesRef = admin.database().ref('/exercises');

    // Serious refactor opportunity here
    codewarsService
      .getExcercises(student.codewars.user, student.codewars.api)
      .then((result) => {
        const codewarsResult = JSON.parse(result.body);
        codewarsRef.set(codewarsResult);
        return codewarsResult.data;
      })
      .then((codewarsExs) => {
        exercisesRef.once('value', (result) => {
          const fbExercises = result.val();
          const diff = diffExcercises(fbExercises, codewarsExs);
          bot.sendMessage(message.parsed.chatId, formatExcercises(diff), { parse_mode: 'Markdown', disable_web_page_preview: true });
        });
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
    return res.sendStatus(200);
  }
  switch (message.parsed.command) {
    case commands.login:
      loginHandler(message);
      break;
    case commands.codewars:
      codewarsHandler(message);
      break;
    default:
      bot.sendMessage(message.parsed.chatId, `Command "${message.text}" is not valid.`);
  }

  return res.sendStatus(200);
});

exports.emailConfirm = functions.https.onRequest((req, res) => {
  const { code, tid } = req.query;
  const tgId = Number.parseInt(tid, 10);
  let msg = '';

  const studentsRef = admin.database().ref('/students');

  studentsRef.once('value', (result) => {
    const jsonResult = result.val();
    const students = Object.keys(jsonResult).map(k => jsonResult[k]);
    const student = students
      .find(s => s.confirmation_code === code && s.confirmation_user === tgId);

    if (!student) {
      msg = 'Invalid confirmation code in email, please login again in @PauDevBot';
      return res.status(400).send(msg);
    }

    admin
      .database()
      .ref(`/students/${student.student_id}`)
      .update({ telegram_id: tgId, confirmation_user: null, confirmation_code: null })
      .then(() => {
        bot.sendMessage(tgId, "You're logged in! Tap /help to see your available commands");
      });

    res.status(200).send("You're logged in! Follow the instructions in @PauDevBot at telegram. You can now close this window.");
  });
});
