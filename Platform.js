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
    return Rx.Observable.fromNodeCallback(GetPin)(null);
};


var GetRegistryValue = edge.func({
    assemblyFile: 'RedlightLibrary.dll',
    typeName: 'RedlightLibrary.Server',
    methodName: 'GetRegistryKey' // This must be Func<object,Task<object>>
});
/**
 * Gets string value from Windows Registry
 * @param Object {path: '...', 'valueName': '...', 'defaultValue': '...'}
 */ 
module.exports.registryKeyObserver = function (arguments) {
    return Rx.Observable.fromNodeCallback(GetRegistryValue)(arguments);
};
module.exports.REGISTRY_HIVE = {
    HKCU: 'HKEY_CURRENT_USER'
};