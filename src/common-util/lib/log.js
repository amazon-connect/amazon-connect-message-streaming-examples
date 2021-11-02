// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const isDebugEnabled = () => process.env.DEBUG_LOG === 'true';

const log = (level, msg, params) => {
  if (level === 'DEBUG' && !isDebugEnabled()) {
    return;
  }

  const logMsg = {};
  logMsg.level = level;
  logMsg.message = msg;
  logMsg.params =
    params instanceof Error
      ? { message: params.toString(), stack: params.stack }
      : params;

  try {
    const vals = [];
    const message = JSON.stringify(logMsg, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (vals.indexOf(value) !== -1) {
          try {
            return JSON.parse(JSON.stringify(value));
          } catch (error) {
            return null;
          }
        }
        vals.push(value);
      }
      return value;
    });

    console.log(message);
  } catch (err) {
    log('ERROR', 'Failure stringifing log message', { error: err });
  }
};

module.exports.debug = (msg, params) => log('DEBUG', msg, params);
module.exports.info = (msg, params) => log('INFO', msg, params);
module.exports.warn = (msg, params) => log('WARN', msg, params);
module.exports.error = (msg, params) => log('ERROR', msg, params);
