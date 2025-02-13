const express = require('express');
const authRouter = require('./auth');

const rootRouter = express.Router();

rootRouter.use('/auth', authRouter);

module.exports = rootRouter;