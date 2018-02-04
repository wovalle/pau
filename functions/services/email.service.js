const nodemailer = require('nodemailer');

module.exports = class emailService {
  constructor(email, password, appName) {
    this.email = email;
    this.password = password;
    this.appName = appName;
  }

  sendConfirmationCodeEmail(email, url, cb) {
    const mailTransport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.email,
        pass: this.password,
      },
    });

    const mailOptions = {
      from: `${this.appName} <noreply@firebase.com>`,
      to: email,
    };

    mailOptions.subject = `${this.appName}: Email confirmation`;
    mailOptions.text = `
      Hey! Welcome to ${this.appName}!

      Please confirm your Email address now. Click on the following link to confirm your email:
      ${url}
    `;

    mailTransport.sendMail(mailOptions).then((error, info) => {
      let feedBackMsg = '';
      if (error) {
        feedBackMsg = error;
        console.error(error);
      } else {
        feedBackMsg = `New code email sent to ${email}`;
        console.log('Message sent: %s', info.messageId);
        console.log('New welcome email sent to:', email);
      }
      if (cb) cb(feedBackMsg);
    });
  }
};
