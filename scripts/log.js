namespace.module('bot.log', function (exports, require) {

    var LEVEL = 'info';

    var FNS = [debug, info, warning, error];

    var NAMES = ['debug', 'info', 'warning', 'error'];

    var extender = {};
    var clear = false;

    for (var i = 0; i < FNS.length; i++) {
        if (clear || LEVEL === NAMES[i]) {
            extender[NAMES[i]] = FNS[i];
            clear = true;
            console.log(NAMES[i], ' clear');
        } else {
            extender[NAMES[i]] = function() {};
        }
    }

    exports.extend(extender);

    function dateStr() {
        return (new Date()).toString().slice(4, -15);
    }

    function debug() {
        var a = arguments;
        a[0] = 'DEBUG ' + dateStr() + ' ' + a[0];
        console.log(sprintf.apply(null, a));
    }

    function info() {
        var a = arguments;
        a[0] = 'INFO ' + dateStr() + ' ' + a[0];
        console.log(sprintf.apply(null, a));
    }

    function warning() {
        var a = arguments;
        a[0] = 'WARNING ' + dateStr() + ' ' + a[0];
        console.log(sprintf.apply(null, a));
    }

    function error() {
        var a = arguments;
        a[0] = 'ERROR ' + dateStr() + ' ' + a[0];
        console.log(sprintf.apply(null, a));
    }
});