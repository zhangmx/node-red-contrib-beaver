import { Beaver } from "./lib/beaver"
import { PausedEvent } from "./lib/types"
import { Location } from "./lib/location"
import { NodeRedApp, NodeAPI } from "node-red";
import { Request, Response } from "express";

// NOTE(alonam) a little trick to require the same "node-red" API to give private access to our own modulesContext.
// from https://gitlab.com/monogoto.io/node-red-contrib-flow-manager
const PRIVATERED: NodeRedApp = (function requireExistingNoderedInstance() {
    if (require.main) {
        for (const child of require.main.children) {
            if (child.filename.endsWith('red.js')) {
                return require(child.filename);
            }
        }
    }
    // In case node-red was not required before, just require it
    return require('node-red');
})();

module.exports = (RED: NodeAPI) => {

    const apiRoot = "/beaver";

    RED.plugins.registerPlugin("node-red-contrib-beaver", {
        onadd: () => {
            console.log("Beaver plugin added");
            // console.log(PRIVATERED.runtime);
            const flowBeaver = new Beaver(RED, PRIVATERED);
            const routeAuthHandler = RED.auth.needsPermission("beaver.write");

            RED.comms.publish("beaver/connected", true, true);

            function publishState() {
                RED.comms.publish("beaver/state", flowBeaver.getState(), false);
            }

            flowBeaver.on("paused", (event: PausedEvent) => {
                RED.comms.publish("beaver/paused", event, false);
            });

            flowBeaver.on("resumed", (event: PausedEvent) => {
                RED.comms.publish("beaver/resumed", event, false);
            });

            flowBeaver.on("messageQueued", (event) => {
                // Don't include the full message on the event
                // event.msg = RED.util.encodeObject({msg:event.msg}, {maxLength: 100});
                delete event.msg;
                RED.comms.publish("beaver/messageQueued", event, false);
            });

            flowBeaver.on("messageDispatched", (event) => {
                RED.comms.publish("beaver/messageDispatched", event, false);
            });

            // flowBeaver.on("step", (event) => {
            //
            // });

            RED.httpAdmin.get(`${apiRoot}`, (_: Request, res: Response) => {
                res.json(flowBeaver.getState());
            });

            RED.httpAdmin.put(`${apiRoot}`, routeAuthHandler, (req: Request, res: Response) => {
                let stateChanged = false;
                // if (req.body.hasOwnProperty("enabled")) {
                if (Object.prototype.hasOwnProperty.call(req.body, "enabled")) {
                    const enabled = !!req.body.enabled;
                    if (enabled && !flowBeaver.enabled) {
                        flowBeaver.enable();
                        stateChanged = true;
                    } else if (!enabled && flowBeaver.enabled) {
                        flowBeaver.disable();
                        stateChanged = true;
                    }
                }
                if (Object.prototype.hasOwnProperty.call(req.body, "config")) {
                    // if (req.body.hasOwnProperty("config")) {
                    stateChanged = flowBeaver.setConfig(req.body.config);
                }
                if (stateChanged) {
                    publishState();
                }
                res.json(flowBeaver.getState());
            });
            // breakpoints
            RED.httpAdmin.get(`${apiRoot}/breakpoints`, routeAuthHandler, (_: Request, res: Response) => {
                res.json(flowBeaver.getBreakpoints());
            });

            RED.httpAdmin.put(`${apiRoot}/breakpoints/:id`, routeAuthHandler, (req: Request, res: Response) => {
                flowBeaver.setBreakpointActive(req.params.id, req.body.active);
                res.json(flowBeaver.getBreakpoint(req.params.id));
            });

            RED.httpAdmin.delete(`${apiRoot}/breakpoints/:id`, routeAuthHandler, (req: Request, res: Response) => {
                flowBeaver.clearBreakpoint(req.params.id);
                res.sendStatus(200);
            });

            RED.httpAdmin.post(`${apiRoot}/breakpoints`, routeAuthHandler, (req: Request, res: Response) => {
                // req.body.location
                console.log(req.body);
                // TODO save node to recording camera list
                const breakpointId = flowBeaver.setBreakpoint(
                    new Location(req.body.id, req.body.path, req.body.portType, req.body.portIndex)
                );
                res.json(flowBeaver.getBreakpoint(breakpointId));
            });
            // messages
            RED.httpAdmin.get(`${apiRoot}/messages`, routeAuthHandler, (_: Request, res: Response) => {
                res.json(Array.from(flowBeaver.getMessageQueue()).map(m => {
                    const result = {
                        id: m.id,
                        location: m.location.toString(),
                        destination: undefined as string | undefined,
                        msg: RED.util.encodeObject({ msg: m.event.msg }, { maxLength: 100 })
                    };
                    if (Object.prototype.hasOwnProperty.call(m.event, "source")) {
                        // if (m.event.hasOwnProperty('source')) {
                        // SendEvent - so include the destination location id
                        result.destination = m.event.destination.id + "[i][0]";
                    }
                    return result;
                }));
            });

            RED.httpAdmin.get(`${apiRoot}/messages/:id`, routeAuthHandler, (req: Request, res: Response) => {
                const id = req.params.id;
                const messageEvent = flowBeaver.getMessageQueue().get(parseInt(id, 10));
                if (messageEvent) {
                    const result = {
                        id: messageEvent.id,
                        location: messageEvent.location,
                        destination: undefined as string | undefined,
                        msg: RED.util.encodeObject({ msg: messageEvent.event.msg }, { maxLength: 100 })
                    };
                    // if (messageEvent.event.hasOwnProperty('source')) {
                    if (Object.prototype.hasOwnProperty.call(messageEvent.event, "source")) {
                        // SendEvent - so include the destination location id
                        result.destination = messageEvent.event.destination.id + "[i][0]";
                    }
                    res.json(result);
                } else {
                    res.sendStatus(404);
                }
            });

            RED.httpAdmin.delete(`${apiRoot}/messages/:id`, routeAuthHandler, (req: Request, res: Response) => {
                flowBeaver.deleteMessage(parseInt(req.params.id, 10));
                res.sendStatus(200);
            });

            RED.httpAdmin.post(`${apiRoot}/pause`, routeAuthHandler, (_: Request, res: Response) => {
                flowBeaver.pause();
                res.sendStatus(200);
            });

            RED.httpAdmin.post(`${apiRoot}/step`, routeAuthHandler, (req: Request, res: Response) => {
                let stepMessage = null;
                if (req.body && req.body.message) {
                    stepMessage = req.body.message;
                }
                flowBeaver.step(stepMessage);
                res.sendStatus(200);
            });

            RED.httpAdmin.post(`${apiRoot}/resume`, routeAuthHandler, (_: Request, res: Response) => {
                flowBeaver.resume();
                res.sendStatus(200);
            });
        },
        type: "beaver"
    })
}
/*

/beaver/enable
/beaver/disable
/beaver/breakpoint



*/
