import { MessageEvent } from "./types"

type T = "nextByLocation" | "previousByLocation" | "nextByTime" | "previousByTime";

export class MessageQueue {
    queueName: string;
    private previousName: T;
    private nextName: T;
    head!: MessageEvent | null;
    tail!: MessageEvent| null
    length: number;

    constructor(queueName: string) {
        this.queueName = queueName;
        this.previousName = `previousBy${queueName}` as T;
        this.nextName = `nextBy${queueName}` as T;
        this.length = 0;
    }
    enqueue(event: MessageEvent) {
        console.log(" ============= ")
        console.log(event)
        console.log(" =======-------==")
        if (!this.head) {
            this.head = event;
        }
        event[this.previousName] = this.tail;
        if (this.tail) {
            this.tail[this.nextName] = event;
        }
        this.tail = event;
        this.length++;
    }
    next(): MessageEvent |null {
        const result = this.head;
        if (result) {
            this.remove(result);
            this.length--;
        }
        return result;
    }
    peek(): MessageEvent| null {
        return this.head;
    }
    get(id: number): MessageEvent | null{
        let p = this.head;
        while (p) {
            if (p.id === id) {
                return p;
            }
            p = p[this.nextName]
        }
        return null
    }
    remove(event: MessageEvent) {
        const previousEvent = event[this.previousName];
        const nextEvent = event[this.nextName];
        if (previousEvent) {
            previousEvent[this.nextName] = nextEvent;
        } else {
            this.head = nextEvent;
        }
        if (nextEvent) {
            nextEvent[this.previousName] = previousEvent;
        } else {
            this.tail = previousEvent;
        }
        this.length--;
    }
    *[Symbol.iterator]() {
        let p = this.head;
        while (p) {
            yield p;
            p = p[this.nextName];
        }
    }
    dump(): string {
        let result = `MessageQueue ${this.queueName} [${this.length}]
  head: ${this.head?.id}
  tail: ${this.tail?.id}
  list: `;
        let p = this.head;
        while (p) {
            result = result + p.id;
            p = p[this.nextName];
            if (p) {
                result += " > ";
            }
        }
        return result

    }
}
