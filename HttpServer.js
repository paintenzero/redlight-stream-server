var https = require('https');
var CryptoManager = require('./CryptoManager.js');
var Rx = require('rx');
var config = require('./config');
var logger = require('intel').getLogger('Redlight.HTTP');
var express = require('express');
var discoveryMan = require('./DiscoveryManager.js');
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

function createExpress() {
    var app = express();
    app.get('/', function (req, res) {
        res.send('Redlight server');
        res.end();
    });
    app.get('/serverinfo', serverInfo);
    return app;
}

function serverInfo(req, res) {
    logger.debug('serverinfo requested');
    //var clientId = req.query.uniqueid;
    var resp = discoveryMan.computerInfoXML({
        '@query': 'serverinfo',
        '@status_code': 200,
        '@status_message': 'OK'
    });
    res.set({
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': resp.length
    });
    logger.debug('serverinfo response', resp);
    res.write(resp);
    res.end();
}

/**
 * 
 */ 
module.exports.httpsObservable = function () {
    return createHTTPSObservable();
    /*if (httpsListening) return Rx.Observable.return(true);

    

    var httpsSrvObservable = null;
    if (httpsSrv === null) { // If HTTPS server was not created, create it
        httpsSrvObservable = .
        map(function (credentials) {
            httpsSrv = 
            return httpsSrv;
        });
    } else {
        httpsSrvObservable = Rx.Observable.return(httpsSrv);
    }
    return httpsSrvObservable.flatMap(function (srv) {
        logger.debug('Start listening HTTPS port', port);
        //srv.listen(port, function (arg0) { console.log(arg0); });
        return Rx.Observable.fromCallback(srv.listen)(port);
    });*/
};