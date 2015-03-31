var Winreg = require('winreg');
var Rx = require('rx');
var logger = require('intel').getLogger('Redlight.GamesList');
var crypto = require('crypto');
var extend = require('extend');
var path = require('path');

var inited = false;
var GamesList = [];
/**
 * Initializes the module. Searches for games installed on the computer
 */ 
module.exports.init = function () {
    return Rx.Observable.create(function (subscriber) {
        getGamesList().subscribe(Rx.Observer.create(
            function (game) {
                logger.debug('Found: %s', JSON.stringify(game));
                GamesList.push(game);
            },
            function (err) {
                logger.error('Unable to get games list: ', err.message);
            },
            function () {
                logger.debug('Found games: %d', this.count);
                subscriber.onCompleted();
            }.bind(this)
        ));
        return function () {
            //Dispose?
        }
    }.bind(this));
}
/**
 * Returns apps count
 */ 
module.exports.__defineGetter__('count', function () { return GamesList.length; });
/**
 * Returns apps list
 */ 
module.exports.__defineGetter__('list', function () { return GamesList; });
/**
 * Creates games list
 */ 
function getGamesList() {
    //Search for common apps
    return Rx.Observable.merge(
        findGameInRegistry('Steam', Winreg.HKCU, '\\Software\\Valve\\Steam\\SteamExe', 'Steam'),
        findGameInRegistry('WarThunder', Winreg.HKCU, '\\Software\\Gaijin\\WarThunder\\Path', 'Gaijin')
    ).map(function (game) {
        var newGame = {};
        extend(false, newGame, game);
        newGame.path = path.normalize(newGame.path);
        newGame.id = stringToDigits(game.name);
        return newGame;
    });
}
/**
 * Converts game name into digital ID
 */ 
function stringToDigits(str) {
    var hash = crypto.createHash('sha1');
    hash.update(str);
    return parseInt(hash.digest('hex'), 16) % Math.pow(10, 8);
}
/**
 * Returns observable for registry key value
 */
function regKeyObservable(hive, key, def) {
    var keyArr = key.split('\\');
    var itemName = keyArr.splice(-1);
    
    var regKey = new Winreg({
        hive: hive,
        key: keyArr.join('\\')
    });
    
    return Rx.Observable.fromNodeCallback(regKey.get.bind(regKey))(itemName)
    .map(function (item) {
        return item.value;
    }).catch(Rx.Observable.just(def));
}
/**
 * Searches for a game in registry and returns 
 */ 
function findGameInRegistry(name, hive, regKey, distributor) {
    return regKeyObservable(hive, regKey, null).filter(function (value) { return value !== null; }).map(function (value) {
        return {
            'name': name,
            'path': value,
            'distributor': distributor,
            'running': 0
        }
    });
}

module.exports.GetGamesListXML = function (RootElement) {
    
    for (var i in GamesList) {
        var app = RootElement.ele('App');
        app.ele('ID', GamesList[i].id);
        app.ele('AppInstallPath', GamesList[i].path);
        app.ele('AppTitle', GamesList[i].name);
        app.ele('Distributor', GamesList[i].distributor);
        app.ele('UniqueId', GamesList[i].id);
        app.ele('IsRunning', GamesList[i].running);
    }

    return RootElement;
};