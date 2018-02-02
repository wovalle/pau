const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

// const { sendCodeEmail } = require('./etc/MailsService');

const APP_NAME = 'test_pau';

// -_- Moved this here utill syntax error is resolved!
function sendCodeEmail(recipientEmail, recipientName, callback = null) {
  const gmailEmail = functions.config().gmail.email;
  const gmailPassword = functions.config().gmail.password;
  const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailPassword,
    },
  });
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: recipientEmail,
  };

  mailOptions.subject = 'Registration Code';
  mailOptions.text = `Hey ${recipientName ||
    ''}! Welcome to ${APP_NAME}. I hope you will enjoy our service.`;
  mailTransport.sendMail(mailOptions).then((error, info) => {
    let feedBackMsg = '';
    if (error) {
      feedBackMsg = error;
      console.error(error);
    } else {
      feedBackMsg = `New code email sent to ${recipientEmail}`;
      console.log('Message sent: %s', info.messageId);
      console.log('New welcome email sent to:', recipientEmail);
    }
    if (callback) callback(feedBackMsg);
  });
}

exports.helloWorld = functions.https.onRequest((req, res) => {
  res.send(JSON.stringify(req.query));
});
exports.sendCodeEmail = functions.https.onRequest((req, res) => {
  const { mail, name } = req.query;
  if (!mail) return res.send('No mail specified');

  sendCodeEmail(mail, name, feedBack => res.send(feedBack));
  return res.send('Sending email...');
});
