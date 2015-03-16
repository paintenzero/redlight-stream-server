var sqlite3 = require('sqlite3');
var path = require('path');
var Rx = require('rx');
var uuid = require('uuid');
var config = require('./config');

var db = new sqlite3.Database(__dirname + path.sep + 'storage.db');
var logger = require('intel').getLogger('Redlight.SQLite');
/**
 * Returns settings from SQLite
 */ 
module.exports.settingsObservable = function () {
    return getSettingsObservable().flatMap(function (row) {
        logger.debug('GOT FROM DB: ' + JSON.stringify(row));
        if (!row) {
            logger.debug('No settings in db. Creating defaults...');
            return createDefaultSettingsObservable(); 
        } else {
            //TODO: check db version
        }
        return Rx.Observable.just(row);
    });
};
/**
 * Returns settings row from SQLite database 
 */
function getSettingsObservable(){
    return Rx.Observable.fromNodeCallback(db.get.bind(db))("SELECT `dbVer`, `serverId` FROM `settings`");
}
/**
 * Inserts default server settings
 */ 
function createDefaultSettingsObservable(){
    var serverId = uuid.v1();
    var dbVer = config.get('dbVer');
    return Rx.Observable.fromNodeCallback(db.run.bind(db))("INSERT INTO `settings` (`serverId`, `dbVer`) VALUES(?, ?) ", [serverId, dbVer]).
    map(function (_) {
        return {
            'dbVer': dbVer,
            'serverId': serverId
        };
    });
}