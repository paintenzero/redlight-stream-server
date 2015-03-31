var https = require('https');
var CryptoManager = require('./CryptoManager');
var Rx = require('rx');
var config = require('./config');
var logger = require('intel').getLogger('Redlight.HTTP');
var express = require('express');
var discoveryMan = require('./DiscoveryManager');
//var PinRequester = require('./PinRequester');
var Platform = require('./Platform');
var PairingManager = require('./PairingManager');
var GamesListManager = require('./GamesListManager');
var builder = require('xmlbuilder');
var storage = require('./storage');
/**
 * Creates observable for HTTPS server
 */ 
function createHTTPSObservable() {
    return Rx.Observable.create(function (observer) {
        // Read HTTPS port from config file
        var port = config.get('server.https-port');
        if (!port) {
            logger.error('Unable to read HTTPS server port from file, setting default: 47984');
            port = 47984;
        }
        var srv, app;
        CryptoManager.getHTTPSCredentials().subscribe(Rx.Observer.create(
            function (credentials) { // Received HTTPS credentials, create server
                logger.debug('Creating HTTPS server at', port, 'port');
                srv = https.createServer(credentials, createExpress());
                srv.listen(port, function () {
                    logger.info('HTTPS Server started at', port, 'port');
                    observer.onNext({ 'event': 'start' });
                });
                srv.on('close', function () {
                    observer.onCompleted();
                });
            },
            observer.onError
        ));        
        return function () {
            logger.debug('HTTPS dispose called');
            srv.close();
        };
    });
}
/**
 * 
 */ 
function createExpress() {
    var app = express();
    app.get('/', function (req, res) {
        res.send('Redlight server');
        res.end();
    });
    app.get('/serverinfo', serverInfo);
    app.get('/pair', pairApp);
    app.get('/unpair', unpairApp);
    app.get('/applist', appListApp);
    return app;
}
/**
 * Request to get server's information
 */ 
function serverInfo(req, res) {
    logger.debug('serverinfo requested');
    discoveryMan.computerInfoXML(createXMLRootElement('serverinfo', 200)).subscribe(xmlRequestObserver(req, res));
}
/**
 * Request to pair server with client device
 */ 
function pairApp(req, res) {
    logger.debug('pairing request: ' + JSON.stringify(req.query));
    if (req.query.uniqueid) {
        var deviceId = req.query.uniqueid;
        if (req.query.phrase) {
            if (req.query.phrase === 'getservercert') {
                return getServerCert(req, res, deviceId);
            } else if (req.query.phrase === 'pairchallenge') {
                return pairChallenge(req, res, deviceId);
            }
        } else if (req.query.clientchallenge) {
            return clientChallenge(req, res, deviceId);
        } else if (req.query.serverchallengeresp) {
            return serverChallengeResponse(req, res, deviceId);
        } else if (req.query.clientpairingsecret) {
            return clientPairingSecret(req, res, deviceId);
        }
    }
    res.status(400).end();
}
/**
 * Pairing request: getServerCert
 */ 
function getServerCert(req, res, deviceId) {
    var salt = CryptoManager.hex2Buffer(req.query.salt);
    var clientcert = CryptoManager.hex2Buffer(req.query.clientcert);
    var devicename = req.query.devicename;
    
    var subscription = Platform.GetPin().
    flatMap(function (pin) { // Create full key from salt + pin and save it to database
        var saltAndPin = PairingManager.createSaltAndPin(salt, pin);
        return storage.saveDevice(deviceId, devicename, clientcert, saltAndPin);
    }).
    flatMap(function () {
        return PairingManager.certificateResponseXML(createXMLRootElement('pair', 200));
    }).
    subscribe(xmlRequestObserver(req, res));

    req.on('close', function () {
        subscription.dispose();
    });
}
/**
 * Pairing request: client challenge
 */ 
