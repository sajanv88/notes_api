import { decodeHexString, encodeHexString } from "../utils.ts";
import { BSONTypeError } from "./error.ts";
const VALIDATION_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})$/i;
export const uuidValidateString = (str) => typeof str === "string" && VALIDATION_REGEX.test(str);
export const uuidHexStringToBuffer = (hexString) => {
    if (!uuidValidateString(hexString)) {
        throw new BSONTypeError('UUID string representations must be a 32 or 36 character hex string (dashes excluded/included). Format: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" or "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".');
    }
    const sanitizedHexString = hexString.replace(/-/g, "");
    return decodeHexString(sanitizedHexString);
};
const hexTable = new TextEncoder().encode("0123456789abcdef");
const textDecoder = new TextDecoder();
export const bufferToUuidHexString = (bytes, includeDashes = true) => {
    if (!includeDashes)
        return encodeHexString(bytes);
    const dst = new Uint8Array(36);
    let srcIndex = 0;
    let dstIndex = 0;
    while (srcIndex < bytes.length) {
        if (dstIndex === 8 || dstIndex === 13 || dstIndex === 18 || dstIndex === 23) {
            dst[dstIndex] = 45;
            dstIndex++;
            continue;
        }
        const v = bytes[srcIndex];
        dst[dstIndex] = hexTable[v >> 4];
        dst[dstIndex + 1] = hexTable[v & 0x0f];
        dstIndex += 2;
        srcIndex++;
    }
    return textDecoder.decode(dst);
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZF91dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV1aWRfdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGVBQWUsRUFBRSxlQUFlLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDL0QsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUczQyxNQUFNLGdCQUFnQixHQUNwQix1SEFBdUgsQ0FBQztBQUUxSCxNQUFNLENBQUMsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLEdBQVcsRUFBVyxFQUFFLENBQ3pELE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFFeEQsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxTQUFpQixFQUFjLEVBQUU7SUFDckUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQ2xDLE1BQU0sSUFBSSxhQUFhLENBQ3JCLHVMQUF1TCxDQUN4TCxDQUFDO0tBQ0g7SUFFRCxNQUFNLGtCQUFrQixHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELE9BQU8sZUFBZSxDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDN0MsQ0FBQyxDQUFDO0FBRUYsTUFBTSxRQUFRLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUM5RCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO0FBRXRDLE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFHLENBQ25DLEtBQWlCLEVBQ2pCLGFBQWEsR0FBRyxJQUFJLEVBQ1osRUFBRTtJQUNWLElBQUksQ0FBQyxhQUFhO1FBQUUsT0FBTyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEQsTUFBTSxHQUFHLEdBQUcsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0IsSUFBSSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0lBQ2pCLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNqQixPQUFPLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFO1FBQzlCLElBQ0UsUUFBUSxLQUFLLENBQUMsSUFBSSxRQUFRLEtBQUssRUFBRSxJQUFJLFFBQVEsS0FBSyxFQUFFLElBQUksUUFBUSxLQUFLLEVBQUUsRUFDdkU7WUFDQSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ25CLFFBQVEsRUFBRSxDQUFDO1lBQ1gsU0FBUztTQUNWO1FBQ0QsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLEdBQUcsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztRQUN2QyxRQUFRLElBQUksQ0FBQyxDQUFDO1FBQ2QsUUFBUSxFQUFFLENBQUM7S0FDWjtJQUNELE9BQU8sV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWNvZGVIZXhTdHJpbmcsIGVuY29kZUhleFN0cmluZyB9IGZyb20gXCIuLi91dGlscy50c1wiO1xuaW1wb3J0IHsgQlNPTlR5cGVFcnJvciB9IGZyb20gXCIuL2Vycm9yLnRzXCI7XG5cbi8vIFZhbGlkYXRpb24gcmVnZXggZm9yIHY0IHV1aWQgKHZhbGlkYXRlcyB3aXRoIG9yIHdpdGhvdXQgZGFzaGVzKVxuY29uc3QgVkFMSURBVElPTl9SRUdFWCA9XG4gIC9eKD86WzAtOWEtZl17OH0tWzAtOWEtZl17NH0tNFswLTlhLWZdezN9LVs4OWFiXVswLTlhLWZdezN9LVswLTlhLWZdezEyfXxbMC05YS1mXXsxMn00WzAtOWEtZl17M31bODlhYl1bMC05YS1mXXsxNX0pJC9pO1xuXG5leHBvcnQgY29uc3QgdXVpZFZhbGlkYXRlU3RyaW5nID0gKHN0cjogc3RyaW5nKTogYm9vbGVhbiA9PlxuICB0eXBlb2Ygc3RyID09PSBcInN0cmluZ1wiICYmIFZBTElEQVRJT05fUkVHRVgudGVzdChzdHIpO1xuXG5leHBvcnQgY29uc3QgdXVpZEhleFN0cmluZ1RvQnVmZmVyID0gKGhleFN0cmluZzogc3RyaW5nKTogVWludDhBcnJheSA9PiB7XG4gIGlmICghdXVpZFZhbGlkYXRlU3RyaW5nKGhleFN0cmluZykpIHtcbiAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgICdVVUlEIHN0cmluZyByZXByZXNlbnRhdGlvbnMgbXVzdCBiZSBhIDMyIG9yIDM2IGNoYXJhY3RlciBoZXggc3RyaW5nIChkYXNoZXMgZXhjbHVkZWQvaW5jbHVkZWQpLiBGb3JtYXQ6IFwieHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHhcIiBvciBcInh4eHh4eHh4LXh4eHgteHh4eC14eHh4LXh4eHh4eHh4eHh4eFwiLicsXG4gICAgKTtcbiAgfVxuXG4gIGNvbnN0IHNhbml0aXplZEhleFN0cmluZyA9IGhleFN0cmluZy5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICByZXR1cm4gZGVjb2RlSGV4U3RyaW5nKHNhbml0aXplZEhleFN0cmluZyk7XG59O1xuXG5jb25zdCBoZXhUYWJsZSA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIjAxMjM0NTY3ODlhYmNkZWZcIik7XG5jb25zdCB0ZXh0RGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuXG5leHBvcnQgY29uc3QgYnVmZmVyVG9VdWlkSGV4U3RyaW5nID0gKFxuICBieXRlczogVWludDhBcnJheSxcbiAgaW5jbHVkZURhc2hlcyA9IHRydWUsXG4pOiBzdHJpbmcgPT4ge1xuICBpZiAoIWluY2x1ZGVEYXNoZXMpIHJldHVybiBlbmNvZGVIZXhTdHJpbmcoYnl0ZXMpO1xuICBjb25zdCBkc3QgPSBuZXcgVWludDhBcnJheSgzNik7XG4gIGxldCBzcmNJbmRleCA9IDA7XG4gIGxldCBkc3RJbmRleCA9IDA7XG4gIHdoaWxlIChzcmNJbmRleCA8IGJ5dGVzLmxlbmd0aCkge1xuICAgIGlmIChcbiAgICAgIGRzdEluZGV4ID09PSA4IHx8IGRzdEluZGV4ID09PSAxMyB8fCBkc3RJbmRleCA9PT0gMTggfHwgZHN0SW5kZXggPT09IDIzXG4gICAgKSB7XG4gICAgICBkc3RbZHN0SW5kZXhdID0gNDU7XG4gICAgICBkc3RJbmRleCsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGNvbnN0IHYgPSBieXRlc1tzcmNJbmRleF07XG4gICAgZHN0W2RzdEluZGV4XSA9IGhleFRhYmxlW3YgPj4gNF07XG4gICAgZHN0W2RzdEluZGV4ICsgMV0gPSBoZXhUYWJsZVt2ICYgMHgwZl07XG4gICAgZHN0SW5kZXggKz0gMjtcbiAgICBzcmNJbmRleCsrO1xuICB9XG4gIHJldHVybiB0ZXh0RGVjb2Rlci5kZWNvZGUoZHN0KTtcbn07XG4iXX0=