/**
 * popup.window module for the Cloud9 that's used to pop tabs out of the client IDE
 * 
 * Author: Bradley Matusiak <bmatusiak@gmail.com> 2015/2016
 * 
 **/
define(function(require, exports, module) {
    main.consumes = ["Plugin", "dialog.question"];
    main.provides = ["popup.windows"];

    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var question = imports["dialog.question"].show;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);

        plugin.on("load", function() {});
        plugin.on("unload", function() {});

        var emit = plugin.getEmitter();

        var windowNameKey = "c9popup-";
        var windows = [];

        if (isPopup()) { //send all console traffic to main window
            window.console.warn = window.opener.console.warn.bind(window.opener.console, window.name + ":");
            window.console.log = window.opener.console.log.bind(window.opener.console, window.name + ":");
            window.console.info = window.opener.console.info.bind(window.opener.console, window.name + ":");
            window.console.error = window.opener.console.error.bind(window.opener.console, window.name + ":");
        }
        else {
            window.addEventListener("beforeunload", function() { //main window
                window.closing = true;
                for (var j = 0; j < windows.length; j++) {
                    windows[j].close();
                }
            });
        }

        window.addEventListener("message", function(event) {
            if (event.origin !== window.location.origin)
                return;
            try {
                var $data = JSON.parse(event.data);
                if ($data.eventId == "popup") {
                    emit.apply(null, $data.args);
                }
            }
            catch (e) {}
        }, false);


        function postMessage(args, broadcast) {
            var $data = {
                eventId: "popup",
                args: args
            };
            var jsonData = JSON.stringify($data);
            if (window.opener)
                window.opener.postMessage(jsonData, window.location.origin);
            else
                for (var j = 0; j < windows.length; j++) {
                    windows[j].postMessage(jsonData, window.location.origin);
                }
        }

        function addWindow($window,beforeunload) {
            windows.push($window);
            $window.addEventListener("beforeunload", function() {
                $window.closing = true;
                if (!window.closing)
                    for (var j = 0; j < windows.length; j++) {
                        if (windows[j] === $window || windows[j].name == $window) {
                            windows.splice(j, 1);
                        }
                    }
                if(typeof beforeunload == "function") beforeunload($window);
            });
        }

        function openWindow(meta) {
            var windowName = meta.name || makeid();
            var $window;

            var windowOptions = [
                ["height", meta.screen ? meta.screen.height : "600"],
                ["width", meta.screen ? meta.screen.width : "800"],
                ["titlebar", "0"],
                ["toolbar", "0"],
                ["location", "0"],
                ["status", "0"],
                ["menubar", "0"]
            ];
            if (meta.screen) {
                if (meta.screen.top) windowOptions.push(["top", meta.screen.top]);
                if (meta.screen.left) windowOptions.push(["left", meta.screen.left]);
            }
            meta.options = windowOptions;

            $window = window.open("", windowName, (function(windowOptions) {
                var str = [];
                windowOptions.forEach(function(v, i) {
                    str.push(v.join("="));
                });
                str = str.join(",");
                console.log("str", str);
                return str;
            })(windowOptions));
            
            $window.$meta = meta;
            
            setTimeout(function() { //this timeout waits for the window to open to check and see if it was blocked by a popup.
                if (!$window || $window.outerHeight === 0) {
                    popupBlocked();
                }
                else {
                    if ($window.location.href === "about:blank") {
                        $window.location = window.location; // = window.open(window.location, windowName, "height=800,width=600,titlebar=0,toolbar=0,location=0,status=0,menubar=0");
                        var intInit;
                        intInit = setInterval(function() { //this interval waits for the window to load the location it just got set to..
                            if ($window.location.href === window.location.href) {
                                clearInterval(intInit);
                                init();
                            }
                        });
                    }
                    else {
                        // We've already obtained the reference.
                        // However, IE and FireFox won't put focus on an already opened window.
                        // So we have to do that explicitly:
                        $window.focus();
                        if (meta.ready)
                            meta.ready($window);
                    }
                }
            }, meta.delay || 100);

            function popupBlocked() {
                question(
                    "Popup not visable!",
                    "Please add this site to your exception list if popup was block. Or the popup window may not have a good width.",
                    "Open Popup window?",
                    function(all) { // Yes
                        openWindow(meta); //retry everything
                    },
                    function(all) { // No
                        //do nothing as this just closes the dialog
                    }
                );
            }

            function init() {
                $window.c9popupReady = function() {
                    if (meta.ready)
                        meta.ready($window);
                };
                addWindow($window,meta.beforeunload);
            }
        }

        function makeid() {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for (var i = 0; i < 5; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));

            return windowNameKey + text;
        }

        function getWindowMetadata() {
            var windowMetadata = {};
            for (var i in windows) {
                windowMetadata[windows[i].name] = {
                    name: windows[i].name,
                    screen: {
                        left: windows[i].screenLeft,
                        top: windows[i].screenTop,
                        width: windows[i].innerWidth,
                        height: windows[i].innerHeight
                    }
                };
            }
            return windowMetadata;
        }

        function isPopup() {
            return (window.name.substr(0, windowNameKey.length) == windowNameKey);
        }

        /**
         * 
         **/
        plugin.freezePublicAPI({
            /**
             * 
             */
            openWindow: openWindow,
            
            /**
             * 
             */
            get windows() {
                return windows.slice(0);
            },
            
            /**
             * 
             */
            get parent() {
                return window.opener;
            },
            
            /**
             * 
             */
            get metadata() {
                return getWindowMetadata();
            },
            
            /**
             * 
             */
            get isPopup() {
                return isPopup();
            },
            
            /**
             * 
             */
            loopWindows: function(fn) {
                for (var j = 0; j < windows.length; j++) {
                    if (windows[j].app && !windows[j].closing)
                        if (fn(windows[j])) break;
                }
            },
            
            /**
             * 
             */
            emit: function() {
                var args = [];
                for (var j = 0; j < arguments.length; j++) {
                    args.push(arguments[j]);
                }
                postMessage(args);
            },
            
            /**
             * 
             */
            broadcast: function() {//does not work yet
                var args = [];
                for (var j = 0; j < arguments.length; j++) {
                    args.push(arguments[j]);
                }
                postMessage(args, true);
            },
        });

        register(null, {
            "popup.windows": plugin
        });
    }
});