function clientChallenge(req, res, deviceId) {
    CryptoManager.deviceDecrypt(deviceId, CryptoManager.hex2Buffer(req.query.clientchallenge)).
    flatMap(function (decryptedChallenge) {
        return storage.updateDeviceData(deviceId, { "clientChallenge": CryptoManager.buffer2hex(decryptedChallenge) }).
        map(function (_) { return decryptedChallenge; });
    }).
    flatMap(function (decryptedChallengeBuffer) {
        return PairingManager.clientChallengeResponseXML(createXMLRootElement('pair', 200), deviceId, decryptedChallengeBuffer);
    }).
    subscribe(xmlRequestObserver(req, res));
}
/**
 * Pairing request: server challenge response
 */ 
function serverChallengeResponse(req, res, deviceId) {
    return storage.updateDeviceData(deviceId, { "clientSecretHash": req.query.serverchallengeresp }).
    flatMap(function () {
        return PairingManager.serverChallengeResponseXML(createXMLRootElement('pair', 200), deviceId);
    }).
    subscribe(xmlRequestObserver(req, res));
}
/**
 * Request for client's pairing secret
 */ 
function clientPairingSecret(req, res, deviceId) {
    var clientPairingSecret = CryptoManager.hex2Buffer(req.query.clientpairingsecret);
    var clientSecret = clientPairingSecret.slice(0, 16);
    var clientSecretSignature = clientPairingSecret.slice(16, 272);
    return storage.getDevice(deviceId).
    map(function (device) {
        return CryptoManager.verifySignature(clientSecretSignature, clientSecret, device.certificate);
    }).
    flatMap(function (checkResult) {
        return PairingManager.setPairedStatus(deviceId, checkResult);
    }).
    map(function (checkResult) {
        if (checkResult) {
            return PairingManager.createXML(createXMLRootElement('pair', 200), {});
        } else {
            logger.error('Client secret signature verification failed');
            return PairingManager.createXML(createXMLRootElement('pair', 200), {'paired': 0});
        }
    }).
    subscribe(xmlRequestObserver(req, res));
}
/**
 * Last pair challenge
 */ 
function pairChallenge(req, res, deviceId) {
    storage.getDevice(deviceId).
    flatMap(function (device) {
        return PairingManager.getDevicePairedStatus(deviceId)
    }).
    map(function (isPaired) {
        var obj = { 'paired': isPaired ? 1 : 0 };
        return PairingManager.createXML(createXMLRootElement('pair', 200), obj);
    }).
    subscribe(xmlRequestObserver(req, res));
}
/**
 * Unpairing requst
 */ 
function unpairApp(req, res) {
    //TODO: check what GFE server sends here
    logger.debug('pairing request: ' + JSON.stringify(req.query));
    var deviceid = req.query.uniqueid;
    storage.removeDevice(deviceid).
    map(function (_) {
        return PairingManager.createXML(createXMLRootElement('pair', 200), { 'paired': 0 });
    }).
    subscribe(xmlRequestObserver(req, res));
}

function appListApp(req, res) {
    var deviceId = req.query.uniqueid;
    PairingManager.getDevicePairedStatus(deviceId).
    map(function (paired) {
        if (paired) {
            return GamesListManager.GetGamesListXML(createXMLRootElement('applist', 200));
        } else {
            return createXMLRootElement('applist', 401, 'Not Paired');
        }
    }).
    subscribe(xmlRequestObserver(req, res));
};

/**
 * Observer for sending XML to HTTP response
 */
function xmlRequestObserver(req, res) {
    return Rx.Observer.create(
        function (xml) {
            var xmlText = xml.end({ pretty: false });
            res.set({
                'Content-Type': 'text/xml; charset=utf-8',
                'Content-Length': xmlText.length
            });
            res.write(xmlText);
        },
        function (err) {
            logger.error("Request %s error: %s", req.path, err.message, err.stack);
            res.status(500).end();
        },
        function () {
            res.end();
        }
    );
}
/**
 * Creates HTTP server observable with start / stop / errors signals
 */ 
module.exports.httpsObservable = function () {
    return createHTTPSObservable();
};

function createXMLRootElement(query, status, statusMessage) {
    var RootElement = {
        '@protocol_version': 0.1,
        '@query': query,
        '@status_code': status,
        '@status_message': statusMessage || 'OK'
    };
    return builder.create({ root: RootElement }, { version: '1.0', encoding: 'UTF-16' });
}
