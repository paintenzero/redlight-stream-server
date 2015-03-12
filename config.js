var fs = require('fs');
var path = require('path');
var _config = null;

if (_config === null) {
    var argv = require('minimist')(process.argv.slice(2));
    var configFile = path.normalize(__dirname + path.sep + (argv.config || 'settings.json'));
    if (fs.existsSync(configFile)) {
        _config = require(configFile);
    } else {
        throw new Error('Unable to find configuration file', configFile);
    }
}
/**
 * Returns a setting from configuration file.
 * If a key is in dot-format (e.g. server.https-ports), it will return config['server']['https-port']
 */ 
module.exports.get = function (key) {
    var keys = key.split('.'), len = keys.length;
    var ret = _config, k;
    for (var i = 0; i < len; ++i) {
        k = keys[i];
        if (ret[k]) ret = ret[k];
        else return null;
    }
    return ret;
};