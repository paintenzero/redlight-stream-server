var Rx = require('rx');
var net = require('net');
var config = require('./config');
var spawn = require('child_process').spawn;
var path = require('path');

module.exports.getPin = function () {
    return Rx.Observable.create(function (observer) {
        
        
        var server = net.createServer(function (c) { //'connection' listener
            c.on('data', function (data) {
                var pin = data.readIntLE(0, 2);
                observer.onNext(pin);
            });
        });
        var port = config.get('pin.port');
        server.listen(port, function () { //'listening' listener
            var binPath = path.normalize(__dirname + path.sep + config.get('pin.bin'));
            var child = spawn(binPath, ['-p', port]);
            child.on('exit', function () {
                observer.onCompleted();
                server.close();
            });
        });

        return function () {
            //TODO: dispose!
        }
    });
};