var sqlite3 = require('sqlite3');
var path = require('path');
var Rx = require('rx');
var uuid = require('uuid');
var config = require('./config');
var extend = require('extend');

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
/**
 * Saves device into database
 */ 
function saveDevice(deviceId, deviceName, certificate, aes) {
    return Rx.Observable.fromNodeCallback(db.get.bind(db))("SELECT `deviceId` FROM `devices` WHERE `deviceId` = ?", [deviceId]).
    flatMap(function (row, fields) {
        if (row) {
            logger.debug("Updating device (%s, %s) in database", deviceId, deviceName);
            return Rx.Observable.fromNodeCallback(db.run.bind(db))("UPDATE `devices` SET `name` = ?, `certificate` = ?, `key` = ? WHERE `deviceId` = ?", [deviceName, certificate, aes, deviceId]);
        } else {
            logger.debug("Inserting new device (%s, %s) to database", deviceId, deviceName);
            return Rx.Observable.fromNodeCallback(db.run.bind(db))("INSERT INTO `devices` (`deviceId`, `name`, `certificate`, `key`, `paired`) VALUES(?, ?, ?, ?, 0) ", [deviceId, deviceName, certificate, aes]);
        }
    });
}
module.exports.saveDevice = saveDevice;
/**
 * Removes device with specified uniqueId from storage
 */
function removeDevice(deviceId) {
    return Rx.Observable.fromNodeCallback(db.run.bind(db))("DELETE FROM `devices` WHERE `deviceId` = ?", [deviceId]);
}
module.exports.removeDevice = removeDevice;
/**
 * Returns devices' row from storage
 */ 
module.exports.getDevice = function (deviceId) {
    return Rx.Observable.fromNodeCallback(db.get.bind(db))("SELECT `name`, `certificate`, `key`, `data`, `paired` FROM `devices` WHERE `deviceId` = ?", [deviceId]).
    map(function (row, fields) {
        if (row) {
            return row;
        } else {
            return null;
        }
    });
};
/**
 * Returns parsed device data
 */ 
module.exports.getDeviceData = function (deviceId) {
    return this.getDevice(deviceId).
    map(function (row) {
        if (row) {
            return JSON.parse(row.data);
        } else {
            return {};
        }
    });
};
/**
 * Merges new data for the device with existing data in storage
 */ 
module.exports.updateDeviceData = function (deviceId, data) {
    return this.getDeviceData(deviceId).
    flatMap(function (oldData) {
        var newData = {};
        extend(false, newData, oldData, data);
        return Rx.Observable.fromNodeCallback(db.run.bind(db))("UPDATE `devices` SET `data` = ? WHERE `deviceId` = ?", [JSON.stringify(newData), deviceId]);
    });
};
/**
 * Sets status of device pairing
 */ 
module.exports.setDevicePaired = function (deviceId, status) {
    return Rx.Observable.fromNodeCallback(db.run.bind(db))("UPDATE `devices` SET `paired` = ? WHERE `deviceId` = ?", [status ? 1 : 0, deviceId]);
};