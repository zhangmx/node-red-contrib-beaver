import {ReceiveEvent, SendEvent} from "../nr-types"

type PortType = "i" | "o";

export class Location {
    /** The node id. This could be a generated node id from inside a subflow */
    id: string;
    /** The path to the node. This will be resolvable to an actual node in the flow */
    path: string;
    /** The type of port - either 'o' or 'i' */
    portType: PortType;
    /** The index of the port - 0-indexed */
    portIndex: number;

    inSubflow = false;

    constructor(nodeId:string, nodePath:string, portType:PortType="o", portIndex=0) {
        this.id = nodeId;
        this.path = nodePath;
        this.portType = portType;
        this.portIndex = portIndex;
    }
    getBreakpointLocation(): string {
        if (this.inSubflow) {
            return `*/${this.id}[${this.portType}][${this.portIndex}]`
        } else {
            return this.toString();
        }
    }
    toString(): string {
        return `${this.path}/${this.id}[${this.portType}][${this.portIndex}]`
    }
}

export function createLocation(event:ReceiveEvent|SendEvent): Location {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node:any;
    let portType:PortType;
    let portIndex:number;
    if ('source' in event) {
        node = (event as SendEvent).source.node;
        portType = "o";
        portIndex = (event as SendEvent).source.port;
    } else {
        node = (event as ReceiveEvent).destination.node;
        portType = "i";
        portIndex = 0;
    }
    const l = new Location(node._alias || node.id, node._flow.path, portType, portIndex);
    if (node._alias) {
        l.inSubflow = true;
    }
    return l;
}
