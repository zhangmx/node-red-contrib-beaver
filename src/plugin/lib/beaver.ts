import * as Location from "./location"
import { Breakpoint, PausedEvent, MessageEvent } from "./types"
import { ReceiveEvent, SendEvent, EventCallback } from "../nr-types"
// import { EventCallback } from "../nr-types"
// import { ReceiveEvent, SendEvent } from "node-red__util";
import { MessageQueue } from "./MessageQueue"
import { EventEmitter } from "events"
import { NodeRedApp, NodeAPI } from "node-red";

const DEBUGGER_PAUSED = Symbol("node-red-contrib-beaver: paused");

type BeaverConfig = {
    breakpointAction: "pause-all" | "pause-bp"
}
interface MessageQueueTable {
    [Key: string]: MessageQueue
}

let BREAKPOINT_ID = 1;


// eslint-disable-next-line @typescript-eslint/no-explicit-any
// function getProperty(obj: any, prop: any) {
//     RangeError: Maximum call stack size exceeded
//     Object.defineProperty(obj, prop, {
//         get: function () {
//             return this[prop];
//         },
//         set: function (value) {
//             this[prop] = value;
//         }
//     });
//     return obj[prop];
// }


export class Beaver extends EventEmitter {

    PRIVATERED: NodeRedApp;
    RED: NodeAPI;
    enabled: boolean;
    pausedLocations: Set<string>;
    breakpoints: Map<string, Breakpoint>;
    breakpointsByLocation: Map<string, Breakpoint>;
    eventNumber: number;
    queuesByLocation: MessageQueueTable;
    messageQueue: MessageQueue;
    config: BeaverConfig;

    // Events:
    //  paused / resumed

    constructor(RED: NodeAPI, PRIVATERED: NodeRedApp) {
        console.log("Beaver constructor");
        console.log("RED", RED.version());
        // console.log(RED.runtime);
        console.log("RED", RED.settings.get("editorTheme").testing.enabled);

        super();
        this.config = {
            breakpointAction: "pause-all"
        };
        this.RED = RED;
        this.PRIVATERED = PRIVATERED;
        this.enabled = false;
        this.breakpoints = new Map();
        this.pausedLocations = new Set();
        this.breakpointsByLocation = new Map();
        this.queuesByLocation = {};
        this.messageQueue = new MessageQueue("Time");
        this.eventNumber = 0;
    }
    log(message: string) {
        this.RED.log.info(`[beaver] ${message}`)
    }

    private checkLocation(location: Location.Location, event: SendEvent | ReceiveEvent, done: EventCallback) {
        const breakpointId: string = location.getBreakpointLocation();

        this.RED

        this.queueEvent(location, event, done);

        //TODO what if the node is paused but the breakpoint is not active?

        if (this.isNodePaused(location.id)) {
            this.queueEvent(location, event, done);
        } else {
            if (event.msg && event.msg[DEBUGGER_PAUSED]) {
                this.pause({
                    reason: "step",
                    node: location.id
                })
                this.queueEvent(location, event, done);
            } else {
                const bp = this.breakpointsByLocation.get(breakpointId);
                if (bp && bp.active) {
                    this.pause({
                        reason: "breakpoint",
                        node: location.id,
                        breakpoint: bp.id
                    })
                    this.queueEvent(location, event, done);
                } else {
                    done();
                }
            }
        }
    }

    enable() {
        this.log("Enabled");
        this.enabled = true;
        this.RED.hooks.add("preRoute.beaver", (sendEvent: SendEvent, done: EventCallback) => {
            console.log("preRoute beaver")
            // console.log( sendEvent.source.node, sendEvent.source.node._flow)
            // console.log(done)

            if (isNodeInSubflowModule(sendEvent.source.node)) {
                // Inside a subflow module - don't pause the event
                done();
                return;
            }

            if (sendEvent.source.node._flow) {
                let _flow_id = "";
                if (Object.prototype.hasOwnProperty.call(sendEvent.source.node._flow, "id")) {
                    // get the flow id from _flow with Object.prototype

                    // _flow_id = getProperty(sendEvent.source.node._flow, "id");
                    _flow_id = sendEvent.source.node._flow["id"];
                }

                if (

                    sendEvent.source.node._flow.TYPE !== "flow" &&
                    // sendEvent.source.node._flow.TYPE !== "subflow" &&
                    sendEvent.source.node.id === _flow_id
                ) {
                    // This is the subflow output which, in the current implementation
                    // means the message is actually about to be routed to the first node
                    // inside the subflow, not the output of actual subflow.
                    done();
                    return;
                }
            }


            if (sendEvent.cloneMessage) {
                sendEvent.msg = this.RED.util.cloneMessage(sendEvent.msg);
                sendEvent.cloneMessage = false;
            }
            const eventLocation = Location.createLocation(sendEvent);
            // console.log("preRoute",eventLocation.toString());
            this.checkLocation(eventLocation, sendEvent, done);
        });
        this.RED.hooks.add("onReceive.beaver", (receiveEvent: ReceiveEvent, done: EventCallback) => {

            console.log("onReceive beaver")
            // console.log(done)

            if (receiveEvent.destination.node.type === "inject") {
                // Never pause an Inject node's internal receive event
                done();
                return;
            }
            if (isNodeInSubflowModule(receiveEvent.destination.node)) {
                // Inside a subflow module - don't pause the event
                done();
                return;
            }
            const eventLocation = Location.createLocation(receiveEvent);
            // console.log("onReceive",eventLocation.toString());
            this.checkLocation(eventLocation, receiveEvent, done);
        });
    }

