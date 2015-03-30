var Rx = require('rx');
var CryptoManager = require('./CryptoManager');
var builder = require('xmlbuilder');
var storage = require('./storage');
var crypto = require('crypto');

var logger = require('intel').getLogger('Redlight.Pairing');

/**
 * Creates new buffer from salt and pin
 */ 
module.exports.createSaltAndPin = function (salt, pin) {
    var saltAndPin = new Buffer(salt.length + 4);
    salt.copy(saltAndPin, 0, 0, salt.length);
    saltAndPin.write("" + pin, salt.length, 4, 'utf8');
    return saltAndPin;
};
/**
 * Return XML for certificate request?
 */ 
module.exports.certificateResponseXML = function (RootElement) {
    return CryptoManager.getServerCertificate().
    map(function (cert) {
        var certHex = CryptoManager.buffer2hex(new Buffer(cert));
        return { 'plaincert': certHex };
    }).
    map(createXML.bind(null, RootElement));
};
/**
 * Creates XML for client challenge request
 */ 
module.exports.clientChallengeResponseXML = function (RootElement, deviceId, clientChallengeBuffer) {
    return CryptoManager.getServerSecret(deviceId).
    flatMap(function (serverSecretBuffer) {
        return CryptoManager.getServerCertificate().
        map(function (certificate) { // Create first part of client's challenge response
            var signature = CryptoManager.getCertificateSignature(certificate);
            logger.debug('clientChallengeBuffer %s', CryptoManager.buffer2hex(clientChallengeBuffer));
            logger.debug('signature %s', CryptoManager.buffer2hex(signature));
            logger.debug('serverSecretBuffer %s', CryptoManager.buffer2hex(serverSecretBuffer));
            var buf = Buffer.concat([clientChallengeBuffer, signature, serverSecretBuffer]);
            return buf;
        });
    }).
    flatMap(function (serverResponse) {
        var sha1hash = crypto.createHash('sha1');
        sha1hash.update(serverResponse);
        var serverResponseHash = sha1hash.digest();
        
        logger.debug('SHA1 of server response %s', CryptoManager.buffer2hex(serverResponseHash));
        
        return CryptoManager.getServerChallenge(deviceId).
        flatMap(function (challenge) {
            logger.debug('Server challenge: %s', CryptoManager.buffer2hex(challenge));
            var challengeResponseBuffer = Buffer.concat([serverResponseHash, challenge]);

            return CryptoManager.deviceEncrypt(deviceId, challengeResponseBuffer). //Encrypt server's response
            map(function (encryptedChallengeResponse) {
                return createXML(RootElement, { 'challengeresponse': CryptoManager.buffer2hex(encryptedChallengeResponse) });
            });
        });
    });
};
/**
 * Forms XML response for server challenge
 */ 
module.exports.serverChallengeResponseXML = function (RootElement, deviceId) {
    return CryptoManager.getServerSecret(deviceId).
    flatMap(function (serverSecret) {
        return CryptoManager.signData(serverSecret).
        map(function (signedSecret) {
            return Buffer.concat([serverSecret, signedSecret]);
        });
    }).
    map(function (pairingSecretBuffer) {
        var pairingSecretHex = CryptoManager.buffer2hex(pairingSecretBuffer);
        return createXML(RootElement, { 'pairingsecret': pairingSecretHex });
    });
};
/**
 * Creates pairing response xml
 */ 
function createXML(RootElement, data) {
    RootElement = builder.create({ root: RootElement }, { version: '1.0', encoding: 'UTF-16' });
    RootElement.ele('challengeresponse', data['challengeresponse'] || '');
    RootElement.ele('encodedcipher', '');
    RootElement.ele('isBusy', 0);
    RootElement.ele('paired', data['paired'] || 1);
    RootElement.ele('pairingsecret', data['pairingsecret'] || '');
    RootElement.ele('plaincert', data['plaincert'] || '');

    return RootElement.end({ pretty: false });
}
module.exports.createXML = createXML;
/**
 * Returns observable for device paired status
 */ 
module.exports.getDevicePairedStatus = function (deviceId) {
    return storage.getDevice(deviceId).map(function (row) {
        if (!row) return false;
        return !!row.paired;
    });
};
/**
 * Sets device paired status
 */ 
module.exports.setDevicePairedStatus = function (deviceId, status) {
    return storage.setDevicePaired(deviceId, status).map(function (_) { return status; });
};