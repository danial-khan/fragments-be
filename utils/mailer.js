const nodemailer = require("nodemailer");
const { config } = require("../config");

const mailer = nodemailer.createTransport({
  host: config.SMTP_HOST,
  secure: true,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  },
});

module.exports.sendEmail = async (email, subject, emailTemplate) => {
    return await mailer.sendMail({
        from: '"Fragments" <no-reply@fragments.com>',
        to: email,
        subject: subject,
        html: emailTemplate,
    });
}

module.exports.mailer = mailer;