    disable() {
        this.log("Disabled");
        this.enabled = false;
        this.RED.hooks.remove("*.beaver");
        this.pausedLocations.clear();
        this.drainQueues(true);
    }
    // pause(event?:PausedEvent) {
    //     if (this.enabled) {
    //         let logReason:string;
    //         if (event) {
    //             if (this.config.breakpointAction === "pause-all") {
    //                 this.pausedLocations.clear();
    //                 this.pausedLocations.add("*");
    //             } else {
    //                 this.pausedLocations.add(event!.node);
    //             }
    //             if (event.reason === "breakpoint") {
    //                 logReason = "@"+this.breakpoints.get(event.breakpoint).location.toString()
    //             } else if (event.reason === "step") {
    //                 logReason = "@"+event.node
    //             }
    //             event.pausedLocations = [...this.pausedLocations];
    //         } else {
    //             // Manual pause
    //             this.pausedLocations.clear();
    //             this.pausedLocations.add("*");
    //             logReason = "manual";
    //         }
    //         this.log(`Flows paused: ${logReason}`);
    //         this.emit("paused",  event || { reason: "manual" })
    //     }
    // }

    // pause(event?: PausedEvent) {
    //     if (this.enabled) {
    //         let logReason: string;
    //         if (event) {
    //             if (event.node !== undefined) {
    //                 if (this.config.breakpointAction === "pause-all") {
    //                     this.pausedLocations.clear();
    //                     this.pausedLocations.add("*");
    //                 } else {
    //                     this.pausedLocations.add(event.node);
    //                 }
    //             }
    //             if (event.reason === "breakpoint") {
    //                 logReason = "@" + this.breakpoints.get(event.breakpoint).location.toString();
    //             } else if (event.reason === "step") {
    //                 logReason = "@" + event.node;
    //             }
    //             event.pausedLocations = [...this.pausedLocations];
    //         } else {
    //             // Manual pause
    //             this.pausedLocations.clear();
    //             this.pausedLocations.add("*");
    //             logReason = "manual";
    //         }
    //         this.log(`Flows paused: ${logReason}`);
    //         this.emit("paused", event || { reason: "manual" });
    //     }
    // }

    // pause(event?: PausedEvent | undefined) {
    //     if (this.enabled) {
    //         let logReason: string;
    //         if (event && event.node !== undefined) {
    //             if (this.config.breakpointAction === "pause-all") {
    //                 this.pausedLocations.clear();
    //                 this.pausedLocations.add("*");
    //             } else {
    //                 this.pausedLocations.add(event.node);
    //             }
    //             if (event.reason === "breakpoint") {
    //                 logReason = "@" + this.breakpoints.get(event.breakpoint).location.toString();
    //             } else if (event.reason === "step") {
    //                 logReason = "@" + event.node;
    //             }
    //             event.pausedLocations = [...this.pausedLocations];
    //         } else {
    //             // Manual pause
    //             this.pausedLocations.clear();
    //             this.pausedLocations.add("*");
    //             logReason = "manual";
    //             event = { reason: "manual" };
    //         }
    //         this.log(`Flows paused: ${logReason}`);
    //         this.emit("paused", event);
    //     }
    // }

