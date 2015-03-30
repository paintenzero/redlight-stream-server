var Rx = require('rx');
var net = require('net');
var config = require('./config');
var spawn = require('child_process').spawn;
var path = require('path');

var pinRequested = false;

module.exports.getPin = function () {
    return Rx.Observable.create(function (observer) {
        if (pinRequested) {
            observer.onError(new Error('Waiting for previous PIN request'));
            return null;
        }
        pinRequested = true;
                
        var server = net.createServer(function (c) { //'connection' listener
            c.on('data', function (data) {
                var pin = data.readIntLE(0, 2);
                observer.onNext(pin);
            });
        });
        var port = config.get('pin.port');
        var child = null;
        server.listen(port, function () { //'listening' listener
            var binPath = path.normalize(__dirname + path.sep + config.get('pin.bin'));
            child = spawn(binPath, ['-p', port]);
            child.on('exit', function () {
                observer.onCompleted();
                server.close();
            });
        });

        return function () {
            pinRequested = false;
            server.close();
            child.kill();
        }
    });
};