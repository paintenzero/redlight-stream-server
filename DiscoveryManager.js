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
module.exports.computerInfoXML = function (header) {
    //Zip future observables...
    return CryptoManager.getServerId().map(function (serverId) {
        var netInterfaces = os.networkInterfaces();
        var macAddress = '00:00:00:00:00:00';
        if (netInterfaces['Ethernet']) {
            macAddress = netInterfaces['Ethernet'][0].mac;
        }
        
        var RootElement = {
            '@protocol_version': 0.1
        };
        if (header) {
            extend(false, RootElement, header);
        }
        
        RootElement = builder.create({ root: RootElement }, { version: '1.0', encoding: 'UTF-16' });
        RootElement.ele('CurrentClient', 0);
        RootElement.ele('HttpsPort', 47984);
        RootElement.ele('PairStatus', 0);
        RootElement.ele('appversion', '3.2.2');
        RootElement.ele('currentgame', 0);
        RootElement.ele('gamelistid', 0);
        RootElement.ele('hostname', os.hostname());
        RootElement.ele('mac', macAddress);
        RootElement.ele('numofapps', 0);
        RootElement.ele('state', 'MJOLNIR_STATE_SERVER_AVAILABLE');
        RootElement.ele('uniqueid', serverId);
        
        return RootElement.end({ pretty: false });
    });

    
};