import { concat, contentType, copyBytes, Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { calculate } from "./etag.ts";
import { assert, DEFAULT_CHUNK_SIZE } from "./util.ts";
const ETAG_RE = /(?:W\/)?"[ !#-\x7E\x80-\xFF]+"/;
export async function ifRange(value, mtime, entity) {
    if (value) {
        const matches = value.match(ETAG_RE);
        if (matches) {
            const [match] = matches;
            if (await calculate(entity) === match) {
                return true;
            }
        }
        else {
            return new Date(value).getTime() >= mtime;
        }
    }
    return false;
}
export function parseRange(value, size) {
    const ranges = [];
    const [unit, rangesStr] = value.split("=");
    if (unit !== "bytes") {
        throw createHttpError(Status.RequestedRangeNotSatisfiable);
    }
    for (const range of rangesStr.split(/\s*,\s+/)) {
        const item = range.split("-");
        if (item.length !== 2) {
            throw createHttpError(Status.RequestedRangeNotSatisfiable);
        }
        const [startStr, endStr] = item;
        let start;
        let end;
        try {
            if (startStr === "") {
                start = size - parseInt(endStr, 10) - 1;
                end = size - 1;
            }
            else if (endStr === "") {
                start = parseInt(startStr, 10);
                end = size - 1;
            }
            else {
                start = parseInt(startStr, 10);
                end = parseInt(endStr, 10);
            }
        }
        catch {
            throw createHttpError();
        }
        if (start < 0 || start >= size || end < 0 || end >= size || start > end) {
            throw createHttpError(Status.RequestedRangeNotSatisfiable);
        }
        ranges.push({ start, end });
    }
    return ranges;
}
async function readRange(file, range) {
    let length = range.end - range.start + 1;
    assert(length);
    await file.seek(range.start, Deno.SeekMode.Start);
    const result = new Uint8Array(length);
    let off = 0;
    while (length) {
        const p = new Uint8Array(Math.min(length, DEFAULT_CHUNK_SIZE));
        const nread = await file.read(p);
        assert(nread !== null, "Unexpected EOF encountered when reading a range.");
        assert(nread > 0, "Unexpected read of 0 bytes while reading a range.");
        copyBytes(p, result, off);
        off += nread;
        length -= nread;
        assert(length >= 0, "Unexpected length remaining.");
    }
    return result;
}
const encoder = new TextEncoder();
export class MultiPartStream extends ReadableStream {
    #contentLength;
    #postscript;
    #preamble;
    constructor(file, type, ranges, size, boundary) {
        super({
            pull: async (controller) => {
                const range = ranges.shift();
                if (!range) {
                    controller.enqueue(this.#postscript);
                    controller.close();
                    if (!(file instanceof Uint8Array)) {
                        file.close();
                    }
                    return;
                }
                let bytes;
                if (file instanceof Uint8Array) {
                    bytes = file.subarray(range.start, range.end + 1);
                }
                else {
                    bytes = await readRange(file, range);
                }
                const rangeHeader = encoder.encode(`Content-Range: ${range.start}-${range.end}/${size}\n\n`);
                controller.enqueue(concat(this.#preamble, rangeHeader, bytes));
            },
        });
        const resolvedType = contentType(type);
        if (!resolvedType) {
            throw new TypeError(`Could not resolve media type for "${type}"`);
        }
        this.#preamble = encoder.encode(`\n--${boundary}\nContent-Type: ${resolvedType}\n`);
        this.#postscript = encoder.encode(`\n--${boundary}--\n`);
        this.#contentLength = ranges.reduce((prev, { start, end }) => {
            return prev + this.#preamble.length + String(start).length +
                String(end).length + String(size).length + 20 + (end - start);
        }, this.#postscript.length);
    }
    contentLength() {
        return this.#contentLength;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyYW5nZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUNqRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXRDLE9BQU8sRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFdkQsTUFBTSxPQUFPLEdBQUcsZ0NBQWdDLENBQUM7QUFVakQsTUFBTSxDQUFDLEtBQUssVUFBVSxPQUFPLENBQzNCLEtBQWEsRUFDYixLQUFhLEVBQ2IsTUFBNkI7SUFFN0IsSUFBSSxLQUFLLEVBQUU7UUFDVCxNQUFNLE9BQU8sR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JDLElBQUksT0FBTyxFQUFFO1lBQ1gsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztZQUN4QixJQUFJLE1BQU0sU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEtBQUssRUFBRTtnQkFDckMsT0FBTyxJQUFJLENBQUM7YUFDYjtTQUNGO2FBQU07WUFDTCxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sRUFBRSxJQUFJLEtBQUssQ0FBQztTQUMzQztLQUNGO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQsTUFBTSxVQUFVLFVBQVUsQ0FBQyxLQUFhLEVBQUUsSUFBWTtJQUNwRCxNQUFNLE1BQU0sR0FBZ0IsRUFBRSxDQUFDO0lBQy9CLE1BQU0sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMzQyxJQUFJLElBQUksS0FBSyxPQUFP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LE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLENBQUM7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNqQixNQUFNLElBQUksU0FBUyxDQUFDLHFDQUFxQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1NBQ25FO1FBQ0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUM3QixPQUFPLFFBQVEsbUJBQW1CLFlBQVksSUFBSSxDQUNuRCxDQUFDO1FBRUYsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sUUFBUSxNQUFNLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsY0FBYyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQ2pDLENBQUMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFVLEVBQUU7WUFDL0IsT0FBTyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU07Z0JBQ3hELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUM7UUFDbEUsQ0FBQyxFQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUN4QixDQUFDO0lBQ0osQ0FBQztJQUdELGFBQWE7UUFDWCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDN0IsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgb2FrIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgeyBjb25jYXQsIGNvbnRlbnRUeXBlLCBjb3B5Qnl0ZXMsIFN0YXR1cyB9IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB7IGNyZWF0ZUh0dHBFcnJvciB9IGZyb20gXCIuL2h0dHBFcnJvci50c1wiO1xuaW1wb3J0IHsgY2FsY3VsYXRlIH0gZnJvbSBcIi4vZXRhZy50c1wiO1xuaW1wb3J0IHR5cGUgeyBGaWxlSW5mbyB9IGZyb20gXCIuL2V0YWcudHNcIjtcbmltcG9ydCB7IGFzc2VydCwgREVGQVVMVF9DSFVOS19TSVpFIH0gZnJvbSBcIi4vdXRpbC50c1wiO1xuXG5jb25zdCBFVEFHX1JFID0gLyg/OldcXC8pP1wiWyAhIy1cXHg3RVxceDgwLVxceEZGXStcIi87XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnl0ZVJhbmdlIHtcbiAgc3RhcnQ6IG51bWJlcjtcbiAgZW5kOiBudW1iZXI7XG59XG5cbi8qKiBEZXRlcm1pbmUsIGJ5IHRoZSB2YWx1ZSBvZiBhbiBgSWYtUmFuZ2VgIGhlYWRlciwgaWYgYSBgUmFuZ2VgIGhlYWRlciBzaG91bGRcbiAqIGJlIGFwcGxpZWQgdG8gYSByZXF1ZXN0LCByZXR1cm5pbmcgYHRydWVgIGlmIGl0IHNob3VsZCBvciBvdGhlcndpc2VcbiAqIGBmYWxzZWAuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaWZSYW5nZShcbiAgdmFsdWU6IHN0cmluZyxcbiAgbXRpbWU6IG51bWJlcixcbiAgZW50aXR5OiBVaW50OEFycmF5IHwgRmlsZUluZm8sXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgaWYgKHZhbHVlKSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHZhbHVlLm1hdGNoKEVUQUdfUkUpO1xuICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICBjb25zdCBbbWF0Y2hdID0gbWF0Y2hlcztcbiAgICAgIGlmIChhd2FpdCBjYWxjdWxhdGUoZW50aXR5KSA9PT0gbWF0Y2gpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgRGF0ZSh2YWx1ZSkuZ2V0VGltZSgpID49IG10aW1lO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJhbmdlKHZhbHVlOiBzdHJpbmcsIHNpemU6IG51bWJlcik6IEJ5dGVSYW5nZVtdIHtcbiAgY29uc3QgcmFuZ2VzOiBCeXRlUmFuZ2VbXSA9IFtdO1xuICBjb25zdCBbdW5pdCwgcmFuZ2VzU3RyXSA9IHZhbHVlLnNwbGl0KFwiPVwiKTtcbiAgaWYgKHVuaXQgIT09IFwiYnl0ZXNcIikge1xuICAgIHRocm93IGNyZWF0ZUh0dHBFcnJvcihTdGF0dXMuUmVxdWVzdGVkUmFuZ2VOb3RTYXRpc2ZpYWJsZSk7XG4gIH1cbiAgZm9yIChjb25zdCByYW5nZSBvZiByYW5nZXNTdHIuc3BsaXQoL1xccyosXFxzKy8pKSB7XG4gICAgY29uc3QgaXRlbSA9IHJhbmdlLnNwbGl0KFwiLVwiKTtcbiAgICBpZiAoaXRlbS5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IGNyZWF0ZUh0dHBFcnJvcihTdGF0dXMuUmVxdWVzdGVkUmFuZ2VOb3RTYXRpc2ZpYWJsZSk7XG4gICAgfVxuICAgIGNvbnN0IFtzdGFydFN0ciwgZW5kU3RyXSA9IGl0ZW07XG4gICAgbGV0IHN0YXJ0OiBudW1iZXI7XG4gICAgbGV0IGVuZDogbnVtYmVyO1xuICAgIHRyeSB7XG4gICAgICBpZiAoc3RhcnRTdHIgPT09IFwiXCIpIHtcbiAgICAgICAgc3RhcnQgPSBzaXplIC0gcGFyc2VJbnQoZW5kU3RyLCAxMCkgLSAxO1xuICAgICAgICBlbmQgPSBzaXplIC0gMTtcbiAgICAgIH0gZWxzZSBpZiAoZW5kU3RyID09PSBcIlwiKSB7XG4gICAgICAgIHN0YXJ0ID0gcGFyc2VJbnQoc3RhcnRTdHIsIDEwKTtcbiAgICAgICAgZW5kID0gc2l6ZSAtIDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdGFydCA9IHBhcnNlSW50KHN0YXJ0U3RyLCAxMCk7XG4gICAgICAgIGVuZCA9IHBhcnNlSW50KGVuZFN0ciwgMTApO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgY3JlYXRlSHR0cEVycm9yKCk7XG4gICAgfVxuICAgIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gc2l6ZSB8fCBlbmQgPCAwIHx8IGVuZCA+PSBzaXplIHx8IHN0YXJ0ID4gZW5kKSB7XG4gICAgICB0aHJvdyBjcmVhdGVIdHRwRXJyb3IoU3RhdHVzLlJlcXVlc3RlZFJhbmdlTm90U2F0aXNmaWFibGUpO1xuICAgIH1cbiAgICByYW5nZXMucHVzaCh7IHN0YXJ0LCBlbmQgfSk7XG4gIH1cbiAgcmV0dXJuIHJhbmdlcztcbn1cblxuLyoqIEEgcmVhZGVyICAqL1xuYXN5bmMgZnVuY3Rpb24gcmVhZFJhbmdlKFxuICBmaWxlOiBEZW5vLlJlYWRlciAmIERlbm8uU2Vla2VyLFxuICByYW5nZTogQnl0ZVJhbmdlLFxuKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gIGxldCBsZW5ndGggPSByYW5nZS5lbmQgLSByYW5nZS5zdGFydCArIDE7XG4gIGFzc2VydChsZW5ndGgpO1xuICBhd2FpdCBmaWxlLnNlZWsocmFuZ2Uuc3RhcnQsIERlbm8uU2Vla01vZGUuU3RhcnQpO1xuICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuICBsZXQgb2ZmID0gMDtcbiAgd2hpbGUgKGxlbmd0aCkge1xuICAgIGNvbnN0IHAgPSBuZXcgVWludDhBcnJheShNYXRoLm1pbihsZW5ndGgsIERFRkFVTFRfQ0hVTktfU0laRSkpO1xuICAgIGNvbnN0IG5yZWFkID0gYXdhaXQgZmlsZS5yZWFkKHApO1xuICAgIGFzc2VydChucmVhZCAhPT0gbnVsbCwgXCJVbmV4cGVjdGVkIEVPRiBlbmNvdW50ZXJlZCB3aGVuIHJlYWRpbmcgYSByYW5nZS5cIik7XG4gICAgYXNzZXJ0KG5yZWFkID4gMCwgXCJVbmV4cGVjdGVkIHJlYWQgb2YgMCBieXRlcyB3aGlsZSByZWFkaW5nIGEgcmFuZ2UuXCIpO1xuICAgIGNvcHlCeXRlcyhwLCByZXN1bHQsIG9mZik7XG4gICAgb2ZmICs9IG5yZWFkO1xuICAgIGxlbmd0aCAtPSBucmVhZDtcbiAgICBhc3NlcnQobGVuZ3RoID49IDAsIFwiVW5leHBlY3RlZCBsZW5ndGggcmVtYWluaW5nLlwiKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5jb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG5cbi8qKiBBIGNsYXNzIHRoYXQgdGFrZXMgYSBmaWxlIChlaXRoZXIgYSBEZW5vLkZpbGUgb3IgVWludDhBcnJheSkgYW5kIGJ5dGVzXG4gKiBhbmQgc3RyZWFtcyB0aGUgcmFuZ2VzIGFzIGEgbXVsdGktcGFydCBlbmNvZGVkIEhUVFAgYm9keS4gKi9cbmV4cG9ydCBjbGFzcyBNdWx0aVBhcnRTdHJlYW0gZXh0ZW5kcyBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5PiB7XG4gICNjb250ZW50TGVuZ3RoOiBudW1iZXI7XG4gICNwb3N0c2NyaXB0OiBVaW50OEFycmF5O1xuICAjcHJlYW1ibGU6IFVpbnQ4QXJyYXk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgZmlsZTogKERlbm8uUmVhZGVyICYgRGVuby5TZWVrZXIgJiBEZW5vLkNsb3NlcikgfCBVaW50OEFycmF5LFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICByYW5nZXM6IEJ5dGVSYW5nZVtdLFxuICAgIHNpemU6IG51bWJlcixcbiAgICBib3VuZGFyeTogc3RyaW5nLFxuICApIHtcbiAgICBzdXBlcih7XG4gICAgICBwdWxsOiBhc3luYyAoY29udHJvbGxlcikgPT4ge1xuICAgICAgICBjb25zdCByYW5nZSA9IHJhbmdlcy5zaGlmdCgpO1xuICAgICAgICBpZiAoIXJhbmdlKSB7XG4gICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKHRoaXMuI3Bvc3RzY3JpcHQpO1xuICAgICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVWludDhBcnJheSkpIHtcbiAgICAgICAgICAgIGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBieXRlczogVWludDhBcnJheTtcbiAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgYnl0ZXMgPSBmaWxlLnN1YmFycmF5KHJhbmdlLnN0YXJ0LCByYW5nZS5lbmQgKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBieXRlcyA9IGF3YWl0IHJlYWRSYW5nZShmaWxlLCByYW5nZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmFuZ2VIZWFkZXIgPSBlbmNvZGVyLmVuY29kZShcbiAgICAgICAgICBgQ29udGVudC1SYW5nZTogJHtyYW5nZS5zdGFydH0tJHtyYW5nZS5lbmR9LyR7c2l6ZX1cXG5cXG5gLFxuICAgICAgICApO1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUoY29uY2F0KHRoaXMuI3ByZWFtYmxlLCByYW5nZUhlYWRlciwgYnl0ZXMpKTtcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNvbHZlZFR5cGUgPSBjb250ZW50VHlwZSh0eXBlKTtcbiAgICBpZiAoIXJlc29sdmVkVHlwZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgQ291bGQgbm90IHJlc29sdmUgbWVkaWEgdHlwZSBmb3IgXCIke3R5cGV9XCJgKTtcbiAgICB9XG4gICAgdGhpcy4jcHJlYW1ibGUgPSBlbmNvZGVyLmVuY29kZShcbiAgICAgIGBcXG4tLSR7Ym91bmRhcnl9XFxuQ29udGVudC1UeXBlOiAke3Jlc29sdmVkVHlwZX1cXG5gLFxuICAgICk7XG5cbiAgICB0aGlzLiNwb3N0c2NyaXB0ID0gZW5jb2Rlci5lbmNvZGUoYFxcbi0tJHtib3VuZGFyeX0tLVxcbmApO1xuICAgIHRoaXMuI2NvbnRlbnRMZW5ndGggPSByYW5nZXMucmVkdWNlKFxuICAgICAgKHByZXYsIHsgc3RhcnQsIGVuZCB9KTogbnVtYmVyID0+IHtcbiAgICAgICAgcmV0dXJuIHByZXYgKyB0aGlzLiNwcmVhbWJsZS5sZW5ndGggKyBTdHJpbmcoc3RhcnQpLmxlbmd0aCArXG4gICAgICAgICAgU3RyaW5nKGVuZCkubGVuZ3RoICsgU3RyaW5nKHNpemUpLmxlbmd0aCArIDIwICsgKGVuZCAtIHN0YXJ0KTtcbiAgICAgIH0sXG4gICAgICB0aGlzLiNwb3N0c2NyaXB0Lmxlbmd0aCxcbiAgICApO1xuICB9XG5cbiAgLyoqIFRoZSBjb250ZW50IGxlbmd0aCBvZiB0aGUgZW50aXJlIHN0cmVhbWVkIGJvZHkuICovXG4gIGNvbnRlbnRMZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NvbnRlbnRMZW5ndGg7XG4gIH1cbn1cbiJdfQ==