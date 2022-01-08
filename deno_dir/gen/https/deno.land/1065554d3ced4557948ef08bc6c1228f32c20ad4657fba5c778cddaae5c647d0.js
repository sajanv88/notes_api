import { decodeHexString, encodeHexString } from "../utils.ts";
import { BSONTypeError } from "./error.ts";
import { randomBytes } from "./parser/utils.ts";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");
let PROCESS_UNIQUE = null;
export class ObjectId {
    static #index = Math.floor(Math.random() * 0xff_ff_ff);
    static cacheHexString;
    #id;
    #bytesBuffer;
    constructor(inputId = ObjectId
        .generate()) {
        let workingId;
        if (typeof inputId === "object" && inputId && "id" in inputId) {
            if (typeof inputId.id !== "string" && !ArrayBuffer.isView(inputId.id)) {
                throw new BSONTypeError("Argument passed in must have an id that is of type string or Buffer");
            }
            workingId =
                "toHexString" in inputId && typeof inputId.toHexString === "function"
                    ? decodeHexString(inputId.toHexString())
                    : inputId.id;
        }
        else {
            workingId = inputId;
        }
        if (workingId == null || typeof workingId === "number") {
            this.#bytesBuffer = new Uint8Array(ObjectId.generate(typeof workingId === "number" ? workingId : undefined));
        }
        else if (ArrayBuffer.isView(workingId) && workingId.byteLength === 12) {
            this.#bytesBuffer = workingId;
        }
        else if (typeof workingId === "string") {
            if (workingId.length === 12) {
                const bytes = textEncoder.encode(workingId);
                if (bytes.byteLength === 12) {
                    this.#bytesBuffer = bytes;
                }
                else {
                    throw new BSONTypeError("Argument passed in must be a string of 12 bytes");
                }
            }
            else if (workingId.length === 24 && checkForHexRegExp.test(workingId)) {
                this.#bytesBuffer = decodeHexString(workingId);
            }
            else {
                throw new BSONTypeError("Argument passed in must be a string of 12 bytes or a string of 24 hex characters");
            }
        }
        else {
            throw new BSONTypeError("Argument passed in does not match the accepted types");
        }
        if (ObjectId.cacheHexString) {
            this.#id = encodeHexString(this.id);
        }
    }
    get id() {
        return this.#bytesBuffer;
    }
    set id(value) {
        this.#bytesBuffer = value;
        if (ObjectId.cacheHexString) {
            this.#id = encodeHexString(value);
        }
    }
    toHexString() {
        if (ObjectId.cacheHexString && this.#id) {
            return this.#id;
        }
        const hexString = encodeHexString(this.id);
        if (ObjectId.cacheHexString && !this.#id) {
            this.#id = hexString;
        }
        return hexString;
    }
    static generate(time) {
        if ("number" !== typeof time) {
            time = Math.floor(Date.now() / 1000);
        }
        const inc = (this.#index = (this.#index + 1) % 0xff_ff_ff);
        const objectId = new Uint8Array(12);
        new DataView(objectId.buffer, 0, 4).setUint32(0, time);
        if (PROCESS_UNIQUE === null) {
            PROCESS_UNIQUE = randomBytes(5);
        }
        objectId[4] = PROCESS_UNIQUE[0];
        objectId[5] = PROCESS_UNIQUE[1];
        objectId[6] = PROCESS_UNIQUE[2];
        objectId[7] = PROCESS_UNIQUE[3];
        objectId[8] = PROCESS_UNIQUE[4];
        objectId[11] = inc & 0xff;
        objectId[10] = (inc >> 8) & 0xff;
        objectId[9] = (inc >> 16) & 0xff;
        return objectId;
    }
    toString() {
        return this.toHexString();
    }
    toJSON() {
        return this.toHexString();
    }
    equals(otherId) {
        if (otherId == null) {
            return false;
        }
        if (otherId instanceof ObjectId) {
            return this.toString() === otherId.toString();
        }
        if (typeof otherId === "string" &&
            ObjectId.isValid(otherId) &&
            otherId.length === 12 &&
            this.id instanceof Uint8Array) {
            return otherId === textDecoder.decode(this.id);
        }
        if (typeof otherId === "string" && ObjectId.isValid(otherId) &&
            otherId.length === 24) {
            return otherId.toLowerCase() === this.toHexString();
        }
        if (typeof otherId === "string" && ObjectId.isValid(otherId) &&
            otherId.length === 12) {
            const otherIdUint8Array = textEncoder.encode(otherId);
            for (let i = 0; i < 12; i++) {
                if (otherIdUint8Array[i] !== this.id[i]) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }
    getTimestamp() {
        const timestamp = new Date();
        const time = new DataView(this.id.buffer, 0, 4).getUint32(0);
        timestamp.setTime(Math.floor(time) * 1000);
        return timestamp;
    }
    static createFromTime(time) {
        const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        new DataView(buffer.buffer, 0, 4).setUint32(0, time);
        return new ObjectId(buffer);
    }
    static createFromHexString(hexString) {
        if (typeof hexString === "undefined" ||
            (hexString != null && hexString.length !== 24)) {
            throw new BSONTypeError("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
        }
        return new ObjectId(decodeHexString(hexString));
    }
    static isValid(id) {
        if (id == null)
            return false;
        try {
            new ObjectId(id);
            return true;
        }
        catch {
            return false;
        }
    }
    [Symbol.for("Deno.customInspect")]() {
        return `new ObjectId("${this.toHexString()}")`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0aWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvYmplY3RpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMvRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUVoRCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO0FBQ3RDLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFHdEMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBRzFELElBQUksY0FBYyxHQUFzQixJQUFJLENBQUM7QUFLN0MsTUFBTSxPQUFPLFFBQVE7SUFDbkIsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUN2RCxNQUFNLENBQUMsY0FBYyxDQUFVO0lBRy9CLEdBQUcsQ0FBVTtJQUNiLFlBQVksQ0FBYTtJQU16QixZQUNFLFVBQW1ELFFBQVE7U0FDeEQsUUFBUSxFQUFFO1FBR2IsSUFBSSxTQUF1QyxDQUFDO1FBQzVDLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO1lBQzdELElBQUksT0FBTyxPQUFPLENBQUMsRUFBRSxLQUFLLFFBQVEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFO2dCQUNyRSxNQUFNLElBQUksYUFBYSxDQUNyQixxRUFBcUUsQ0FDdEUsQ0FBQzthQUNIO1lBQ0QsU0FBUztnQkFDUCxhQUFhLElBQUksT0FBTyxJQUFJLE9BQU8sT0FBTyxDQUFDLFdBQVcsS0FBSyxVQUFVO29CQUNuRSxDQUFDLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQztvQkFDeEMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7U0FDbEI7YUFBTTtZQUNMLFNBQVMsR0FBRyxPQUFPLENBQUM7U0FDckI7UUFHRCxJQUFJLFNBQVMsSUFBSSxJQUFJLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFO1lBR3RELElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FDbEQsT0FBTyxTQUFTLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FDdEQsQ0FBQyxDQUFDO1NBQ0o7YUFBTSxJQUFJLFdBQVcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsS0FBSyxFQUFFLEVBQUU7WUFDdkUsSUFBSSxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUM7U0FDL0I7YUFBTSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRTtZQUN4QyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssRUFBRSxFQUFFO2dCQUMzQixNQUFNLEtBQUssR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM1QyxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssRUFBRSxFQUFFO29CQUMzQixJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQztpQkFDM0I7cUJBQU07b0JBQ0wsTUFBTSxJQUFJLGFBQWEsQ0FDckIsaURBQWlELENBQ2xELENBQUM7aUJBQ0g7YUFDRjtpQkFBTSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssRUFBRSxJQUFJLGlCQUFpQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDdkUsSUFBSSxDQUFDLFlBQVksR0FBRyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDaEQ7aUJBQU07Z0JBQ0wsTUFBTSxJQUFJLGFBQWEsQ0FDckIsa0ZBQWtGLENBQ25GLENBQUM7YUFDSDtTQUNGO2FBQU07WUFDTCxNQUFNLElBQUksYUFBYSxDQUNyQixzREFBc0QsQ0FDdkQsQ0FBQztTQUNIO1FBRUQsSUFBSSxRQUFRLENBQUMsY0FBYyxFQUFFO1lBQzNCLElBQUksQ0FBQyxHQUFHLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztTQUNyQztJQUNILENBQUM7SUFNRCxJQUFJLEVBQUU7UUFDSixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDM0IsQ0FBQztJQUVELElBQUksRUFBRSxDQUFDLEtBQWlCO1FBQ3RCLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDO1FBQzFCLElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRTtZQUMzQixJQUFJLENBQUMsR0FBRyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNuQztJQUNILENBQUM7SUFHRCxXQUFXO1FBQ1QsSUFBSSxRQUFRLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDdkMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO1NBQ2pCO1FBRUQsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUUzQyxJQUFJLFFBQVEsQ0FBQyxjQUFjLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ3hDLElBQUksQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFDO1NBQ3RCO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQU9ELE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBYTtRQUMzQixJQUFJLFFBQVEsS0FBSyxPQUFPLElBQUksRUFBRTtZQUM1QixJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7U0FDdEM7UUFFRCxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDO1FBQzNELE1BQU0sUUFBUSxHQUFHLElBQUksVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBR3BDLElBQUksUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFHdkQsSUFBSSxjQUFjLEtBQUssSUFBSSxFQUFFO1lBQzNCLGNBQWMsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDakM7UUFHRCxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFHaEMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUM7UUFDMUIsUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNqQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBRWpDLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFLRCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUdELE1BQU07UUFDSixPQUFPLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBT0QsTUFBTSxDQUFDLE9BQTBCO1FBQy9CLElBQUksT0FBTyxJQUFJLElBQUksRUFBRTtZQUNuQixPQUFPLEtBQUssQ0FBQztTQUNkO1FBRUQsSUFBSSxPQUFPLFlBQVksUUFBUSxFQUFFO1lBQy9CLE9BQU8sSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztTQUMvQztRQUVELElBQ0UsT0FBTyxPQUFPLEtBQUssUUFBUTtZQUMzQixRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUN6QixPQUFPLENBQUMsTUFBTSxLQUFLLEVBQUU7WUFDckIsSUFBSSxDQUFDLEVBQUUsWUFBWSxVQUFVLEVBQzdCO1lBRUEsT0FBTyxPQUFPLEtBQUssV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDaEQ7UUFFRCxJQUNFLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUN4RCxPQUFPLENBQUMsTUFBTSxLQUFLLEVBQUUsRUFDckI7WUFDQSxPQUFPLE9BQU8sQ0FBQyxXQUFXLEVBQUUsS0FBSyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7U0FDckQ7UUFFRCxJQUNFLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztZQUN4RCxPQUFPLENBQUMsTUFBTSxLQUFLLEVBQUUsRUFDckI7WUFDQSxNQUFNLGlCQUFpQixHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFdEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDM0IsSUFBSSxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUN2QyxPQUFPLEtBQUssQ0FBQztpQkFDZDthQUNGO1lBRUQsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUdELFlBQVk7UUFDVixNQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQzdCLE1BQU0sSUFBSSxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0QsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQzNDLE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFPRCxNQUFNLENBQUMsY0FBYyxDQUFDLElBQVk7UUFDaEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFcEUsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVyRCxPQUFPLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFPRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsU0FBaUI7UUFFMUMsSUFDRSxPQUFPLFNBQVMsS0FBSyxXQUFXO1lBQ2hDLENBQUMsU0FBUyxJQUFJLElBQUksSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLEVBQUUsQ0FBQyxFQUM5QztZQUNBLE1BQU0sSUFBSSxhQUFhLENBQ3JCLHlGQUF5RixDQUMxRixDQUFDO1NBQ0g7UUFFRCxPQUFPLElBQUksUUFBUSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFPRCxNQUFNLENBQUMsT0FBTyxDQUNaLEVBQTJDO1FBRTNDLElBQUksRUFBRSxJQUFJLElBQUk7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUU3QixJQUFJO1lBQ0YsSUFBSSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDakIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUFDLE1BQU07WUFDTixPQUFPLEtBQUssQ0FBQztTQUNkO0lBQ0gsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ2hDLE9BQU8saUJBQWlCLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDO0lBQ2pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWNvZGVIZXhTdHJpbmcsIGVuY29kZUhleFN0cmluZyB9IGZyb20gXCIuLi91dGlscy50c1wiO1xuaW1wb3J0IHsgQlNPTlR5cGVFcnJvciB9IGZyb20gXCIuL2Vycm9yLnRzXCI7XG5pbXBvcnQgeyByYW5kb21CeXRlcyB9IGZyb20gXCIuL3BhcnNlci91dGlscy50c1wiO1xuXG5jb25zdCB0ZXh0RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuY29uc3QgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuLy8gUmVndWxhciBleHByZXNzaW9uIHRoYXQgY2hlY2tzIGZvciBoZXggdmFsdWVcbmNvbnN0IGNoZWNrRm9ySGV4UmVnRXhwID0gbmV3IFJlZ0V4cChcIl5bMC05YS1mQS1GXXsyNH0kXCIpO1xuXG4vLyBVbmlxdWUgc2VxdWVuY2UgZm9yIHRoZSBjdXJyZW50IHByb2Nlc3MgKGluaXRpYWxpemVkIG9uIGZpcnN0IHVzZSlcbmxldCBQUk9DRVNTX1VOSVFVRTogVWludDhBcnJheSB8IG51bGwgPSBudWxsO1xuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBCU09OIE9iamVjdElkIHR5cGUuXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjbGFzcyBPYmplY3RJZCB7XG4gIHN0YXRpYyAjaW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAweGZmX2ZmX2ZmKTtcbiAgc3RhdGljIGNhY2hlSGV4U3RyaW5nOiBib29sZWFuO1xuXG4gIC8qKiBPYmplY3RJZCBoZXhTdHJpbmcgY2FjaGUgQGludGVybmFsICovXG4gICNpZD86IHN0cmluZztcbiAgI2J5dGVzQnVmZmVyOiBVaW50OEFycmF5O1xuICAvKipcbiAgICogQ3JlYXRlIGFuIE9iamVjdElkIHR5cGVcbiAgICpcbiAgICogQHBhcmFtIGlucHV0SWQgLSBDYW4gYmUgYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZywgMTIgYnl0ZSBiaW5hcnkgQnVmZmVyLCBvciBhIG51bWJlci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGlucHV0SWQ6IHN0cmluZyB8IG51bWJlciB8IE9iamVjdElkIHwgVWludDhBcnJheSA9IE9iamVjdElkXG4gICAgICAuZ2VuZXJhdGUoKSxcbiAgKSB7XG4gICAgLy8gd29ya2luZ0lkIGlzIHNldCBiYXNlZCBvbiB0eXBlIG9mIGlucHV0IGFuZCB3aGV0aGVyIHZhbGlkIGlkIGV4aXN0cyBmb3IgdGhlIGlucHV0XG4gICAgbGV0IHdvcmtpbmdJZDogVWludDhBcnJheSB8IHN0cmluZyB8IG51bWJlcjtcbiAgICBpZiAodHlwZW9mIGlucHV0SWQgPT09IFwib2JqZWN0XCIgJiYgaW5wdXRJZCAmJiBcImlkXCIgaW4gaW5wdXRJZCkge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dElkLmlkICE9PSBcInN0cmluZ1wiICYmICFBcnJheUJ1ZmZlci5pc1ZpZXcoaW5wdXRJZC5pZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgXCJBcmd1bWVudCBwYXNzZWQgaW4gbXVzdCBoYXZlIGFuIGlkIHRoYXQgaXMgb2YgdHlwZSBzdHJpbmcgb3IgQnVmZmVyXCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB3b3JraW5nSWQgPVxuICAgICAgICBcInRvSGV4U3RyaW5nXCIgaW4gaW5wdXRJZCAmJiB0eXBlb2YgaW5wdXRJZC50b0hleFN0cmluZyA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgICAgPyBkZWNvZGVIZXhTdHJpbmcoaW5wdXRJZC50b0hleFN0cmluZygpKVxuICAgICAgICAgIDogaW5wdXRJZC5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgd29ya2luZ0lkID0gaW5wdXRJZDtcbiAgICB9XG5cbiAgICAvLyB0aGUgZm9sbG93aW5nIGNhc2VzIHVzZSB3b3JraW5nSWQgdG8gY29uc3RydWN0IGFuIE9iamVjdElkXG4gICAgaWYgKHdvcmtpbmdJZCA9PSBudWxsIHx8IHR5cGVvZiB3b3JraW5nSWQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIC8vIFRoZSBtb3N0IGNvbW1vbiB1c2UgY2FzZSAoYmxhbmsgaWQsIG5ldyBvYmplY3RJZCBpbnN0YW5jZSlcbiAgICAgIC8vIEdlbmVyYXRlIGEgbmV3IGlkXG4gICAgICB0aGlzLiNieXRlc0J1ZmZlciA9IG5ldyBVaW50OEFycmF5KE9iamVjdElkLmdlbmVyYXRlKFxuICAgICAgICB0eXBlb2Ygd29ya2luZ0lkID09PSBcIm51bWJlclwiID8gd29ya2luZ0lkIDogdW5kZWZpbmVkLFxuICAgICAgKSk7XG4gICAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcod29ya2luZ0lkKSAmJiB3b3JraW5nSWQuYnl0ZUxlbmd0aCA9PT0gMTIpIHtcbiAgICAgIHRoaXMuI2J5dGVzQnVmZmVyID0gd29ya2luZ0lkO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHdvcmtpbmdJZCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgaWYgKHdvcmtpbmdJZC5sZW5ndGggPT09IDEyKSB7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gdGV4dEVuY29kZXIuZW5jb2RlKHdvcmtpbmdJZCk7XG4gICAgICAgIGlmIChieXRlcy5ieXRlTGVuZ3RoID09PSAxMikge1xuICAgICAgICAgIHRoaXMuI2J5dGVzQnVmZmVyID0gYnl0ZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgICBcIkFyZ3VtZW50IHBhc3NlZCBpbiBtdXN0IGJlIGEgc3RyaW5nIG9mIDEyIGJ5dGVzXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh3b3JraW5nSWQubGVuZ3RoID09PSAyNCAmJiBjaGVja0ZvckhleFJlZ0V4cC50ZXN0KHdvcmtpbmdJZCkpIHtcbiAgICAgICAgdGhpcy4jYnl0ZXNCdWZmZXIgPSBkZWNvZGVIZXhTdHJpbmcod29ya2luZ0lkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICAgIFwiQXJndW1lbnQgcGFzc2VkIGluIG11c3QgYmUgYSBzdHJpbmcgb2YgMTIgYnl0ZXMgb3IgYSBzdHJpbmcgb2YgMjQgaGV4IGNoYXJhY3RlcnNcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgIFwiQXJndW1lbnQgcGFzc2VkIGluIGRvZXMgbm90IG1hdGNoIHRoZSBhY2NlcHRlZCB0eXBlc1wiLFxuICAgICAgKTtcbiAgICB9XG4gICAgLy8gSWYgd2UgYXJlIGNhY2hpbmcgdGhlIGhleCBzdHJpbmdcbiAgICBpZiAoT2JqZWN0SWQuY2FjaGVIZXhTdHJpbmcpIHtcbiAgICAgIHRoaXMuI2lkID0gZW5jb2RlSGV4U3RyaW5nKHRoaXMuaWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgT2JqZWN0SWQgYnl0ZXNcbiAgICogQHJlYWRvbmx5XG4gICAqL1xuICBnZXQgaWQoKTogVWludDhBcnJheSB7XG4gICAgcmV0dXJuIHRoaXMuI2J5dGVzQnVmZmVyO1xuICB9XG5cbiAgc2V0IGlkKHZhbHVlOiBVaW50OEFycmF5KSB7XG4gICAgdGhpcy4jYnl0ZXNCdWZmZXIgPSB2YWx1ZTtcbiAgICBpZiAoT2JqZWN0SWQuY2FjaGVIZXhTdHJpbmcpIHtcbiAgICAgIHRoaXMuI2lkID0gZW5jb2RlSGV4U3RyaW5nKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICAvKiogUmV0dXJucyB0aGUgT2JqZWN0SWQgaWQgYXMgYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZyByZXByZXNlbnRhdGlvbiAqL1xuICB0b0hleFN0cmluZygpOiBzdHJpbmcge1xuICAgIGlmIChPYmplY3RJZC5jYWNoZUhleFN0cmluZyAmJiB0aGlzLiNpZCkge1xuICAgICAgcmV0dXJuIHRoaXMuI2lkO1xuICAgIH1cblxuICAgIGNvbnN0IGhleFN0cmluZyA9IGVuY29kZUhleFN0cmluZyh0aGlzLmlkKTtcblxuICAgIGlmIChPYmplY3RJZC5jYWNoZUhleFN0cmluZyAmJiAhdGhpcy4jaWQpIHtcbiAgICAgIHRoaXMuI2lkID0gaGV4U3RyaW5nO1xuICAgIH1cblxuICAgIHJldHVybiBoZXhTdHJpbmc7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSAxMiBieXRlIGlkIGJ1ZmZlciB1c2VkIGluIE9iamVjdElkJ3NcbiAgICpcbiAgICogQHBhcmFtIHRpbWUgLSBwYXNzIGluIGEgc2Vjb25kIGJhc2VkIHRpbWVzdGFtcC5cbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZSh0aW1lPzogbnVtYmVyKTogVWludDhBcnJheSB7XG4gICAgaWYgKFwibnVtYmVyXCIgIT09IHR5cGVvZiB0aW1lKSB7XG4gICAgICB0aW1lID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW5jID0gKHRoaXMuI2luZGV4ID0gKHRoaXMuI2luZGV4ICsgMSkgJSAweGZmX2ZmX2ZmKTtcbiAgICBjb25zdCBvYmplY3RJZCA9IG5ldyBVaW50OEFycmF5KDEyKTtcblxuICAgIC8vIDQtYnl0ZSB0aW1lc3RhbXBcbiAgICBuZXcgRGF0YVZpZXcob2JqZWN0SWQuYnVmZmVyLCAwLCA0KS5zZXRVaW50MzIoMCwgdGltZSk7XG5cbiAgICAvLyBzZXQgUFJPQ0VTU19VTklRVUUgaWYgeWV0IG5vdCBpbml0aWFsaXplZFxuICAgIGlmIChQUk9DRVNTX1VOSVFVRSA9PT0gbnVsbCkge1xuICAgICAgUFJPQ0VTU19VTklRVUUgPSByYW5kb21CeXRlcyg1KTtcbiAgICB9XG5cbiAgICAvLyA1LWJ5dGUgcHJvY2VzcyB1bmlxdWVcbiAgICBvYmplY3RJZFs0XSA9IFBST0NFU1NfVU5JUVVFWzBdO1xuICAgIG9iamVjdElkWzVdID0gUFJPQ0VTU19VTklRVUVbMV07XG4gICAgb2JqZWN0SWRbNl0gPSBQUk9DRVNTX1VOSVFVRVsyXTtcbiAgICBvYmplY3RJZFs3XSA9IFBST0NFU1NfVU5JUVVFWzNdO1xuICAgIG9iamVjdElkWzhdID0gUFJPQ0VTU19VTklRVUVbNF07XG5cbiAgICAvLyAzLWJ5dGUgY291bnRlclxuICAgIG9iamVjdElkWzExXSA9IGluYyAmIDB4ZmY7XG4gICAgb2JqZWN0SWRbMTBdID0gKGluYyA+PiA4KSAmIDB4ZmY7XG4gICAgb2JqZWN0SWRbOV0gPSAoaW5jID4+IDE2KSAmIDB4ZmY7XG5cbiAgICByZXR1cm4gb2JqZWN0SWQ7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdGhlIGlkIGludG8gYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZyBmb3IgcHJpbnRpbmdcbiAgICovXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMudG9IZXhTdHJpbmcoKTtcbiAgfVxuXG4gIC8qKiBDb252ZXJ0cyB0byBpdHMgSlNPTiB0aGUgMjQgY2hhcmFjdGVyIGhleCBzdHJpbmcgcmVwcmVzZW50YXRpb24uICovXG4gIHRvSlNPTigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnRvSGV4U3RyaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyZXMgdGhlIGVxdWFsaXR5IG9mIHRoaXMgT2JqZWN0SWQgd2l0aCBgb3RoZXJJRGAuXG4gICAqXG4gICAqIEBwYXJhbSBvdGhlcklkIC0gT2JqZWN0SWQgaW5zdGFuY2UgdG8gY29tcGFyZSBhZ2FpbnN0LlxuICAgKi9cbiAgZXF1YWxzKG90aGVySWQ6IHN0cmluZyB8IE9iamVjdElkKTogYm9vbGVhbiB7XG4gICAgaWYgKG90aGVySWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChvdGhlcklkIGluc3RhbmNlb2YgT2JqZWN0SWQpIHtcbiAgICAgIHJldHVybiB0aGlzLnRvU3RyaW5nKCkgPT09IG90aGVySWQudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2Ygb3RoZXJJZCA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDEyICYmXG4gICAgICB0aGlzLmlkIGluc3RhbmNlb2YgVWludDhBcnJheVxuICAgICkge1xuICAgICAgLy8gcmV0dXJuIG90aGVySWQgPT09IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0aGlzLmlkLCBcImxhdGluMVwiKTtcbiAgICAgIHJldHVybiBvdGhlcklkID09PSB0ZXh0RGVjb2Rlci5kZWNvZGUodGhpcy5pZCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG90aGVySWQgPT09IFwic3RyaW5nXCIgJiYgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDI0XG4gICAgKSB7XG4gICAgICByZXR1cm4gb3RoZXJJZC50b0xvd2VyQ2FzZSgpID09PSB0aGlzLnRvSGV4U3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG90aGVySWQgPT09IFwic3RyaW5nXCIgJiYgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDEyXG4gICAgKSB7XG4gICAgICBjb25zdCBvdGhlcklkVWludDhBcnJheSA9IHRleHRFbmNvZGVyLmVuY29kZShvdGhlcklkKTtcbiAgICAgIC8vIGNvbXBhcmUgdHdvIFVpbnQ4YXJyYXlzXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEyOyBpKyspIHtcbiAgICAgICAgaWYgKG90aGVySWRVaW50OEFycmF5W2ldICE9PSB0aGlzLmlkW2ldKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBnZW5lcmF0aW9uIGRhdGUgKGFjY3VyYXRlIHVwIHRvIHRoZSBzZWNvbmQpIHRoYXQgdGhpcyBJRCB3YXMgZ2VuZXJhdGVkLiAqL1xuICBnZXRUaW1lc3RhbXAoKTogRGF0ZSB7XG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB0aW1lID0gbmV3IERhdGFWaWV3KHRoaXMuaWQuYnVmZmVyLCAwLCA0KS5nZXRVaW50MzIoMCk7XG4gICAgdGltZXN0YW1wLnNldFRpbWUoTWF0aC5mbG9vcih0aW1lKSAqIDEwMDApO1xuICAgIHJldHVybiB0aW1lc3RhbXA7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBPYmplY3RJZCBmcm9tIGEgc2Vjb25kIGJhc2VkIG51bWJlciwgd2l0aCB0aGUgcmVzdCBvZiB0aGUgT2JqZWN0SWQgemVyb2VkIG91dC4gVXNlZCBmb3IgY29tcGFyaXNvbnMgb3Igc29ydGluZyB0aGUgT2JqZWN0SWQuXG4gICAqXG4gICAqIEBwYXJhbSB0aW1lIC0gYW4gaW50ZWdlciBudW1iZXIgcmVwcmVzZW50aW5nIGEgbnVtYmVyIG9mIHNlY29uZHMuXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRnJvbVRpbWUodGltZTogbnVtYmVyKTogT2JqZWN0SWQge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSk7XG4gICAgLy8gRW5jb2RlIHRpbWUgaW50byBmaXJzdCA0IGJ5dGVzXG4gICAgbmV3IERhdGFWaWV3KGJ1ZmZlci5idWZmZXIsIDAsIDQpLnNldFVpbnQzMigwLCB0aW1lKTtcbiAgICAvLyBSZXR1cm4gdGhlIG5ldyBvYmplY3RJZFxuICAgIHJldHVybiBuZXcgT2JqZWN0SWQoYnVmZmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIE9iamVjdElkIGZyb20gYSBoZXggc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIE9iamVjdElkLlxuICAgKlxuICAgKiBAcGFyYW0gaGV4U3RyaW5nIC0gY3JlYXRlIGEgT2JqZWN0SWQgZnJvbSBhIHBhc3NlZCBpbiAyNCBjaGFyYWN0ZXIgaGV4c3RyaW5nLlxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZUZyb21IZXhTdHJpbmcoaGV4U3RyaW5nOiBzdHJpbmcpOiBPYmplY3RJZCB7XG4gICAgLy8gVGhyb3cgYW4gZXJyb3IgaWYgaXQncyBub3QgYSB2YWxpZCBzZXR1cFxuICAgIGlmIChcbiAgICAgIHR5cGVvZiBoZXhTdHJpbmcgPT09IFwidW5kZWZpbmVkXCIgfHxcbiAgICAgIChoZXhTdHJpbmcgIT0gbnVsbCAmJiBoZXhTdHJpbmcubGVuZ3RoICE9PSAyNClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICBcIkFyZ3VtZW50IHBhc3NlZCBpbiBtdXN0IGJlIGEgc2luZ2xlIFN0cmluZyBvZiAxMiBieXRlcyBvciBhIHN0cmluZyBvZiAyNCBoZXggY2hhcmFjdGVyc1wiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IE9iamVjdElkKGRlY29kZUhleFN0cmluZyhoZXhTdHJpbmcpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBhIHZhbGlkIGJzb24gT2JqZWN0SWRcbiAgICpcbiAgICogQHBhcmFtIGlkIC0gT2JqZWN0SWQgaW5zdGFuY2UgdG8gdmFsaWRhdGUuXG4gICAqL1xuICBzdGF0aWMgaXNWYWxpZChcbiAgICBpZDogc3RyaW5nIHwgbnVtYmVyIHwgT2JqZWN0SWQgfCBVaW50OEFycmF5LFxuICApOiBib29sZWFuIHtcbiAgICBpZiAoaWQgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgdHJ5IHtcbiAgICAgIG5ldyBPYmplY3RJZChpZCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIkRlbm8uY3VzdG9tSW5zcGVjdFwiKV0oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYG5ldyBPYmplY3RJZChcIiR7dGhpcy50b0hleFN0cmluZygpfVwiKWA7XG4gIH1cbn1cbiJdfQ==