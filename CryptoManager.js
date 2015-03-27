var fs = require('fs');
var path = require('path');
var Rx = require('rx');
var pem = require('pem');
var logger = require('intel').getLogger('Redlight.Crypto');
var storage = require('./storage');
var config = require('./config');
var crypto = require('crypto');
var extend = require('extend');
var asn1decode = require('sasn1').decode;

pem.config({
    pathOpenSSL: __dirname + path.sep + 'openssl' + path.sep + 'openssl.exe'
});
process.env['OPENSSL_CONF'] = __dirname + path.sep + 'openssl' + path.sep + 'openssl.cnf';

/**
 * Returns server's unique id
 */ 
module.exports.getServerId = function () {
    return storage.settingsObservable().
    map(function (row) {
        return row.serverId;
    });
};
/**
 * Returns pair of certifivate and private key.
 */ 
function getCredentials(baseName) {
    //paths
    var keysDir = __dirname + path.sep + config.get('server.key-dir');
    var certPath = keysDir + path.sep + baseName + '.crt';
    var keyPath = keysDir + path.sep + baseName + '.key';
    //
    var getKeys = Rx.Observable.fromCallback(fs.exists)(keysDir).
    flatMap( // If keys folder doesn't exists => create
        function (exists) {
            if (exists) return Rx.Observable.return(keysDir);
            else {
                logger.debug("Creating keys directory");
                return Rx.Observable.fromNodeCallback(fs.mkdir)(keysDir).map(function () { return keysDir; });
            }
        }
    ).
    flatMap( // Check for keys existance in the folder
        function (dir) {
            return Rx.Observable.zip(
                Rx.Observable.fromCallback(fs.exists)(keyPath),
                Rx.Observable.fromCallback(fs.exists)(certPath),
                function (keyExists, certExists) { return keyExists && certExists }
            );
        }
    ).
    flatMap( // If keys exist => read them, if not => create and save
        function (exists) {
            if (exists) {
                logger.debug("Reading pre-generated %s credentials", baseName);
                return Rx.Observable.zip(
                    Rx.Observable.fromNodeCallback(fs.readFile)(keyPath),
                    Rx.Observable.fromNodeCallback(fs.readFile)(certPath),
                    function (key, cert) {
                        return { key: key.toString(), cert: cert.toString() };
                    }
                );
            } else {
                logger.debug("Generating new %s credentials", baseName);
                return Rx.Observable.fromNodeCallback(pem.createCertificate)({
                    days: 30 * 365,
                    selfSigned: true
                }).
                flatMap(function (generated) {
                    return Rx.Observable.zip(
                        Rx.Observable.fromNodeCallback(fs.writeFile)(keyPath, generated.clientKey),
                        Rx.Observable.fromNodeCallback(fs.writeFile)(certPath, generated.certificate),
                        function (arg0, arg1) {
                            return { key: generated.clientKey, cert: generated.certificate };
                        }
                    );
                });
            }
        }
    );
    return getKeys;
}

/**
 * Returns promise for HTTPS credentials
 */ 
module.exports.getHTTPSCredentials = function () {
    return getCredentials('https');
};
/**
 * Returns server's certificate
 */ 
module.exports.getServerCertificate = function () {
    return getCredentials('server').map(function (creds) {
        return creds.cert;
    });
};
/**
 * Returns server's private key
 */ 
module.exports.getServerPrivateKey = function () {
    return getCredentials('server').map(function (creds) {
        return creds.key;
    });
};
/**
 * Creates and returns a cipher for device
 */
function getDeviceCipher(deviceId, isDecipher) {
    return storage.getDevice(deviceId).
    map(function (row) {
        if (row) {
            var saltAndPin = row.key;
            var shasum = crypto.createHash('sha1');
            shasum.update(saltAndPin);
            var sha1 = shasum.digest().slice(0, 16);
            var key = !!!isDecipher ? crypto.createCipheriv('AES-128-ECB', sha1, '') : crypto.createDecipheriv('AES-128-ECB', sha1, '');
            key.setAutoPadding(false);
            return key;
        } else {
            return null;
        }
    });
};
/**
 * Encrypts text for the device specified
 */
