var discoveryMan = require('./DiscoveryManager.js');
var httpSrv = require('./HttpServer.js');
var config = require('./config');
var Rx = require('rx');
// Initialize logger
require('./Logger.js');
var logger = require('intel').getLogger('Redlight');
var GameListManager = require('./GamesListManager');


GameListManager.init().subscribeOnCompleted(function () {
    // Start HTTPS server
    httpSrv.httpsObservable().subscribe(Rx.Observer.create(
        function (obj) {
            if (obj.event === 'start') {
                logger.debug('Starting mDNS service publishing');
                discoveryMan.startZeroconfService();
            }
            logger.debug('HTTPS server message:', obj);
        },
    function (error) {
            logger.error('HTTPS server error:', error);
        },
    function (done) {
            logger.debug('HTTPS server stopped');
        }
    ));
});