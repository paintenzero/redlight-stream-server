var fs = require('fs');
var path = require('path');
var Rx = require('rx');
var pem = require('pem');
var logger = require('intel').getLogger('Redlight.Crypto');
var storage = require('./storage');

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
 * Returns promise for HTTPS credentials
 */ 
module.exports.getHTTPSCredentials = function () {
    //paths
    var keysDir = __dirname + path.sep + 'keys';
    var certPath = keysDir + path.sep + 'https.crt';
    var keyPath = keysDir + path.sep + 'https.key';
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
                logger.debug("Reading pre-generated HTTPS credentials");
                return Rx.Observable.zip(
                    Rx.Observable.fromNodeCallback(fs.readFile)(keyPath),
                    Rx.Observable.fromNodeCallback(fs.readFile)(certPath),
                    function (key, cert) {
                        return { key: key.toString(), cert: cert.toString() };
                    }
                );
            } else {
                logger.debug("Generating new HTTPS credentials");
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
};