import {Debugger} from "./lib/debugger"
import {PausedEvent} from "./lib/types"
import {Location} from "./lib/location"

module.exports = (RED:any) => {

    const apiRoot = "/beaver";

    RED.plugins.registerPlugin("node-red-contrib-beaver", {
        onadd: () => {

            const flowDebugger = new Debugger(RED);
            const routeAuthHandler = RED.auth.needsPermission("beaver.write");

            RED.comms.publish("beaver/connected",true, true)

            function publishState() {
                RED.comms.publish("beaver/state",flowDebugger.getState())
            }

            flowDebugger.on("paused", (event:PausedEvent) => {
                RED.comms.publish("beaver/paused",event)
            })

            flowDebugger.on("resumed", (event:PausedEvent) => {
                RED.comms.publish("beaver/resumed",event)
            })
            flowDebugger.on("messageQueued", (event) => {
                // Don't include the full message on the event
                // event.msg = RED.util.encodeObject({msg:event.msg}, {maxLength: 100});
                delete event.msg;
                RED.comms.publish("beaver/messageQueued",event)
            });
            flowDebugger.on("messageDispatched", (event) => {
                RED.comms.publish("beaver/messageDispatched",event)
            });
            // flowDebugger.on("step", (event) => {
            //
            // });

            RED.httpAdmin.get(`${apiRoot}`, (_:any, res:any) => {
                res.json(flowDebugger.getState());
            });

            RED.httpAdmin.put(`${apiRoot}`, routeAuthHandler, (req:any, res:any) => {
                let stateChanged = false;
                // if (req.body.hasOwnProperty("enabled")) {
                if (Object.prototype.hasOwnProperty.call(req.body,"enabled")) {
                    const enabled = !!req.body.enabled;
                    if (enabled && !flowDebugger.enabled) {
                        flowDebugger.enable();
                        stateChanged = true;
                    } else if (!enabled && flowDebugger.enabled) {
                        flowDebugger.disable();
                        stateChanged = true;
                    }
                }
                if (Object.prototype.hasOwnProperty.call(req.body,"config")) {
                // if (req.body.hasOwnProperty("config")) {
                    stateChanged = flowDebugger.setConfig(req.body.config);
                }
                if (stateChanged) {
                    publishState();
                }
                res.json(flowDebugger.getState());
            });

            RED.httpAdmin.get(`${apiRoot}/breakpoints`, routeAuthHandler, (_:any, res:any) => {
                res.json(flowDebugger.getBreakpoints());
            })
            RED.httpAdmin.put(`${apiRoot}/breakpoints/:id`, routeAuthHandler, (req:any, res:any) => {
                flowDebugger.setBreakpointActive(req.params.id, req.body.active)
                res.json(flowDebugger.getBreakpoint(req.params.id));
            })
            RED.httpAdmin.delete(`${apiRoot}/breakpoints/:id`, routeAuthHandler, (req:any, res:any) => {
                flowDebugger.clearBreakpoint(req.params.id)
                res.sendStatus(200)
            })
            RED.httpAdmin.post(`${apiRoot}/breakpoints`, routeAuthHandler, (req:any, res:any) => {
                // req.body.location
                const breakpointId = flowDebugger.setBreakpoint(new Location(req.body.id,req.body.path,req.body.portType,req.body.portIndex))
                res.json(flowDebugger.getBreakpoint(breakpointId));
            })
            RED.httpAdmin.get(`${apiRoot}/messages`, routeAuthHandler, (_:any, res:any) => {
                res.json(Array.from(flowDebugger.getMessageQueue()).map(m => {
                    const result = {
                        id: m.id,
                        location: m.location.toString(),
                        destination: undefined as string|undefined,
                        msg: RED.util.encodeObject({msg:m.event.msg}, {maxLength: 100})
                    }
                    if (Object.prototype.hasOwnProperty.call(m.event,"source")) {
                    // if (m.event.hasOwnProperty('source')) {
                        
                        // SendEvent - so include the destination location id
                        result.destination = m.event.destination.id+"[i][0]"
                    }
                    return result;
                }))
            });
            RED.httpAdmin.get(`${apiRoot}/messages/:id`, routeAuthHandler, (req:any, res:any) => {
                const id = req.params.id;
                const messageEvent = flowDebugger.getMessageQueue().get(parseInt(id,10));
                if (messageEvent) {
                    const result = {
                        id: messageEvent.id,
                        location: messageEvent.location,
                        destination: undefined as string|undefined,
                        msg: RED.util.encodeObject({msg:messageEvent.event.msg}, {maxLength: 100})
                    }
                    // if (messageEvent.event.hasOwnProperty('source')) {
                    if (Object.prototype.hasOwnProperty.call(messageEvent.event,"source")) {
                        // SendEvent - so include the destination location id
                        result.destination = messageEvent.event.destination.id+"[i][0]"
                    }
                    res.json(result)
                } else {
                    res.sendStatus(404);
                }
            });
            RED.httpAdmin.delete(`${apiRoot}/messages/:id`, routeAuthHandler, (req:any, res:any) => {
                flowDebugger.deleteMessage(parseInt(req.params.id,10));
                res.sendStatus(200);
            });
            RED.httpAdmin.post(`${apiRoot}/pause`, routeAuthHandler, (_:any, res:any) => {
                flowDebugger.pause();
                res.sendStatus(200);
            });
            RED.httpAdmin.post(`${apiRoot}/step`, routeAuthHandler, (req:any, res:any) => {
                let stepMessage = null;
                if (req.body && req.body.message) {
                    stepMessage = req.body.message;
                }
                flowDebugger.step(stepMessage);
                res.sendStatus(200);
            });

            RED.httpAdmin.post(`${apiRoot}/resume`, routeAuthHandler, (_:any, res:any) => {
                flowDebugger.resume();
                res.sendStatus(200);
            });
        }
    })
}
/*

/beaver/enable
/beaver/disable
/beaver/breakpoint



*/