    // pause(event?: PausedEvent) {
    //     if (this.enabled) {
    //       let logReason = "";
    //       if (event && event.node !== undefined) {
    //         if (this.config.breakpointAction === "pause-all") {
    //           this.pausedLocations.clear();
    //           this.pausedLocations.add("*");
    //         } else {
    //           this.pausedLocations.add(event.node);
    //         }
    //         if (event.reason === "breakpoint") {
    //           const breakpoint = this.breakpoints.get(event.breakpoint);
    //           if (breakpoint) {
    //             logReason = "@" + breakpoint.location.toString();
    //           }
    //         } else if (event.reason === "step") {
    //           logReason = "@" + event.node;
    //         }
    //         event.pausedLocations = [...this.pausedLocations];
    //       } else {
    //         // Manual pause
    //         this.pausedLocations.clear();
    //         this.pausedLocations.add("*");
    //         logReason = "manual";
    //       }
    //       this.log(`Flows paused: ${logReason}`);
    //       this.emit("paused", event || { reason: "manual" });
    //     }
    //   }

    pause(event?: PausedEvent) {
        if (this.enabled) {
            console.log("pause", event)
            let logReason = "manual";
            if (event) {
                if (event.node) {
                    if (this.config.breakpointAction === "pause-all") {
                        this.pausedLocations.clear();
                        this.pausedLocations.add("*");
                    } else {
                        this.pausedLocations.add(event.node);
                    }
                }
                if (event.reason === "breakpoint") {
                    const breakpoint = event.breakpoint;
                    if (typeof breakpoint === "string") {
                        const _breakpoint = this.breakpoints.get(breakpoint);
                        if (_breakpoint) {
                            logReason = "@" + _breakpoint.location.toString();
                        }
                    }
                    // logReason = "@" + this.breakpoints.get(event.breakpoint).location.toString();
                } else if (event.reason === "step") {
                    logReason = "@" + event.node;
                }
                event.pausedLocations = [...this.pausedLocations];
                logReason = logReason || "manual";
            } else {
                // Manual pause
                this.pausedLocations.clear();
                this.pausedLocations.add("*");
            }
            this.log(`Flows paused: ${logReason}`);
            this.emit("paused", event || { reason: "manual" });
        }
    }
    resume(nodeId?: string) {
        if (this.pausedLocations.size === 0) {
            return;
        }
        if (!nodeId || nodeId === "*") {
            console.log("resume - clear all locations")
            this.pausedLocations.clear();
        } else if (nodeId && this.pausedLocations.has(nodeId)) {
            this.pausedLocations.delete(nodeId);
        } else {
            // Nothing has been unpaused
            return;
        }
        this.log("Flows resumed");
        this.emit("resumed", { node: nodeId })
        this.drainQueues();
    }
    deleteMessage(messageId: number) {
        const nextEvent = this.messageQueue.get(messageId);
        if (nextEvent) {
            this.messageQueue.remove(nextEvent);
            const nextEventLocation = nextEvent.location.toString();
            this.queuesByLocation[nextEventLocation].remove(nextEvent);
            const queueDepth = this.queuesByLocation[nextEventLocation].length;
            if (queueDepth === 0) {
                delete this.queuesByLocation[nextEventLocation]
            }
            this.emit("messageDispatched", { id: nextEvent.id, location: nextEventLocation, depth: queueDepth })
            // Call done with false to prevent any further processing
            nextEvent.done(false);
        }
    }
    private isNodePaused(nodeId: string) {
        return this.pausedLocations.has("*") || this.pausedLocations.has(nodeId);
    }
    private drainQueues(quiet?: boolean) {
        for (const nextEvent of this.messageQueue) {
            const eventNodeId = nextEvent.location.id;
            if (!this.isNodePaused(eventNodeId)) {
                const nextEventLocation = nextEvent.location.toString();
                this.queuesByLocation[nextEventLocation].remove(nextEvent);
                const queueDepth = this.queuesByLocation[nextEventLocation].length;
                if (queueDepth === 0) {
                    delete this.queuesByLocation[nextEventLocation]
                }
                if (!quiet) {
                    this.emit("messageDispatched", { id: nextEvent.id, location: nextEventLocation, depth: queueDepth })
                }
                // if (nextEvent.event.msg[DEBUGGER_PAUSED]) {
                //     delete nextEvent.event.msg[DEBUGGER_PAUSED];
                // }
                nextEvent.done();
                this.messageQueue.remove(nextEvent);
            }
        }
    }
    setBreakpoint(location: Location.Location): string {
        const bp: Breakpoint = {
            id: (BREAKPOINT_ID++) + "",
            location,
            active: true,
            mode: "all"
        }
        this.breakpoints.set(bp.id, bp);
        this.breakpointsByLocation.set(location.toString(), bp);
        return bp.id;
    }
    getBreakpoint(breakpointId: string) {
        return this.breakpoints.get(breakpointId);
    }
    setBreakpointActive(breakpointId: string, state: boolean) {
        const bp = this.breakpoints.get(breakpointId);
        if (bp) {
            bp.active = state
        }
    }

