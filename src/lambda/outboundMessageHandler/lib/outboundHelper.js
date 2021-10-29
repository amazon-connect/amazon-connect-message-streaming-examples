const AWS = require('aws-sdk');
const { log } = require('common-util');

const ddb = new AWS.DynamoDB.DocumentClient();

const PARTICIPANT_LEFT_CONTENT_TYPE =
  'application/vnd.amazonaws.connect.event.participant.left';

const { CONTACT_TABLE } = process.env;

const lookupContactId = async (contactId) => {
  const params = {
    TableName: CONTACT_TABLE,
    Key: {
      contactId,
    },
  };

  log.debug('Contact Id Lookup Request', params);
  const result = await ddb.get(params).promise();
  log.debug('Contact Id Lookup Result', result);

  if (result.Item === undefined || result.Item === null) {
    log.warn(`No Contact Match Found for ${contactId}`);
    return null;
  }

  return result.Item.contactId !== undefined ? result.Item : null;
};

const deleteRecord = async (contactId) => {
  const params = {
    TableName: CONTACT_TABLE,
    Key: {
      contactId,
    },
  };

  log.debug('Contact Id Delete Request', params);
  const result = await ddb.delete(params).promise();
  log.debug('Contact Id Delete Result', result);
};

module.exports = {
  lookupContactId,
  deleteRecord,
};
