var edge = require('edge');
var Rx = require('rx');

/**
 * Function to get video card name
 */ 
var GetVideoCardName = edge.func({
    assemblyFile: 'RedlightLibrary.dll',
    typeName: 'RedlightLibrary.Server',
    methodName: 'GetFirstVideoCardName' // This must be Func<object,Task<object>>
});

module.exports.GetVideoCardName = function () {
    return Rx.Observable.fromNodeCallback(GetVideoCardName)(null);
};

/**
 * Creates a window to input PIN-code
 */ 
var GetPin = edge.func({
    assemblyFile: 'RedlightLibrary.dll',
    typeName: 'RedlightLibrary.Server',
    methodName: 'GetPin' // This must be Func<object,Task<object>>
});
module.exports.GetPin = function () {
    return Rx.Observable.create(function (subscriber) {
        GetPin(null, function (err, pin) {
            if (err) {
                subscriber.onError(err);
            } else {
                subscriber.onNext(pin);
                subscriber.onCompleted();
            }
        });
        return function () {
            //
        }
    });
};
