import { decodeHexString, encodeHexString } from "../utils.ts";
import { BSONTypeError } from "./error.ts";
import { randomBytes } from "./parser/utils.ts";
import { equals } from "../deps.ts";
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
            return equals(this.#bytesBuffer, otherId.#bytesBuffer);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0aWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJvYmplY3RpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLGVBQWUsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMvRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFDdEMsTUFBTSxXQUFXLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUd0QyxNQUFNLGlCQUFpQixHQUFHLElBQUksTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUM7QUFHMUQsSUFBSSxjQUFjLEdBQXNCLElBQUksQ0FBQztBQUs3QyxNQUFNLE9BQU8sUUFBUTtJQUNuQixNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLFVBQVUsQ0FBQyxDQUFDO0lBQ3ZELE1BQU0sQ0FBQyxjQUFjLENBQVU7SUFHL0IsR0FBRyxDQUFVO0lBQ2IsWUFBWSxDQUFhO0lBTXpCLFlBQ0UsVUFBbUQsUUFBUTtTQUN4RCxRQUFRLEVBQUU7UUFHYixJQUFJLFNBQXVDLENBQUM7UUFDNUMsSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7WUFDN0QsSUFBSSxPQUFPLE9BQU8sQ0FBQyxFQUFFLEtBQUssUUFBUSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ3JFLE1BQU0sSUFBSSxhQUFhLENBQ3JCLHFFQUFxRSxDQUN0RSxDQUFDO2FBQ0g7WUFDRCxTQUFTO2dCQUNQLGFBQWEs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QUFlLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBT0QsTUFBTSxDQUFDLE9BQU8sQ0FDWixFQUEyQztRQUUzQyxJQUFJLEVBQUUsSUFBSSxJQUFJO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFN0IsSUFBSTtZQUNGLElBQUksUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2pCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFBQyxNQUFNO1lBQ04sT0FBTyxLQUFLLENBQUM7U0FDZDtJQUNILENBQUM7SUFFRCxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNoQyxPQUFPLGlCQUFpQixJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQztJQUNqRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZGVjb2RlSGV4U3RyaW5nLCBlbmNvZGVIZXhTdHJpbmcgfSBmcm9tIFwiLi4vdXRpbHMudHNcIjtcbmltcG9ydCB7IEJTT05UeXBlRXJyb3IgfSBmcm9tIFwiLi9lcnJvci50c1wiO1xuaW1wb3J0IHsgcmFuZG9tQnl0ZXMgfSBmcm9tIFwiLi9wYXJzZXIvdXRpbHMudHNcIjtcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gXCIuLi9kZXBzLnRzXCI7XG5jb25zdCB0ZXh0RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuY29uc3QgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoKTtcblxuLy8gUmVndWxhciBleHByZXNzaW9uIHRoYXQgY2hlY2tzIGZvciBoZXggdmFsdWVcbmNvbnN0IGNoZWNrRm9ySGV4UmVnRXhwID0gbmV3IFJlZ0V4cChcIl5bMC05YS1mQS1GXXsyNH0kXCIpO1xuXG4vLyBVbmlxdWUgc2VxdWVuY2UgZm9yIHRoZSBjdXJyZW50IHByb2Nlc3MgKGluaXRpYWxpemVkIG9uIGZpcnN0IHVzZSlcbmxldCBQUk9DRVNTX1VOSVFVRTogVWludDhBcnJheSB8IG51bGwgPSBudWxsO1xuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBCU09OIE9iamVjdElkIHR5cGUuXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjbGFzcyBPYmplY3RJZCB7XG4gIHN0YXRpYyAjaW5kZXggPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAweGZmX2ZmX2ZmKTtcbiAgc3RhdGljIGNhY2hlSGV4U3RyaW5nOiBib29sZWFuO1xuXG4gIC8qKiBPYmplY3RJZCBoZXhTdHJpbmcgY2FjaGUgQGludGVybmFsICovXG4gICNpZD86IHN0cmluZztcbiAgI2J5dGVzQnVmZmVyOiBVaW50OEFycmF5O1xuICAvKipcbiAgICogQ3JlYXRlIGFuIE9iamVjdElkIHR5cGVcbiAgICpcbiAgICogQHBhcmFtIGlucHV0SWQgLSBDYW4gYmUgYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZywgMTIgYnl0ZSBiaW5hcnkgQnVmZmVyLCBvciBhIG51bWJlci5cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGlucHV0SWQ6IHN0cmluZyB8IG51bWJlciB8IE9iamVjdElkIHwgVWludDhBcnJheSA9IE9iamVjdElkXG4gICAgICAuZ2VuZXJhdGUoKSxcbiAgKSB7XG4gICAgLy8gd29ya2luZ0lkIGlzIHNldCBiYXNlZCBvbiB0eXBlIG9mIGlucHV0IGFuZCB3aGV0aGVyIHZhbGlkIGlkIGV4aXN0cyBmb3IgdGhlIGlucHV0XG4gICAgbGV0IHdvcmtpbmdJZDogVWludDhBcnJheSB8IHN0cmluZyB8IG51bWJlcjtcbiAgICBpZiAodHlwZW9mIGlucHV0SWQgPT09IFwib2JqZWN0XCIgJiYgaW5wdXRJZCAmJiBcImlkXCIgaW4gaW5wdXRJZCkge1xuICAgICAgaWYgKHR5cGVvZiBpbnB1dElkLmlkICE9PSBcInN0cmluZ1wiICYmICFBcnJheUJ1ZmZlci5pc1ZpZXcoaW5wdXRJZC5pZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgXCJBcmd1bWVudCBwYXNzZWQgaW4gbXVzdCBoYXZlIGFuIGlkIHRoYXQgaXMgb2YgdHlwZSBzdHJpbmcgb3IgQnVmZmVyXCIsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB3b3JraW5nSWQgPVxuICAgICAgICBcInRvSGV4U3RyaW5nXCIgaW4gaW5wdXRJZCAmJiB0eXBlb2YgaW5wdXRJZC50b0hleFN0cmluZyA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgICAgPyBkZWNvZGVIZXhTdHJpbmcoaW5wdXRJZC50b0hleFN0cmluZygpKVxuICAgICAgICAgIDogaW5wdXRJZC5pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgd29ya2luZ0lkID0gaW5wdXRJZDtcbiAgICB9XG5cbiAgICAvLyB0aGUgZm9sbG93aW5nIGNhc2VzIHVzZSB3b3JraW5nSWQgdG8gY29uc3RydWN0IGFuIE9iamVjdElkXG4gICAgaWYgKHdvcmtpbmdJZCA9PSBudWxsIHx8IHR5cGVvZiB3b3JraW5nSWQgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgIC8vIFRoZSBtb3N0IGNvbW1vbiB1c2UgY2FzZSAoYmxhbmsgaWQsIG5ldyBvYmplY3RJZCBpbnN0YW5jZSlcbiAgICAgIC8vIEdlbmVyYXRlIGEgbmV3IGlkXG4gICAgICB0aGlzLiNieXRlc0J1ZmZlciA9IG5ldyBVaW50OEFycmF5KE9iamVjdElkLmdlbmVyYXRlKFxuICAgICAgICB0eXBlb2Ygd29ya2luZ0lkID09PSBcIm51bWJlclwiID8gd29ya2luZ0lkIDogdW5kZWZpbmVkLFxuICAgICAgKSk7XG4gICAgfSBlbHNlIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcod29ya2luZ0lkKSAmJiB3b3JraW5nSWQuYnl0ZUxlbmd0aCA9PT0gMTIpIHtcbiAgICAgIHRoaXMuI2J5dGVzQnVmZmVyID0gd29ya2luZ0lkO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHdvcmtpbmdJZCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgaWYgKHdvcmtpbmdJZC5sZW5ndGggPT09IDEyKSB7XG4gICAgICAgIGNvbnN0IGJ5dGVzID0gdGV4dEVuY29kZXIuZW5jb2RlKHdvcmtpbmdJZCk7XG4gICAgICAgIGlmIChieXRlcy5ieXRlTGVuZ3RoID09PSAxMikge1xuICAgICAgICAgIHRoaXMuI2J5dGVzQnVmZmVyID0gYnl0ZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgICBcIkFyZ3VtZW50IHBhc3NlZCBpbiBtdXN0IGJlIGEgc3RyaW5nIG9mIDEyIGJ5dGVzXCIsXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh3b3JraW5nSWQubGVuZ3RoID09PSAyNCAmJiBjaGVja0ZvckhleFJlZ0V4cC50ZXN0KHdvcmtpbmdJZCkpIHtcbiAgICAgICAgdGhpcy4jYnl0ZXNCdWZmZXIgPSBkZWNvZGVIZXhTdHJpbmcod29ya2luZ0lkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICAgIFwiQXJndW1lbnQgcGFzc2VkIGluIG11c3QgYmUgYSBzdHJpbmcgb2YgMTIgYnl0ZXMgb3IgYSBzdHJpbmcgb2YgMjQgaGV4IGNoYXJhY3RlcnNcIixcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgIFwiQXJndW1lbnQgcGFzc2VkIGluIGRvZXMgbm90IG1hdGNoIHRoZSBhY2NlcHRlZCB0eXBlc1wiLFxuICAgICAgKTtcbiAgICB9XG4gICAgLy8gSWYgd2UgYXJlIGNhY2hpbmcgdGhlIGhleCBzdHJpbmdcbiAgICBpZiAoT2JqZWN0SWQuY2FjaGVIZXhTdHJpbmcpIHtcbiAgICAgIHRoaXMuI2lkID0gZW5jb2RlSGV4U3RyaW5nKHRoaXMuaWQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgT2JqZWN0SWQgYnl0ZXNcbiAgICogQHJlYWRvbmx5XG4gICAqL1xuICBnZXQgaWQoKTogVWludDhBcnJheSB7XG4gICAgcmV0dXJuIHRoaXMuI2J5dGVzQnVmZmVyO1xuICB9XG5cbiAgc2V0IGlkKHZhbHVlOiBVaW50OEFycmF5KSB7XG4gICAgdGhpcy4jYnl0ZXNCdWZmZXIgPSB2YWx1ZTtcbiAgICBpZiAoT2JqZWN0SWQuY2FjaGVIZXhTdHJpbmcpIHtcbiAgICAgIHRoaXMuI2lkID0gZW5jb2RlSGV4U3RyaW5nKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICAvKiogUmV0dXJucyB0aGUgT2JqZWN0SWQgaWQgYXMgYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZyByZXByZXNlbnRhdGlvbiAqL1xuICB0b0hleFN0cmluZygpOiBzdHJpbmcge1xuICAgIGlmIChPYmplY3RJZC5jYWNoZUhleFN0cmluZyAmJiB0aGlzLiNpZCkge1xuICAgICAgcmV0dXJuIHRoaXMuI2lkO1xuICAgIH1cblxuICAgIGNvbnN0IGhleFN0cmluZyA9IGVuY29kZUhleFN0cmluZyh0aGlzLmlkKTtcblxuICAgIGlmIChPYmplY3RJZC5jYWNoZUhleFN0cmluZyAmJiAhdGhpcy4jaWQpIHtcbiAgICAgIHRoaXMuI2lkID0gaGV4U3RyaW5nO1xuICAgIH1cblxuICAgIHJldHVybiBoZXhTdHJpbmc7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGUgYSAxMiBieXRlIGlkIGJ1ZmZlciB1c2VkIGluIE9iamVjdElkJ3NcbiAgICpcbiAgICogQHBhcmFtIHRpbWUgLSBwYXNzIGluIGEgc2Vjb25kIGJhc2VkIHRpbWVzdGFtcC5cbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZSh0aW1lPzogbnVtYmVyKTogVWludDhBcnJheSB7XG4gICAgaWYgKFwibnVtYmVyXCIgIT09IHR5cGVvZiB0aW1lKSB7XG4gICAgICB0aW1lID0gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG4gICAgfVxuXG4gICAgY29uc3QgaW5jID0gKHRoaXMuI2luZGV4ID0gKHRoaXMuI2luZGV4ICsgMSkgJSAweGZmX2ZmX2ZmKTtcbiAgICBjb25zdCBvYmplY3RJZCA9IG5ldyBVaW50OEFycmF5KDEyKTtcblxuICAgIC8vIDQtYnl0ZSB0aW1lc3RhbXBcbiAgICBuZXcgRGF0YVZpZXcob2JqZWN0SWQuYnVmZmVyLCAwLCA0KS5zZXRVaW50MzIoMCwgdGltZSk7XG5cbiAgICAvLyBzZXQgUFJPQ0VTU19VTklRVUUgaWYgeWV0IG5vdCBpbml0aWFsaXplZFxuICAgIGlmIChQUk9DRVNTX1VOSVFVRSA9PT0gbnVsbCkge1xuICAgICAgUFJPQ0VTU19VTklRVUUgPSByYW5kb21CeXRlcyg1KTtcbiAgICB9XG5cbiAgICAvLyA1LWJ5dGUgcHJvY2VzcyB1bmlxdWVcbiAgICBvYmplY3RJZFs0XSA9IFBST0NFU1NfVU5JUVVFWzBdO1xuICAgIG9iamVjdElkWzVdID0gUFJPQ0VTU19VTklRVUVbMV07XG4gICAgb2JqZWN0SWRbNl0gPSBQUk9DRVNTX1VOSVFVRVsyXTtcbiAgICBvYmplY3RJZFs3XSA9IFBST0NFU1NfVU5JUVVFWzNdO1xuICAgIG9iamVjdElkWzhdID0gUFJPQ0VTU19VTklRVUVbNF07XG5cbiAgICAvLyAzLWJ5dGUgY291bnRlclxuICAgIG9iamVjdElkWzExXSA9IGluYyAmIDB4ZmY7XG4gICAgb2JqZWN0SWRbMTBdID0gKGluYyA+PiA4KSAmIDB4ZmY7XG4gICAgb2JqZWN0SWRbOV0gPSAoaW5jID4+IDE2KSAmIDB4ZmY7XG5cbiAgICByZXR1cm4gb2JqZWN0SWQ7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdGhlIGlkIGludG8gYSAyNCBjaGFyYWN0ZXIgaGV4IHN0cmluZyBmb3IgcHJpbnRpbmdcbiAgICovXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMudG9IZXhTdHJpbmcoKTtcbiAgfVxuXG4gIC8qKiBDb252ZXJ0cyB0byBpdHMgSlNPTiB0aGUgMjQgY2hhcmFjdGVyIGhleCBzdHJpbmcgcmVwcmVzZW50YXRpb24uICovXG4gIHRvSlNPTigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnRvSGV4U3RyaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyZXMgdGhlIGVxdWFsaXR5IG9mIHRoaXMgT2JqZWN0SWQgd2l0aCBgb3RoZXJJRGAuXG4gICAqXG4gICAqIEBwYXJhbSBvdGhlcklkIC0gT2JqZWN0SWQgaW5zdGFuY2UgdG8gY29tcGFyZSBhZ2FpbnN0LlxuICAgKi9cbiAgZXF1YWxzKG90aGVySWQ6IHN0cmluZyB8IE9iamVjdElkKTogYm9vbGVhbiB7XG4gICAgaWYgKG90aGVySWQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChvdGhlcklkIGluc3RhbmNlb2YgT2JqZWN0SWQpIHtcbiAgICAgIHJldHVybiBlcXVhbHModGhpcy4jYnl0ZXNCdWZmZXIsIG90aGVySWQuI2J5dGVzQnVmZmVyKTtcbiAgICB9XG5cbiAgICBpZiAoXG4gICAgICB0eXBlb2Ygb3RoZXJJZCA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDEyICYmXG4gICAgICB0aGlzLmlkIGluc3RhbmNlb2YgVWludDhBcnJheVxuICAgICkge1xuICAgICAgLy8gcmV0dXJuIG90aGVySWQgPT09IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0aGlzLmlkLCBcImxhdGluMVwiKTtcbiAgICAgIHJldHVybiBvdGhlcklkID09PSB0ZXh0RGVjb2Rlci5kZWNvZGUodGhpcy5pZCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG90aGVySWQgPT09IFwic3RyaW5nXCIgJiYgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDI0XG4gICAgKSB7XG4gICAgICByZXR1cm4gb3RoZXJJZC50b0xvd2VyQ2FzZSgpID09PSB0aGlzLnRvSGV4U3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKFxuICAgICAgdHlwZW9mIG90aGVySWQgPT09IFwic3RyaW5nXCIgJiYgT2JqZWN0SWQuaXNWYWxpZChvdGhlcklkKSAmJlxuICAgICAgb3RoZXJJZC5sZW5ndGggPT09IDEyXG4gICAgKSB7XG4gICAgICBjb25zdCBvdGhlcklkVWludDhBcnJheSA9IHRleHRFbmNvZGVyLmVuY29kZShvdGhlcklkKTtcbiAgICAgIC8vIGNvbXBhcmUgdHdvIFVpbnQ4YXJyYXlzXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEyOyBpKyspIHtcbiAgICAgICAgaWYgKG90aGVySWRVaW50OEFycmF5W2ldICE9PSB0aGlzLmlkW2ldKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIHRoZSBnZW5lcmF0aW9uIGRhdGUgKGFjY3VyYXRlIHVwIHRvIHRoZSBzZWNvbmQpIHRoYXQgdGhpcyBJRCB3YXMgZ2VuZXJhdGVkLiAqL1xuICBnZXRUaW1lc3RhbXAoKTogRGF0ZSB7XG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB0aW1lID0gbmV3IERhdGFWaWV3KHRoaXMuaWQuYnVmZmVyLCAwLCA0KS5nZXRVaW50MzIoMCk7XG4gICAgdGltZXN0YW1wLnNldFRpbWUoTWF0aC5mbG9vcih0aW1lKSAqIDEwMDApO1xuICAgIHJldHVybiB0aW1lc3RhbXA7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbiBPYmplY3RJZCBmcm9tIGEgc2Vjb25kIGJhc2VkIG51bWJlciwgd2l0aCB0aGUgcmVzdCBvZiB0aGUgT2JqZWN0SWQgemVyb2VkIG91dC4gVXNlZCBmb3IgY29tcGFyaXNvbnMgb3Igc29ydGluZyB0aGUgT2JqZWN0SWQuXG4gICAqXG4gICAqIEBwYXJhbSB0aW1lIC0gYW4gaW50ZWdlciBudW1iZXIgcmVwcmVzZW50aW5nIGEgbnVtYmVyIG9mIHNlY29uZHMuXG4gICAqL1xuICBzdGF0aWMgY3JlYXRlRnJvbVRpbWUodGltZTogbnVtYmVyKTogT2JqZWN0SWQge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSk7XG4gICAgLy8gRW5jb2RlIHRpbWUgaW50byBmaXJzdCA0IGJ5dGVzXG4gICAgbmV3IERhdGFWaWV3KGJ1ZmZlci5idWZmZXIsIDAsIDQpLnNldFVpbnQzMigwLCB0aW1lKTtcbiAgICAvLyBSZXR1cm4gdGhlIG5ldyBvYmplY3RJZFxuICAgIHJldHVybiBuZXcgT2JqZWN0SWQoYnVmZmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuIE9iamVjdElkIGZyb20gYSBoZXggc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIE9iamVjdElkLlxuICAgKlxuICAgKiBAcGFyYW0gaGV4U3RyaW5nIC0gY3JlYXRlIGEgT2JqZWN0SWQgZnJvbSBhIHBhc3NlZCBpbiAyNCBjaGFyYWN0ZXIgaGV4c3RyaW5nLlxuICAgKi9cbiAgc3RhdGljIGNyZWF0ZUZyb21IZXhTdHJpbmcoaGV4U3RyaW5nOiBzdHJpbmcpOiBPYmplY3RJZCB7XG4gICAgLy8gVGhyb3cgYW4gZXJyb3IgaWYgaXQncyBub3QgYSB2YWxpZCBzZXR1cFxuICAgIGlmIChcbiAgICAgIHR5cGVvZiBoZXhTdHJpbmcgPT09IFwidW5kZWZpbmVkXCIgfHxcbiAgICAgIChoZXhTdHJpbmcgIT0gbnVsbCAmJiBoZXhTdHJpbmcubGVuZ3RoICE9PSAyNClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICBcIkFyZ3VtZW50IHBhc3NlZCBpbiBtdXN0IGJlIGEgc2luZ2xlIFN0cmluZyBvZiAxMiBieXRlcyBvciBhIHN0cmluZyBvZiAyNCBoZXggY2hhcmFjdGVyc1wiLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IE9iamVjdElkKGRlY29kZUhleFN0cmluZyhoZXhTdHJpbmcpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBhIHZhbGlkIGJzb24gT2JqZWN0SWRcbiAgICpcbiAgICogQHBhcmFtIGlkIC0gT2JqZWN0SWQgaW5zdGFuY2UgdG8gdmFsaWRhdGUuXG4gICAqL1xuICBzdGF0aWMgaXNWYWxpZChcbiAgICBpZDogc3RyaW5nIHwgbnVtYmVyIHwgT2JqZWN0SWQgfCBVaW50OEFycmF5LFxuICApOiBib29sZWFuIHtcbiAgICBpZiAoaWQgPT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgdHJ5IHtcbiAgICAgIG5ldyBPYmplY3RJZChpZCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIkRlbm8uY3VzdG9tSW5zcGVjdFwiKV0oKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYG5ldyBPYmplY3RJZChcIiR7dGhpcy50b0hleFN0cmluZygpfVwiKWA7XG4gIH1cbn1cbiJdfQ==