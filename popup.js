/**
 * popup.window module for the Cloud9 that's used to pop tabs out of the client IDE
 * 
 * Author: Bradley Matusiak <bmatusiak@gmail.com> 2015/2016
 * 
 **/
define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "commands", "tabManager", "tabbehavior", "menus", "ui", "layout", 
                "panels", "tree", "settings", "dialog.question", "ace", "breakpoints","popup.windows"];
    main.provides = ["popup"];

    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var tabbehavior = imports.tabbehavior;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var menus = imports.menus;
        var ui = imports.ui;
        var ace = imports.ace;
        var question = imports["dialog.question"].show;
        var mnuContext = tabbehavior.contextMenu;
        var settings = imports.settings;
        var layout = imports.layout;
        var panels = imports.panels;
        var c9 = imports.c9;
        var $console = imports.console;
        
        var windows = imports["popup.windows"];
        
        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);
        var emit = plugin.getEmitter();
        
        plugin.on("load", function() {});
        plugin.on("unload", function() {});

        plugin.windows = {};
        
        
        settings.on("onevent",function(e){
            //settings.$getEmitter().apply(null,e);
            windows.emit("settings-onevent",e);
        });
        windows.on("settings-onevent",function(e){
            settings.$getEmitter().apply(null,e);
        });
        
        
        var popupWindowNameKey = "c9popup-";
        var popupWindows;
        var popupMainWindow = window.opener || window;
        
        function isPopup() {
            return (window.name.substr(0, popupWindowNameKey.length) == popupWindowNameKey);
        }
        
        if(isPopup()){//send all console traffic to main window
            window.console.warn = popupMainWindow.console.warn.bind(popupMainWindow.console,window.name+":");
            window.console.log = popupMainWindow.console.log.bind(popupMainWindow.console,window.name+":");
            window.console.info = popupMainWindow.console.info.bind(popupMainWindow.console,window.name+":");
            window.console.error = popupMainWindow.console.error.bind(popupMainWindow.console,window.name+":");
        }
        
        (function(item) {
            commands.addCommand({
                name: item[0],
                bindKey: {
                    mac: item[1],
                    win: item[2]
                },
                group: "Tabs",
                hint: item[4],
                isAvailable: item[3],
                exec: function(editor, arg) {
                    if (arg && !arg[0] && arg.source == "click")
                        arg = [mnuContext.$tab, mnuContext.$pane];

                    item[5].apply(plugin, arg);
                }
            }, plugin);

        })(["popuptab", "", "", function() {
            return tabManager.focussedTab;
        }, "create a new window with a view on the same file", popuptab]);

        var itmOpenPopoutWindow = new ui.item({
            command: "popuptab"
        });
        menus.addItemByPath("View/Popout Window", itmOpenPopoutWindow, 100, plugin);

        menus.addItemByPath((isPopup() ? "Popin Tab" : "Popout tab"), new ui.item({
            command: "popuptab"
        }), 1020, mnuContext, plugin);

        settings.on("read", function() {
            settings.setDefaults("state/popup", [
                ["active", "true"],
                ["windows", "[]"]
            ]);
            
            var popupWindows = settings.getJson("state/popup/@windows");
            
            popupWindows.forEach(function(v,i){
                openWindow(null, 1000,v.name);
            });
            
        }, plugin);
    
        settings.on("write", function (e) {
            var popupWindows = [];
            for(var i in plugin.windows){
                popupWindows.push({name:plugin.windows[i].name});
            }
            settings.setJson("state/popup/@windows", popupWindows);
            
        });

        function popuptab(tab) {
            function tabOpened(err, $tab) {
                if (err) return console.error(err);
                tab.meta.$ignore = true;
                tab.document.meta.$ignoreSave = true;
                tab.meta.$detach = true;
                tabbehavior.closetab(tab);
            }
            if (isPopup()) {//send back to main window
                var tabState = tab.getState();
                tabState.windowName = window.name;
                tabOpened();
                setTimeout(function(){
                    popupMainWindow.app.tabManager.open(tabState);
                },100);
            }
            else
                openWindow(function(popupwin) {
                    if (tab) {
                        var tabState = tab.getState();
                        tabState.windowName = window.name;
                        tabOpened();
                        popupwin.app.tabManager.open(tabState);
                    }
                });
        }
        /*
        tabManager.on("open", function(e) {
            for(var i in plugin.windows){
                var $window = plugin.windows[i];
                if(!$window || !$window.app) return;
                var tabsList = plugin.windows[i].app.tabManager.getTabs();
                for (var j = 0; j < tabsList.length; j++) { 
                    var $tab = tabsList[j];
                    if(( $tab.document.editor && $tab.document.editor.type != "terminal") && 
                        $tab.path == e.tab.path && 
                        e.options.windowName != i &&
                        !plugin.windows[e.options.windowName].closed){
                        setTimeout(function(){
                            popuptab(e.tab);
                        },0);
                        return;
                    }
                }
            }
        });*/
        
        if (isPopup()) {
            //popupMainWindow.app.settings.on("onevent",function(e){
                //settingsEmitter.apply(null,e);
            //})
            c9.once("ready",function(){
                layout.setBaseLayout("minimal");
                panels.deactivate("tree");
                popupMainWindow.app.settings.set("state/popup/@isOpen","true"); //dont re open this popup window on reload
                popupMainWindow.app.settings.save(true);
            });
            tabManager.on("ready",function(){
                tabManager.toggleButtons(0);
                window.c9popupReady();
                emit("ready");
            });
            menus.on("restore",function(){
                popuptab(tabManager.getPanes()[0].getTabs()[0]);
                menus.minimize();
            });
            tabManager.on("tabAfterClose", function(e) {
                if (tabManager.getPanes()[0].getTabs().length == 1 && tabManager.getPanes()[0].getTabs()[0].path == e.tab.path) {
                    popupMainWindow.app.settings.set("state/" + window.name, {}, true); //clearState of popwindow
                    popupMainWindow.app.settings.set("state/popup/@isOpen","false");
                    popupMainWindow.app.settings.save(true);
                    
                    setTimeout(function(){
                        window.location.href = "about:blank";
                        window.close();
                    },0);
                }
            });
                
            window.addEventListener("beforeunload",function() {//popup window
                window.closing = true;
                if (!popupMainWindow.closing && tabManager.getPanes()[0].getTabs().length == 1) {
                    popupMainWindow.app.settings.set("state/popup/@isOpen","false"); //dont re open this popup window on reload
                    popupMainWindow.app.settings.set("state/"+window.name,{},true); //clearState of popwindow
                }
                popupMainWindow.app.settings.save(true);
            });
            
        }else{
            window.addEventListener("beforeunload",function() { //main window
                window.closing = true;
                for (var i in plugin.windows)
                    plugin.windows[i].close();
            });
        }
        
        function openWindow(ready, popupBlockerCheckdelay,windowName) {
            windowName = windowName || makeid();
            var popupwin;
            
            if(plugin.windows[windowName] && !plugin.windows[windowName].closed){
                popupwin = plugin.windows[windowName];
                if (ready)
                    ready(popupwin);
                popupwin.focus();
                return;
            }else
                popupwin = window.open("", windowName, "height=800,width=600,titlebar=0,toolbar=0,location=0,status=0,menubar=0");
             
            /* todo: remember pos of last time window was open, -set these values in settings on popup windows close */

            setTimeout(function() { //this timeout waits for the window to open to check and see if it was blocked by a popup.
                if (!popupwin || popupwin.outerHeight === 0) {
                    popupBlocked();
                }
                else {
                    popupwin.c9popupParent = window;
                    if (popupwin.location.href === "about:blank") {
                        popupwin.location = window.location; // = window.open(window.location, windowName, "height=800,width=600,titlebar=0,toolbar=0,location=0,status=0,menubar=0");
                        var intInit;
                        intInit = setInterval(function() { //this interval waits for the window to load the location it just got set to..
                            if (popupwin.location.href === window.location.href) {
                                clearInterval(intInit);
                                init();
                            }
                        });
                    }
                    else {
                        // We've already obtained the reference.
                        // However, IE and FireFox won't put focus on an already opened window.
                        // So we have to do that explicitly:
                        setTimeout(popupwin.focus,0);
                        if (ready)
                            ready(popupwin);
                    }
                }
            }, popupBlockerCheckdelay || 100);

            function popupBlocked() {
                question(
                    "Popup not visable!",
                    "Please add this site to your exception list if popup was block. Or the popup window may not have a good width.",
                    "Open Popup window?",
                    function(all) { // Yes
                        openWindow(ready, popupBlockerCheckdelay); //retry everything
                    },
                    function(all) { // No
                        //do nothing as this just closes the dialog
                    }
                );
            }

            function init() {
                popupwin.c9popupReady = function() {
                    if (ready)
                        ready(popupwin);
                };
                plugin.windows[popupwin.name] = popupwin;
                windows.addWindow(popupwin);
                //postMessage.addWindow(popupwin);
            }
        }

        function makeid() {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for (var i = 0; i < 5; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));

            return popupWindowNameKey + text;
        };

        plugin.freezePublicAPI({
            /* _events: [
                 
             ],*/
            isPopup:isPopup,
            popuptab:popuptab
        });

        register(null, {
            "popup": plugin
        });
    }
});
