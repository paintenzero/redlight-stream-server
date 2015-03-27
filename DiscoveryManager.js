var mdns = require("mdns");
var os = require("os");
var builder = require('xmlbuilder');
var extend = require('extend');
var uuid = require('uuid');
var CryptoManager = require('./CryptoManager');
/**
 * Class for an zeroconf advertiser
 */ 
function ZCAdvertiser(serviceName, port) {
    var opts = {
        name: "Redlight server on " + os.hostname()
    };
    this.advertiser = mdns.createAdvertisement(serviceName, port, opts);
    this.advertiser.on('error', function (err) {
        console.log('Zeroconf server error!', err);
    });
    this.start = function () {
        this.advertiser.start();
    };
    this.stop = function () { this.advertiser.stop(); };
    
};
// Advertiser for _nvstream._tcp
var nvstreamAdvertiser = new ZCAdvertiser(mdns.tcp("nvstream"), 8888);
/**
 * Starts service advertising using zeroconf
 */ 
module.exports.startZeroconfService = function () {
    nvstreamAdvertiser.start();
};
/**
 * Stops advertising a service using zeroconf
 */
module.exports.stopZeroconfService = function () {
    nvstreamAdvertiser.stop();
};
/**
 * Returns XML for computerinfo request
 * @param object will be merged into root element
 */
module.exports.computerInfoXML = function (RootElement) {
    //Zip future observables...
    return CryptoManager.getServerId().map(function (serverId) {
        var netInterfaces = os.networkInterfaces();
        var macAddress = '00:00:00:00:00:00';
        var ipAddress = '';
        if (netInterfaces['Ethernet']) {
            console.log(netInterfaces['Ethernet'][0]);
            macAddress = netInterfaces['Ethernet'][0].mac;
        }
                
        RootElement = builder.create({ root: RootElement }, { version: '1.0', encoding: 'UTF-16' });
        RootElement.ele('AuthenticationType', 1);
        RootElement.ele('ConnectionState', 1);
        RootElement.ele('CurrentClient', 0);
        RootElement.ele('HttpsPort', 47984);
        RootElement.ele('LocalIp', '127.0.0.1');
        RootElement.ele('Mode', 0);
        RootElement.ele('PairStatus', 0);
        RootElement.ele('ServerCapability', 23);
        RootElement.ele('appversion', '4.0.1000.0');
        RootElement.ele('currentgame', 0);
        RootElement.ele('gamelistid', 0);
        RootElement.ele('gputype', 'Some Radeon graphics');
        RootElement.ele('hostname', os.hostname());
        RootElement.ele('mac', macAddress);
        RootElement.ele('numofapps', 0);
        RootElement.ele('state', 'MJOLNIR_STATE_SERVER_AVAILABLE');
        RootElement.ele('uniqueid', serverId);
        
        return RootElement.end({ pretty: false });
    });

    
};