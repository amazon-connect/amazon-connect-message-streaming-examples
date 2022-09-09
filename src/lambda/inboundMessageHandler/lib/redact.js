const { log } = require('common-util');
const AWS = require('aws-sdk');
let comprehend = new AWS.Comprehend({ apiVersion: '2017-11-27' });
let piiDetectionTypes = process.env.PII_DETECTION_TYPES;
const piiDetectionTypeArray = piiDetectionTypes.split(/[ ,]+/);

const redactPII = async (message) => {

    log.debug(`RedactPII called: ${message}`);

    return new Promise(function (resolve, reject) {
        let redactedMessage = message;

        const params = {
            Text: message,
            /* required STRING_VALUE */
            LanguageCode: "en" /* Only English (en) is supported as of May 2022 */
            /* possible country codes: en | es | fr | de | it | pt | ar | hi | ja | ko | zh | zh-TW */
        };
        comprehend.detectPiiEntities(params, function (err, data) {
            if (err) {
                log.error(err, err.stack); // an error occurred
                return reject(err, err.stack);
            }
            else {
                log.debug(data); // log successful response from Comprehend
                
                // Get a list of PII entities we care about and put them in a dict with BeginOffset as keys
                let entitiesToRedact = {};
                for (let entity = 0; entity < data.Entities.length; entity++) {
                    if (piiDetectionTypeArray.includes(data.Entities[entity].Type)) {
                        entitiesToRedact[data.Entities[entity].BeginOffset] = data.Entities[entity]
                    }                        
                }
                log.debug ("entitiesToRedact: ", entitiesToRedact);
                
                // Create an array of BeginOffsets to allow replacing each entity back to front 
                let beginOffsets = Object.keys(entitiesToRedact).reverse();
                
                // Replace each entity in the message string. 
                beginOffsets.forEach((key) => {
                    log.debug("offset: ", key );
                    let beginOffset = entitiesToRedact[key].BeginOffset
                    let endOffset = entitiesToRedact[key].EndOffset
                    let type = entitiesToRedact[key].Type
                    redactedMessage = redactedMessage.substr(0,beginOffset) + "<" + type + ">" + redactedMessage.substr(endOffset) 
                });

                log.debug(`final redacted message in comprehend function ${redactedMessage}`);
                resolve(redactedMessage);
            }
        });
    })
};

module.exports = {
    redactPII
};