    clearBreakpoint(breakpointId: string) {
        const bp = this.breakpoints.get(breakpointId);
        if (bp) {
            this.breakpoints.delete(breakpointId);
            this.breakpointsByLocation.delete(bp.location.toString());
        }
    }

    getBreakpoints(): Breakpoint[] {
        return Array.from(this.breakpoints.values());
    }

    // TODO change to start run from a specific node
    step(messageId?: number) {
        if (this.enabled) {
            let nextEvent: MessageEvent | null;
            if (messageId) {
                nextEvent = this.messageQueue.get(messageId);
                if (nextEvent) {
                    this.messageQueue.remove(nextEvent);
                }
            } else {
                nextEvent = this.messageQueue.next();
            }
            if (nextEvent) {
                const nextEventLocation = nextEvent.location.toString();
                this.log("Step: " + nextEventLocation);

                this.queuesByLocation[nextEventLocation].remove(nextEvent);
                const queueDepth = this.queuesByLocation[nextEventLocation].length;
                if (queueDepth === 0) {
                    delete this.queuesByLocation[nextEventLocation]
                }
                // nextEvent.event.msg[DEBUGGER_PAUSED] = true;
                this.emit("messageDispatched", { id: nextEvent.id, location: nextEventLocation, depth: queueDepth })
                nextEvent.done();
            }
        }
    }

    // setConfig(newConfig: object): boolean {
    //     let changed = false;
    //     for (const key in this.config) {
    //         if (newConfig.hasOwnProperty(key) && this.config[key] !== newConfig[key]) {
    //             changed = true;
    //             this.config[key] = newConfig[key];
    //         }
    //     }
    //     return changed;
    // }

    setConfig(newConfig: object): boolean {
        let changed = false;
        for (const [key, value] of Object.entries(newConfig)) {
            if (Object.prototype.hasOwnProperty.call(newConfig, key) && this.config[key as keyof BeaverConfig] !== value) {
                changed = true;
                this.config[key as keyof BeaverConfig] = value;
            }
        }
        return changed;
    }



    getState(): object {
        if (!this.enabled) {
            return { enabled: false }
        }
        return {
            enabled: true,
            pausedLocations: [...this.pausedLocations],
            config: this.config,
            breakpoints: this.getBreakpoints(),
            queues: this.getMessageQueueDepths()
        }
    }
    getMessageSummary() {
        return Array.from(this.messageQueue).map(m => {
            return {
                id: m.id,
                location: m.location
            }
        })
    }
    getMessageQueue(): MessageQueue {
        return this.messageQueue;
    }

    getMessageQueueDepths(): { [key: string]: { depth: number } } {
        if (!this.enabled) {
            return {};
        }
        const result: { [key: string]: { depth: number } } = {};
        for (const [locationId, queue] of Object.entries(this.queuesByLocation)) {
            result[locationId] = { depth: queue.length };
        }
        return result;
    }



    dump(): string {
        let result = `Beaver State
---
${this.messageQueue.dump()}
`;
        const locationIds = Object.keys(this.queuesByLocation);
        locationIds.forEach(id => {
            result += `---
Location: ${id}
${this.queuesByLocation[id].dump()}
`;
        })
        return result;
    }



    private queueEvent(location: Location.Location, event: SendEvent | ReceiveEvent, done: EventCallback) {
        const locationId = location.toString();
        if (!this.queuesByLocation[locationId]) {
            this.queuesByLocation[locationId] = new MessageQueue("Location");
        }
        const messageEvent: MessageEvent = {
            id: this.eventNumber++,
            event,
            location,
            done,
            nextByLocation: null,
            previousByLocation: null,
            nextByTime: null,
            previousByTime: null
        }
        this.queuesByLocation[locationId].enqueue(messageEvent);
        this.messageQueue.enqueue(messageEvent);
        const queuedEvent = {
            id: messageEvent.id,
            location: locationId,
            msg: event.msg,
            depth: this.queuesByLocation[locationId].length,
            destination: null as string | null,
        };
        if (isSendEvent(event)) {
            // SendEvent - so include the destination location id
            queuedEvent.destination = "/" + event.destination.id + "[i][0]"
        }
        this.emit("messageQueued", queuedEvent)
    }
}

function isSendEvent(event: SendEvent | ReceiveEvent): event is SendEvent {
    return (event as SendEvent).destination !== undefined;
}

const MODULE_TYPE_RE = /^module:/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isNodeInSubflowModule(node: any) {
    let f = node._flow;
    do {
        if (f.TYPE === "flow") {
            return false;
        }
        if (MODULE_TYPE_RE.test(f.TYPE)) {
            return true;
        }
        f = f.parent;
    } while (f && f.TYPE);
    return false;
}
