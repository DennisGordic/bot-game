namespace.module('bot.log', function (exports, require) {

    gl.FB = new Firebase("https://fiery-heat-4226.firebaseio.com");

    gl.FB.authAnonymously(function(error, authData) {
        if(error) {
            console.log("anon login failed", error);
            gl.FBuid = "failedauth";
        } else {
            console.log("Good anon auth", authData);
            gl.FBuid = authData.uid.slice(11);
            console.log(gl.FBuid);
            gl.FBL = gl.FB.child(gl.FBuid);
            gl.FBL.push("page loading");
        }
    });

    var LEVEL = 'info';

    var FNS = [debug, info, warning, error, stack];

    var NAMES = ['debug', 'info', 'warning', 'error', 'stack'];

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

    function fileLine() {
        var s = new Error().stack.split('\n')[3];
        return s.slice(s.indexOf('(') + 1, s.length - 1);
    }

    function dateStr() {
        return (new Date()).toString().slice(4, -15);
    }

    function debug() {
        var a = arguments;
        a[0] = 'DEBUG ' + fileLine() + ' ' + a[0];
        console.log('%c' + sprintf.apply(null, a), 'color: blue');
    }

    function info() {
        var a = arguments;
        a[0] = 'INFO ' + fileLine() + ' ' + a[0];
        console.log('%c' + sprintf.apply(null, a), 'color: green');
    }

    function warning() {
        var a = arguments;
        if (gl.FBL) {
            gl.FBL.push("WARNING: " + sprintf.apply(null,a));
        }
        a[0] = 'WARNING ' + fileLine() + ' ' + a[0];
        console.log('%c' + sprintf.apply(null, a), 'color: orange');
    }

    function error() {
        var a = arguments;
        if (gl.FBL) {
            gl.FBL.push("ERROR:" + sprintf.apply(null,a));
        }
        a[0] = 'ERROR ' + fileLine() + ' ' + a[0];
        console.log('%c' + sprintf.apply(null, a), 'color: red');

    }

    //  call with 'log.line(new Error(), 'your text here');
    function stack() {
        var a = arguments;
        a[0] = new Error().stack.replace(/   at /g, '').split('\n').slice(2).join('\n') + '\n  ' + a[0];
        console.log('%c' + sprintf.apply(null, a), 'color: purple');
    }
});
