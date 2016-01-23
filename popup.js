/**
 * popup.window module for the Cloud9 that's used to pop tabs out of the client IDE
 * 
 * Author: Bradley Matusiak <bmatusiak@gmail.com> 2015/2016
 * 
 **/
define(function(require, exports, module) {
    main.consumes = ["Plugin", "c9", "commands", "tabManager", "tabbehavior", "menus", "ui", "layout",
        "panels", "settings", "popup.windows"
    ];
    main.provides = ["popup"];

    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var c9 = imports.c9;
        var commands = imports.commands;
        var tabManager = imports.tabManager;
        var tabbehavior = imports.tabbehavior;
        var menus = imports.menus;
        var ui = imports.ui;
        var layout = imports.layout;
        var panels = imports.panels;
        var settings = imports.settings;
        var windows = imports["popup.windows"];

        /***** Initialization *****/

        var plugin = new Plugin("Ajax.org", main.consumes);

        var emit = plugin.getEmitter();

        var mnuContext = tabbehavior.contextMenu;

        plugin.on("load", function() {});
        plugin.on("unload", function() {});

        settings.on("onevent", function(e) {
            windows.emit("settings-onevent", e);
        });
        windows.on("settings-onevent", function(e) {
            settings.$getEmitter().apply(null, e);
        });

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

        menus.addItemByPath((windows.isPopup ? "Popin Tab" : "Popout tab"), new ui.item({
            command: "popuptab"
        }), 1020, mnuContext, plugin);


        function popuptab(tab) {
            function tabOpened(err, $tab) {
                if (err) return console.error(err);
                tab.meta.$ignore = true;//terminal
                tab.meta.$detach = true;//terminal
                tab.document.meta.$ignoreSave = true;//save
                tabbehavior.closetab(tab);
            }
            if (windows.isPopup) { //send back to main window
                var tabState = tab.getState();
                tabOpened();
                setTimeout(function() {
                    windows.parent.app.tabManager.open(tabState);
                }, 100);
            }
            else
                windows.openWindow({
                    ready: function(popupwin) {
                        if (tab) {//sometime tab is not here when reopening cloud9, so it will load from previous settings tab state
                            var tabState = tab.getState();
                            tabOpened();
                            popupwin.app.tabManager.open(tabState);
                        }
                    },
                    beforeunload: popupBeforeUnload
                });
        }

        function popupBeforeUnload($window) {
            if (!window.closing) {
                var inter = setInterval(function() {//want to make sure it's not saving settings
                    if($window.closed){//safe to say cloud9 is no longer alive in popup
                        settings.set("state/" + $window.name, {}, true); //clearState of popwindow
                        delete settings.model.state[$window.name];// just to be sure
                        settings.save(true);
                        clearInterval(inter);
                    }
                }, 10);
            }
        }

        if (windows.isPopup) {
            c9.once("ready", function() {
                layout.setBaseLayout("minimal");
                panels.deactivate("tree");
            });
            tabManager.on("ready", function() {
                tabManager.toggleButtons(0);
                window.c9popupReady();
                emit("ready");
            });
            menus.on("restore", function() {
                popuptab(tabManager.getPanes()[0].getTabs()[0]);
                menus.minimize();
            });
            tabManager.on("tabAfterClose", function(e) {
                if (tabManager.getPanes()[0].getTabs().length == 1 && tabManager.getPanes()[0].getTabs()[0].path == e.tab.path) {
                    setTimeout(function() {
                        window.close();
                    }, 10);
                }
            });
        }
        else {
            settings.on("read", function() {
                settings.setDefaults("state/popup", [
                    ["active", "true"],
                    ["windows", "{}"]
                ]);

                var popupWindows = settings.getJson("state/popup/@windows");

                for (var i in popupWindows) {
                    popupWindows[i].delay = 1000;
                    popupWindows[i].beforeunload = popupBeforeUnload;
                    windows.openWindow(popupWindows[i]);
                }

            }, plugin);

            settings.on("write", function(e) {
                settings.setJson("state/popup/@windows", windows.metadata);
            });
        }

        plugin.freezePublicAPI({
            /**
            * popuptab(tab)
            * tab = tab<object>
            */
            popuptab: popuptab
        });

        register(null, {
            "popup": plugin
        });
    }
});
