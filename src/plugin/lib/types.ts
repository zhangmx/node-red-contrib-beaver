// import { EventCallback } from "../nr-types"
// import { ReceiveEvent, SendEvent } from "node-red__util";
import {ReceiveEvent, SendEvent, EventCallback} from "../nr-types"
import * as Location from "./location"

export interface MessageEvent {
    id: number;
    event: SendEvent | ReceiveEvent;
    location: Location.Location;
    done: EventCallback;
    nextByLocation: MessageEvent| null;
    previousByLocation: MessageEvent| null;
    nextByTime: MessageEvent| null;
    previousByTime: MessageEvent| null;
}

/**
 * Triggered when the beaver is paused
 * @param reason why the beaver paused: 'breakpoint', 'step', 'manual'
 * @param node the id of the node that is paused
 * @param breakpoint the breakpoint, if any, that triggered the pause
 * @param data any other data associated with the event
 */
export interface PausedEvent {
    reason: string,
    node?: string,
    breakpoint?: string,
    pausedLocations?: string[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
}

export interface Breakpoint {
    id: string,
    location: Location.Location,
    active: boolean,
    mode: "all" | "flow" | "node"
}
