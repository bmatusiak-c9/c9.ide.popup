/**
 * popup.window module for the Cloud9 that's used to pop tabs out of the client IDE
 * 
 * Author: Bradley Matusiak <bmatusiak@gmail.com> 2015/2016
 * 
 **/
define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["popup.windows"];

    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);

        plugin.on("load", function() {});
        plugin.on("unload", function() {});
        
        var emit = plugin.getEmitter();
        
        var windows = [];

        function postMessage(args) {
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

        function addWindow(window) {
            windows.push(window);
            window.addEventListener("beforeunload", function() {
                delWindow(window);
            });
        }

        function delWindow(popupName) {
            for (var j = 0; j < windows.length; j++) {
                if (windows === popupName || windows[j].name == popupName) {
                    windows.splice(j, 1);
                }
            }
        }
        
        window.addEventListener("message", function(event) {

            // Do we trust the sender of this message?
            if (event.origin !== window.location.origin)
                return;
            
            try{
                var $data = JSON.parse(event.data);
                if($data.eventId == "popup"){
                    emit.apply(null,$data.args);   
                }
            }catch(e){
                
            }


        }, false);
        
        plugin.freezePublicAPI({

            addWindow: addWindow,

            delWindow: delWindow,

            get windows() {
                return windows.slice(0);
            },
            
            get parent(){
                return window.opener;
            },
            
            loopWindows: function(fn){
                for (var j = 0; j < windows.length; j++) {
                    if(windows[j].app && ! windows[j].closing)
                    if(fn(windows[j])) break;
                }
            },
            emit: function() {
                var args = [];
                for (var j = 0; j < arguments.length; j++) {
                    args.push(arguments[j]);
                }
                postMessage(args);
            },
            
            //broadcast:broadcast  //send to all windows
        });

        register(null, {
            "popup.windows": plugin
        });
    }
});
