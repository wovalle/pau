const { v4 } = require('uuid');
const http = require('got');

const EmailService = require('../services/email.service');
const CodewarsService = require('../services/codewars.service');
const { diffExcercises } = require('../helpers/codewars.helper');
const { applicationName, commands } = require('../constants');
const { codewarsExercises } = require('../helpers/tgMessage.helper');

const loginHandler = ({ message, firebaseDb, firebaseFunctions }) => new Promise((resolve) => {
  const matchSchoolId = /\d{8}/.exec(message.text);

  if (!matchSchoolId) {
    return resolve('Invalid school id provided.');
  }

  const studentId = message.text.slice(matchSchoolId.index, matchSchoolId.index + 8).trim();
  const studentRef = firebaseDb.ref(`/students/${studentId}`);

  studentRef.once('value', (result) => {
    const student = result.val();

    if (!student) {
      return resolve(`Invalid student id *${studentId}*`);
    }

    const confirmationCode = v4();
    const confirmationUrl = `${firebaseFunctions.config().functions['email-confirm-url']}?code=${confirmationCode}&tid=${message.fromId}`;

    studentRef.update({
      confirmation_code: confirmationCode,
      confirmation_user: message.fromId,
    });

    const { email, password } = firebaseFunctions.config().gmail;
    const emailService = new EmailService(email, password, applicationName);

    emailService.sendConfirmationCodeEmail(student.email, confirmationUrl, () => {
      const eParts = student.email.split('@');
      const initialLetters = eParts[0].slice(0, 2);
      const lastLetters = eParts[0].slice(-2);

      const filteredEmail = `${initialLetters}${'#'.repeat(eParts[0].length - 2)}${lastLetters}@${eParts[1]}`;
      resolve(`We have sent you a confirmation link to ${filteredEmail}`);
    });
  });
});

const defaultHandler = ({ message }) => new Promise((resolve) => {
  resolve(`Command "${message.text}" is not valid.`);
});

const codewarsHandler = ({ message, firebaseDb, logger }) => new Promise((resolve) => {
  // TODO: we will repeat this a lot, move to somewhere else
  const studentQuery = firebaseDb
    .ref('/students')
    .orderByChild('telegram_id')
    .equalTo(message.fromId)
    .limitToFirst(1);

  studentQuery.once('value', (queryResult) => {
    const codewarsService = new CodewarsService({ http, logger });
    const studentKey = Object.keys(queryResult.val());
    const student = queryResult.val()[studentKey];
    const codewarsRef = firebaseDb.ref(`/codewars/${student.student_id}`);
    const exercisesRef = firebaseDb.ref('/exercises');

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
          resolve(codewarsExercises(diff));
        });
      });
  });
});

exports.handle = (props) => {
  switch (props.message.command) {
    case commands.login:
      return loginHandler(props);
    case commands.codewars:
      return codewarsHandler(props);
    default:
      return defaultHandler(props);
  }
};
