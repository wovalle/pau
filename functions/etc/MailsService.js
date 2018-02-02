const nodemailer = require('nodemailer');

const APP_NAME = 'test_pau';

exports.sendCodeEmail = (
  senderGmail,
  senderPassword,
  recipientEmail,
  recipientName,
  callback = null,
) => {
  const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: senderGmail,
      pass: senderPassword,
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
};
