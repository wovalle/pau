const functions = require('firebase-functions');
const admin = require('firebase-admin');
const TelegramBot = require('node-telegram-bot-api');
const CodewarsService = require('./services/codewars.service');
const http = require('got');


const { genericError, flattenTgMessage } = require('./helpers/tgMessage.helper');

const { handle } = require('./handlers/telegram.handler');

const bot = new TelegramBot(functions.config().telegram.token);
const logger = console;

admin.initializeApp(functions.config().firebase);

exports.codewarsBridge = functions.https.onRequest((req, res) => {
  const { user, key } = req.query;

  const codewarsService = new CodewarsService({ http, logger });

  codewarsService.getExcercises(user, key)
    .then(result => res.status(200).send(result.body))
    .catch((err) => {
      logger.error(err);
      res.status(500).send('An error has occurred, please contact the System Administrator');
    });
});

exports.telegramHook = functions.https.onRequest((req, res) => {
  const message = flattenTgMessage(req.body.message);

  if (req.method !== 'POST' || !message.chatId) {
    return res.status(403).send('Forbidden');
  }

  if (!message.isBotCommand) {
    bot.sendMessage(message.chatId, `Can't understand text "${message.text}", use /help to see available commands`);
    return res.sendStatus(200);
  }

  handle({
    message, firebaseDb: admin.database(), firebaseFunctions: functions, logger,
  }).then((text) => {
    bot.sendMessage(message.fromId, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
    return res.sendStatus(200);
  }).catch((error) => {
    logger.error(error);
    bot.sendMessage(message.fromId, genericError());
    return res.sendStatus(200);
  });
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