module.exports.deviceEncrypt = function (deviceId, buffer) {
    return getDeviceCipher(deviceId).
    map(function (cipher) {
        var blockRoundedSize = Math.floor((buffer.length + 15) / 16) * 16;
        var padding = new Buffer(blockRoundedSize - buffer.length); padding.fill(0);
        var blockRoundedData = Buffer.concat([buffer, padding]);
        return Buffer.concat([cipher.update(blockRoundedData), cipher.final()]);
    });
};
/**
 * Encrypts text for the device specified
 */
module.exports.deviceDecrypt = function (deviceId, buffer) {
    return getDeviceCipher(deviceId, true).
    map(function (decipher) {
        return Buffer.concat([decipher.update(buffer), decipher.final()]);
    });
};
/**
 * Returns client's secret
 */ 
module.exports.getClientSecret = function () {
    return storage.getDeviceData(deviceId).
    map(function (data) {
        return data.clientSecret;
    });
};
/**
 * Returns client's challenge
 */ 
module.exports.getClientChallenge = function () {
    return storage.getDeviceData(deviceId).
    map(function (data) {
        return data.clientChallenge;
    });
};
/**
 * Returns server's secret for given device.
 * If there is none, generates new one
 */
module.exports.getServerSecret = function (deviceId) {
    return getOrGenerate(deviceId, "serverChallenge", 16);
};
/**
 * Returns server's challenge for given device.
 * If there is none, generates new one
 */
module.exports.getServerChallenge = function (deviceId) {
    return getOrGenerate(deviceId, "serverSecret", 16);
};
/**
 * Actually gets key from database or generates random bytes
 */ 
function getOrGenerate(deviceId, key, size) {
    return storage.getDeviceData(deviceId).
    flatMap(function (data) {
        if (typeof data[key] !== 'undefined') {
            return Rx.Observable.just(hex2Buffer(data[key]));
        } else {
            return Rx.Observable.fromNodeCallback(crypto.randomBytes)(size).
            flatMap(function (rand) {
                var obj = {};
                obj[key] = buffer2hex(rand);
                return storage.updateDeviceData(deviceId, obj).
                map(function (_) {
                    return rand;
                });
            });
        }
    });
}
/**
 * Converts string of HEX values to Buffer
 */
function hex2Buffer(hex) {
    var aBuffer = new Buffer(hex.length / 2);
    var byte, i;
    for (i = 0; i < hex.length; i += 2) {
        byte = parseInt(hex.substr(i, 2), 16);
        aBuffer.writeUIntLE(byte, i / 2, 1);
    }
    return aBuffer;
}
module.exports.hex2Buffer = hex2Buffer;
/**
 * Converts buffer to string of HEX values
 */ 
function buffer2hex(buffer) {
    var hex = '';
    var byte, i;
    for (i = 0; i < buffer.length; ++i) {
        hex += ('0' + buffer.readUInt8(i).toString(16)).slice(-2).toUpperCase();
    }
    return hex;
}
module.exports.buffer2hex = buffer2hex;
/**
 * Returns signature of the PEM-encoded certificate.
 */ 
module.exports.getCertificateSignature = function (pemCertificate) {
    var arr = pemCertificate.split('\n');
    arr = arr.slice(1, arr.length - 1);
    var b64str = '';
    for (var i = 0, ii = arr.length; i < ii; ++i)
        b64str += arr[i].trim();
    var derCert = new Buffer(b64str, 'base64');
    
    var parsed = asn1decode(derCert);
    var signature = parsed[parsed.length - 1]; //signature is the last BIT STRING. See here: http://www.codeproject.com/Questions/252741/Where-is-the-signature-value-in-the-certificate
    if (signature instanceof Buffer) {
        return signature.slice(1); //first byte is always 00, why?
    } else {
        return null;
    }
};
/**
 * Signs data using given private key
 */ 
module.exports.signData = function (data) {
    return module.exports.getServerPrivateKey().
    map(function (privateKey) {
        var sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        return sign.sign(privateKey);
    });
};
/**
 * Verify signature against data and certificate
 */
module.exports.verifySignature = function (signature, data, certificate) {
    var verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return Rx.Observable.just(verify.verify(certificate, signature));
};