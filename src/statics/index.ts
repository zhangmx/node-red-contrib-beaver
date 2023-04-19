import { RED as REDinHtml, NodeInstance } from "node-red__editor-client";

// if there is no RED(type: REDinHtml) object then give default value
declare const RED: REDinHtml;


function postCommand(cmd: string, body?: any) {
    console.log(cmd, body)
    const opts: JQuery.AjaxSettings = {
        url: "beaver/" + cmd,
        type: "POST",
        error: function (jqXHR, textStatus, errorThrown) {
            console.log(jqXHR, textStatus, errorThrown);
        }
    }
    if (body) {
        opts.contentType = "application/json";
        opts.data = JSON.stringify(body);
    }
    $.ajax(opts);
}

function parseLocation(location: string) {
    const parts = /^(.*?)\/([^/[]+)\[(i|o)\]\[(\d+)\]$/.exec(location);

    if (!parts) {
        return null;
    }
    const node = RED.nodes.node(parts[2]) as NodeInstance;
    return {
        location: location,
        z: node ? node.z : null,
        path: parts[1],
        id: parts[2],
        portType: parts[3] === 'i' ? "input" : "output",
        portIndex: parts[4]
    }
}


// function show() {
//     RED.sidebar.show("beaver");
// }

(function () {
    console.log(RED);
    console.log(RED.settings)
    console.log(RED.settings.editorTheme)

    // console.log(RED.nodes.version())
    if (!Object.prototype.hasOwnProperty.call(RED.view, 'annotations')) {
        RED.notify("Beaver requires Node-RED 3.0.2 or later");
        return;
    }

    let sidebarContent: JQuery<HTMLElement>;

    const MAX_MESSAGE_LOADED = 10;
    const activeMessageFilter = 'all';

    RED.plugins.registerPlugin("node-red-contrib-beaver", {
        onadd: function () {

            console.log("Beaver plugin added");
            // let beaverState;
            // let breakpoints = {};
            // let breakpointsByNode = {};
            // let messagesByNode = {};
            // let annotations = {};
            // let queueDepths = {};
            // let queuedMessages = {};
            // let pausedLocations = new Set();
            // let pausedNotification;
            let beaverEnabled = false;
            let handlingCommsEvent = false;

            sidebarContent = $("<div>")
                .addClass("red-ui-beaver disabled")
                .css({ "position": "relative", "height": "100%" }) ;
            const footerToolbar = $('<div>TODO add test case list</div>') as unknown as HTMLElement;

            RED.sidebar.addTab({
                id: "beaver",
                label: RED._("node-red-contrib-beaver/beaver:label.beaverShort"),
                name: RED._("node-red-contrib-beaver/beaver:label.beaver"),
                iconClass: "fa fa-paw",
                content: sidebarContent as unknown as HTMLElement,
                toolbar: footerToolbar,
                enableOnEdit: true,
                action: "core:show-beaver-tab"
            });

            const header = $("<div>", { class: "red-ui-sidebar-header" }).appendTo(sidebarContent) as unknown as HTMLElement;

            const headerLeftSpan = $('<span>').css({ "flex-grow": 1, "text-align": "left" }).appendTo(header) as unknown as HTMLElement;
            const headerRightSpan = $('<span>', { class: "red-ui-beaver-toolbar" }).appendTo(header) as unknown as HTMLElement;
            const headerPlayControl = $('<span>', { class: "button-group" }).appendTo(headerRightSpan) as unknown as HTMLElement;
            const headerStepControl = $('<span>', { class: "button-group" }).appendTo(headerRightSpan) as unknown as HTMLElement;

            const beaverEnabledToggle = ($('<input type="checkbox"/>')
                .appendTo(headerLeftSpan)  as JQuery<HTMLButtonElement>).toggleButton({
                // .toggleButton({
                //     enabledIcon: "fa-toggle-on",
                //     disabledIcon: "fa-toggle-off",
                //     baseClass: "red-ui-sidebar-header-button"
                // }).on("change", function () {
                //     beaverEnabled = this.checked;
                //     if (!handlingCommsEvent) {
                //         $.ajax({
                //             url: "beaver",
                //             contentType: "application/json",
                //             type: "PUT",
                //             data: JSON.stringify({ enabled: beaverEnabled }),
                //             success: function (resp) {
                //                 sidebarContent.toggleClass("disabled", !beaverEnabled);
                //             },
                //             error: function (jqXHR, textStatus, errorThrown) {
                //                 console.log(jqXHR, textStatus, errorThrown);
                //             }
                //         });
                //     } else {
                //         sidebarContent.toggleClass("disabled", !beaverEnabled);
                //     }
                //     if (beaverEnabled) {
                //         enableBeaver();
                //     } else {
                //         disableBeaver()
                //     }

                // });

            // const settingsPanel: JQuery = $('<div class="red-ui-beaver-settings"></div>').css({ padding: "8px" });
            // $('<div data-i18n="node-red-contrib-beaver/beaver:label.breakpointAction.label"></div>').appendTo(settingsPanel);
            // $('<label><input type="radio" class="red-ui-sidebar-header-button-toggle" name="red-ui-beaver-pause-option" value="pause-all"><span data-i18n="node-red-contrib-beaver/beaver:label.breakpointAction.pause-all"></span></label>').appendTo(settingsPanel);
            // $('<label><input type="radio" class="red-ui-sidebar-header-button-toggle" name="red-ui-beaver-pause-option" value="pause-bp"><span data-i18n="node-red-contrib-beaver/beaver:label.breakpointAction.pause-bp"></span></label>').appendTo(settingsPanel);
            // settingsPanel.i18n();
            // settingsPanel.find('input[type="radio"]').on("change", function (evt) {
            //     $.ajax({
            //         url: "beaver",
            //         contentType: "application/json",
            //         type: "PUT",
            //         data: JSON.stringify({ config: { breakpointAction: this.value } }),
            //         success: function (resp) { },
            //         error: function (jqXHR, textStatus, errorThrown) {
            //             console.log(jqXHR, textStatus, errorThrown);
            //         }
            //     });
            // });
            // settingsPanel.on("mouseleave", function () {
            //     settingsPanelPopover.hide(false);
            // })
            // const settingsPanelPopover: any = RED.popover.panel(settingsPanel);



            const stackContainer: JQuery = $('<div>', { class: "red-ui-beaver-stack" }).css({ height: "100%" }).appendTo(sidebarContent);
            const sections: any = RED.stack.create({
                container: stackContainer
            });
            const breakpointSection: any = sections.add({
                title: RED._("node-red-contrib-beaver/beaver:label.breakpoints"),
                collapsible: true
            });
            breakpointSection.expand();
            breakpointSection.content.css({ height: "100%" });


            RED.events.on("workspace:change", function () {
                return;
            });


            RED.comms.subscribe("beaver/connected", function (_topic, _msg) {
                return;
            });

            RED.actions.add("beaver:show-beaver-tab", () => RED.sidebar.show("beaver"));
            RED.actions.add("beaver:pause-flows", function () { postCommand('pause') });
            // RED.actions.add("beaver:enable-beaver", function () {
            //     beaverEnabledToggle.prop("checked", true).trigger("change");
            // });

        }
    })
})();

export { postCommand };