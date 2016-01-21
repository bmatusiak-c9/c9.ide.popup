define(function(require, exports, module) {
    var popups = [];
    var EventEmitter = require("events").EventEmitter;
    
    var $events = new EventEmitter();

    function postMessage(args) {
        var $data = {
            eventId : "popup",
            args: args
        };
        
        var jsonData = JSON.stringify($data);
        
        if(window.opener)
            window.opener.postMessage(jsonData, window.location.origin);
        else
            for (var j = 0; j < popups.length; j++) {
                popups[j].postMessage(jsonData, window.location.origin);
            }
    }

    var addWindow = function(popup) {
        popups.push(popup);
    };
    
    var delWindow = function(popupName) {
        for (var j = 0; j < popups.length; j++) {
            if(popups[j].name == popupName){
                popups.splice(j, 1);
            }
        }
    };
    
     window.addEventListener("message", function(event) {

            // Do we trust the sender of this message?
            if (event.origin !== window.location.origin)
                return;
            
            try{
                var $data = JSON.parse(event.data);
                if($data.eventId == "popup"){
                    console.log("popupBridge: $data =",$data.args)
                    $events.emit.apply($events,$data.args);   
                }
            }catch(e){
                
            }


        }, false);

    return {
        on:$events.on.bind($events),
        emit:function(){
            var args = [];
            for (var j = 0; j < arguments.length; j++) {
                args.push(arguments[j]);
            }
            postMessage(args);
        },
        addWindow:addWindow,
        delWindow:delWindow
    };
    
});
