const { v4 } = require('uuid');
const http = require('got');
const Q = require('p-queue');

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
    .ref('/students');

  studentQuery.once('value', (queryResult) => {
    const codewarsService = new CodewarsService({ http, logger });

    if (!queryResult.val()) {
      return resolve('Could not retrieve list of students');
    }

    const students = Object.keys(queryResult.val()).map(k => queryResult.val()[k]);
    const requester = students.find(s => s.telegram_id === message.fromId);

    const withQueryStudent = message.text.length > '/codewars'.length;
    const querySchoolId = /\d{8}/.exec(message.text);
    const queryStudentId = querySchoolId
      && message.text.slice(querySchoolId.index, querySchoolId.index + 8).trim();

    let student = {};

    if (withQueryStudent && !requester.admin) {
      return resolve('Only admins can execute this command');
    } else if (withQueryStudent && requester.admin) {
      student = students.find(s => s.student_id === Number.parseInt(queryStudentId, 10));
      if (!student) {
        return resolve('Student is not valid');
      }
    } else {
      student = requester;
    }

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

const codewarsAllHandler = ({ message, firebaseDb, logger }) => new Promise((resolve) => {
  // TODO: we will repeat this a lot, move to somewhere else
  const studentsQuery = firebaseDb
    .ref('/students');

  studentsQuery.once('value', (queryResult) => {
    const codewarsService = new CodewarsService({ http, logger });

    if (!queryResult.val()) {
      return resolve('Could not retrieve list of students');
    }

    const students = Object.keys(queryResult.val()).map(k => queryResult.val()[k]);
    const requester = students.find(s => s.telegram_id === message.fromId);

    if (!requester.admin) {
      return resolve('Only admins can execute this command');
    }

    const queue = new Q({ concurrency: 1 });
    const errors = [];

    students.forEach((s) => {
      queue.add(() => codewarsService.getExcercises(s.codewars.user, s.codewars.api)
        .then((result) => {
          const codewarsRef = firebaseDb.ref(`/codewars/${s.student_id}`);
          const codewarsResult = JSON.parse(result.body);
          codewarsRef.set(codewarsResult);
        })
        .catch(err => errors.push({ error: err, student: s.student_id })));
    });

    queue.onIdle().then(() => {
      resolve(`
      Updated codewars info to all students.
      Errors: ${errors.length}
      ----------
      ${errors.map(e => `Student ${e.student_id} got ${e.message}`)}
      `);
    });
  });
});

const helpHandler = () => new Promise((resolve) => {
  const helpText = `
  *Thank you for using Pau!*
  You’re able to use the following commands:
  
  /login _[studentid]_: Associates your telegram account with your student profile. You must call login with your *[studentid]*. E.g. /login 20091234
  You'll receive a confirmation link in your registered mail.

  /codewars Retrieves the list of codewars excercises in each batch with it’s current status:
    
  💯: Exercise already done
  🕑: Exercise done late
  🔥: Exercise is not yet done

  *Coming soon*
  /grades Returns all the grades currently digitized.`;

  resolve(helpText);
});

exports.handle = (props) => {
  switch (props.message.command) {
    case commands.login:
      return loginHandler(props);
    case commands.codewars:
      return codewarsHandler(props);
    case commands.codewars_all:
      return codewarsAllHandler(props);
    case commands.help:
    case commands.start:
      return helpHandler(props);
    default:
      return defaultHandler(props);
  }
};
