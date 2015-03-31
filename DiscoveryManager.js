var mdns = require("mdns");
var os = require("os");
var extend = require('extend');
var uuid = require('uuid');
var CryptoManager = require('./CryptoManager');
var PairingManager = require('./PairingManager');
var GamesListManager = require('./GamesListManager');
var config = require('./config');
var Rx = require('rx');
var Platform = require('./Platform.js');
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
module.exports.computerInfoXML = function (RootElement, deviceId) {
    return Rx.Observable.zip(
        CryptoManager.getServerId(),
        PairingManager.getDevicePairedStatus(deviceId),
        Platform.GetVideoCardName(),
        function (serverId, pairedStatus, videocard) {
            var addr = getAddresses();
            
            RootElement.ele('AuthenticationType', 1);
            RootElement.ele('ConnectionState', 1);//Unknown
            RootElement.ele('HttpsPort', 47984);
            
            RootElement.ele('Mode', 0);//Unknown
            RootElement.ele('PairStatus', pairedStatus ? 1 : 0);
            RootElement.ele('ServerCapability', config.get('gamestream.ServerCapability'));
            RootElement.ele('appversion', config.get('gamestream.appversion'));
            
            RootElement.ele('gputype', videocard); //TODO: detect graphics card somehow...
            
            RootElement.ele('hostname', os.hostname());
            if (addr.mac) {
                RootElement.ele('mac', addr.mac);
            }
            if (addr.LocalIp) {
                RootElement.ele('LocalIp', addr.LocalIp);
            }
            
            RootElement.ele('state', 'MJOLNIR_STATE_SERVER_AVAILABLE'); //Possible states unknown
            RootElement.ele('uniqueid', serverId);
            
            RootElement.ele('CurrentClient', 0);//TODO: set client's id
            
            RootElement.ele('currentgame', 0); //TODO: send game id if is running
            RootElement.ele('gamelistid', 0); //Unknown
            RootElement.ele('numofapps', 0); //TODO: set
            
            return RootElement;
        }
    );
};
/**
 * Returns addresses of the PC
 */ 
function getAddresses() {
    var netInterfaces = os.networkInterfaces();
    var obj = {};
    if (netInterfaces['Ethernet']) {
        for (var i in netInterfaces['Ethernet']) {
            var iface = netInterfaces['Ethernet'][i];
            if (iface['family'] == 'IPv4') {
                obj['LocalIp'] = iface['address'];
                obj['mac'] = iface['mac'];
            }
        }
    }
    return obj;
}