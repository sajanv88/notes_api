import { Buffer } from "../io/buffer.ts";
const DEFAULT_CHUNK_SIZE = 16_640;
const DEFAULT_BUFFER_SIZE = 32 * 1024;
function isCloser(value) {
    return typeof value === "object" && value != null && "close" in value &&
        typeof value["close"] === "function";
}
export function readerFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ??
        iterable[Symbol.iterator]?.();
    const buffer = new Buffer();
    return {
        async read(p) {
            if (buffer.length == 0) {
                const result = await iterator.next();
                if (result.done) {
                    return null;
                }
                else {
                    if (result.value.byteLength <= p.byteLength) {
                        p.set(result.value);
                        return result.value.byteLength;
                    }
                    p.set(result.value.subarray(0, p.byteLength));
                    await writeAll(buffer, result.value.subarray(p.byteLength));
                    return p.byteLength;
                }
            }
            else {
                const n = await buffer.read(p);
                if (n == null) {
                    return this.read(p);
                }
                return n;
            }
        },
    };
}
export function writerFromStreamWriter(streamWriter) {
    return {
        async write(p) {
            await streamWriter.ready;
            await streamWriter.write(p);
            return p.length;
        },
    };
}
export function readerFromStreamReader(streamReader) {
    const buffer = new Buffer();
    return {
        async read(p) {
            if (buffer.empty()) {
                const res = await streamReader.read();
                if (res.done) {
                    return null;
                }
                await writeAll(buffer, res.value);
            }
            return buffer.read(p);
        },
    };
}
export function writableStreamFromWriter(writer, options = {}) {
    const { autoClose = true } = options;
    return new WritableStream({
        async write(chunk, controller) {
            try {
                await writeAll(writer, chunk);
            }
            catch (e) {
                controller.error(e);
                if (isCloser(writer) && autoClose) {
                    writer.close();
                }
            }
        },
        close() {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        },
        abort() {
            if (isCloser(writer) && autoClose) {
                writer.close();
            }
        },
    });
}
export function readableStreamFromIterable(iterable) {
    const iterator = iterable[Symbol.asyncIterator]?.() ??
        iterable[Symbol.iterator]?.();
    return new ReadableStream({
        async pull(controller) {
            const { value, done } = await iterator.next();
            if (done) {
                controller.close();
            }
            else {
                controller.enqueue(value);
            }
        },
        async cancel(reason) {
            if (typeof iterator.throw == "function") {
                try {
                    await iterator.throw(reason);
                }
                catch { }
            }
        },
    });
}
export function readableStreamFromReader(reader, options = {}) {
    const { autoClose = true, chunkSize = DEFAULT_CHUNK_SIZE, strategy, } = options;
    return new ReadableStream({
        async pull(controller) {
            const chunk = new Uint8Array(chunkSize);
            try {
                const read = await reader.read(chunk);
                if (read === null) {
                    if (isCloser(reader) && autoClose) {
                        reader.close();
                    }
                    controller.close();
                    return;
                }
                controller.enqueue(chunk.subarray(0, read));
            }
            catch (e) {
                controller.error(e);
                if (isCloser(reader)) {
                    reader.close();
                }
            }
        },
        cancel() {
            if (isCloser(reader) && autoClose) {
                reader.close();
            }
        },
    }, strategy);
}
export async function readAll(r) {
    const buf = new Buffer();
    await buf.readFrom(r);
    return buf.bytes();
}
export function readAllSync(r) {
    const buf = new Buffer();
    buf.readFromSync(r);
    return buf.bytes();
}
export async function writeAll(w, arr) {
    let nwritten = 0;
    while (nwritten < arr.length) {
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
export function writeAllSync(w, arr) {
    let nwritten = 0;
    while (nwritten < arr.length) {
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
export async function* iterateReader(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while (true) {
        const result = await r.read(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
export function* iterateReaderSync(r, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while (true) {
        const result = r.readSync(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
export async function copy(src, dst, options) {
    let n = 0;
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    let gotEOF = false;
    while (gotEOF === false) {
        const result = await src.read(b);
        if (result === null) {
            gotEOF = true;
        }
        else {
            let nwritten = 0;
            while (nwritten < result) {
                nwritten += await dst.write(b.subarray(nwritten, result));
            }
            n += nwritten;
        }
    }
    return n;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVyc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnZlcnNpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRXpDLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFDO0FBQ2xDLE1BQU0sbUJBQW1CLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztBQUV0QyxTQUFTLFFBQVEsQ0FBQyxLQUFjO0lBQzlCLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUs7UUFFbkUsT0FBUSxLQUE2QixDQUFDLE9BQU8sQ0FBQyxLQUFLLFVBQVUsQ0FBQztBQUNsRSxDQUFDO0FBa0JELE1BQU0sVUFBVSxrQkFBa0IsQ0FDaEMsUUFBMEQ7SUFFMUQsTUFBTSxRQUFRLEdBQ1gsUUFBc0MsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUUsRUFBRTtRQUM5RCxRQUFpQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7SUFDNUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLEVBQUUsQ0FBQztJQUM1QixPQUFPO1FBQ0wsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFhO1lBQ3RCLElBQUksTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7Z0JBQ3RCLE1BQU0sTUFBTSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNyQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUU7b0JBQ2YsT0FBTyxJQUFJLENBQUM7aUJBQ2I7cUJBQU07b0JBQ0wsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUMsVUFBVSxFQUFFO3dCQUMzQyxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzt3QkFDcEIsT0FBTyxNQUFNLENBQUMs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Q0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3QixJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7WUFDbkIsTUFBTTtTQUNQO1FBRUQsTUFBTSxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztLQUM3QjtBQUNILENBQUM7QUFtQkQsTUFBTSxDQUFDLEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQWdCLEVBQ2hCLEdBQWdCLEVBQ2hCLE9BRUM7SUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDVixNQUFNLE9BQU8sR0FBRyxPQUFPLEVBQUUsT0FBTyxJQUFJLG1CQUFtQixDQUFDO0lBQ3hELE1BQU0sQ0FBQyxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2xDLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQztJQUNuQixPQUFPLE1BQU0sS0FBSyxLQUFLLEVBQUU7UUFDdkIsTUFBTSxNQUFNLEdBQUcsTUFBTSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLElBQUksTUFBTSxLQUFLLElBQUksRUFBRTtZQUNuQixNQUFNLEdBQUcsSUFBSSxDQUFDO1NBQ2Y7YUFBTTtZQUNMLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQztZQUNqQixPQUFPLFFBQVEsR0FBRyxNQUFNLEVBQUU7Z0JBQ3hCLFFBQVEsSUFBSSxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUMzRDtZQUNELENBQUMsSUFBSSxRQUFRLENBQUM7U0FDZjtLQUNGO0lBQ0QsT0FBTyxDQUFDLENBQUM7QUFDWCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuXG5jb25zdCBERUZBVUxUX0NIVU5LX1NJWkUgPSAxNl82NDA7XG5jb25zdCBERUZBVUxUX0JVRkZFUl9TSVpFID0gMzIgKiAxMDI0O1xuXG5mdW5jdGlvbiBpc0Nsb3Nlcih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIERlbm8uQ2xvc2VyIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSAhPSBudWxsICYmIFwiY2xvc2VcIiBpbiB2YWx1ZSAmJlxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgdHlwZW9mICh2YWx1ZSBhcyBSZWNvcmQ8c3RyaW5nLCBhbnk+KVtcImNsb3NlXCJdID09PSBcImZ1bmN0aW9uXCI7XG59XG5cbi8qKiBDcmVhdGUgYSBgRGVuby5SZWFkZXJgIGZyb20gYW4gaXRlcmFibGUgb2YgYFVpbnQ4QXJyYXlgcy5cbiAqXG4gKiBgYGB0c1xuICogICAgICBpbXBvcnQgeyByZWFkZXJGcm9tSXRlcmFibGUgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogICAgICBjb25zdCBmaWxlID0gYXdhaXQgRGVuby5vcGVuKFwibWV0cmljcy50eHRcIiwgeyB3cml0ZTogdHJ1ZSB9KTtcbiAqICAgICAgY29uc3QgcmVhZGVyID0gcmVhZGVyRnJvbUl0ZXJhYmxlKChhc3luYyBmdW5jdGlvbiogKCkge1xuICogICAgICAgIHdoaWxlICh0cnVlKSB7XG4gKiAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocikgPT4gc2V0VGltZW91dChyLCAxMDAwKSk7XG4gKiAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYGRhdGE6ICR7SlNPTi5zdHJpbmdpZnkoRGVuby5tZXRyaWNzKCkpfVxcblxcbmA7XG4gKiAgICAgICAgICB5aWVsZCBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUobWVzc2FnZSk7XG4gKiAgICAgICAgfVxuICogICAgICB9KSgpKTtcbiAqICAgICAgYXdhaXQgRGVuby5jb3B5KHJlYWRlciwgZmlsZSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRlckZyb21JdGVyYWJsZShcbiAgaXRlcmFibGU6IEl0ZXJhYmxlPFVpbnQ4QXJyYXk+IHwgQXN5bmNJdGVyYWJsZTxVaW50OEFycmF5Pixcbik6IERlbm8uUmVhZGVyIHtcbiAgY29uc3QgaXRlcmF0b3I6IEl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHwgQXN5bmNJdGVyYXRvcjxVaW50OEFycmF5PiA9XG4gICAgKGl0ZXJhYmxlIGFzIEFzeW5jSXRlcmFibGU8VWludDhBcnJheT4pW1N5bWJvbC5hc3luY0l0ZXJhdG9yXT8uKCkgPz9cbiAgICAgIChpdGVyYWJsZSBhcyBJdGVyYWJsZTxVaW50OEFycmF5PilbU3ltYm9sLml0ZXJhdG9yXT8uKCk7XG4gIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoKTtcbiAgcmV0dXJuIHtcbiAgICBhc3luYyByZWFkKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICAgIGlmIChidWZmZXIubGVuZ3RoID09IDApIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgaXRlcmF0b3IubmV4dCgpO1xuICAgICAgICBpZiAocmVzdWx0LmRvbmUpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAocmVzdWx0LnZhbHVlLmJ5dGVMZW5ndGggPD0gcC5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICBwLnNldChyZXN1bHQudmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZS5ieXRlTGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwLnNldChyZXN1bHQudmFsdWUuc3ViYXJyYXkoMCwgcC5ieXRlTGVuZ3RoKSk7XG4gICAgICAgICAgYXdhaXQgd3JpdGVBbGwoYnVmZmVyLCByZXN1bHQudmFsdWUuc3ViYXJyYXkocC5ieXRlTGVuZ3RoKSk7XG4gICAgICAgICAgcmV0dXJuIHAuYnl0ZUxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbiA9IGF3YWl0IGJ1ZmZlci5yZWFkKHApO1xuICAgICAgICBpZiAobiA9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVhZChwKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuXG4vKiogQ3JlYXRlIGEgYFdyaXRlcmAgZnJvbSBhIGBXcml0YWJsZVN0cmVhbURlZmF1bHRXcml0ZXJgLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlckZyb21TdHJlYW1Xcml0ZXIoXG4gIHN0cmVhbVdyaXRlcjogV3JpdGFibGVTdHJlYW1EZWZhdWx0V3JpdGVyPFVpbnQ4QXJyYXk+LFxuKTogRGVuby5Xcml0ZXIge1xuICByZXR1cm4ge1xuICAgIGFzeW5jIHdyaXRlKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgICAgYXdhaXQgc3RyZWFtV3JpdGVyLnJlYWR5O1xuICAgICAgYXdhaXQgc3RyZWFtV3JpdGVyLndyaXRlKHApO1xuICAgICAgcmV0dXJuIHAubGVuZ3RoO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKiBDcmVhdGUgYSBgUmVhZGVyYCBmcm9tIGEgYFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlcmAuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGVyRnJvbVN0cmVhbVJlYWRlcihcbiAgc3RyZWFtUmVhZGVyOiBSZWFkYWJsZVN0cmVhbURlZmF1bHRSZWFkZXI8VWludDhBcnJheT4sXG4pOiBEZW5vLlJlYWRlciB7XG4gIGNvbnN0IGJ1ZmZlciA9IG5ldyBCdWZmZXIoKTtcblxuICByZXR1cm4ge1xuICAgIGFzeW5jIHJlYWQocDogVWludDhBcnJheSk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgaWYgKGJ1ZmZlci5lbXB0eSgpKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHN0cmVhbVJlYWRlci5yZWFkKCk7XG4gICAgICAgIGlmIChyZXMuZG9uZSkge1xuICAgICAgICAgIHJldHVybiBudWxsOyAvLyBFT0ZcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IHdyaXRlQWxsKGJ1ZmZlciwgcmVzLnZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGJ1ZmZlci5yZWFkKHApO1xuICAgIH0sXG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgV3JpdGFibGVTdHJlYW1Gcm9tV3JpdGVyT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBJZiB0aGUgYHdyaXRlcmAgaXMgYWxzbyBhIGBEZW5vLkNsb3NlcmAsIGF1dG9tYXRpY2FsbHkgY2xvc2UgdGhlIGB3cml0ZXJgXG4gICAqIHdoZW4gdGhlIHN0cmVhbSBpcyBjbG9zZWQsIGFib3J0ZWQsIG9yIGEgd3JpdGUgZXJyb3Igb2NjdXJzLlxuICAgKlxuICAgKiBEZWZhdWx0cyB0byBgdHJ1ZWAuICovXG4gIGF1dG9DbG9zZT86IGJvb2xlYW47XG59XG5cbi8qKiBDcmVhdGUgYSBgV3JpdGFibGVTdHJlYW1gIGZyb20gYSBgV3JpdGVyYC4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3cml0YWJsZVN0cmVhbUZyb21Xcml0ZXIoXG4gIHdyaXRlcjogRGVuby5Xcml0ZXIsXG4gIG9wdGlvbnM6IFdyaXRhYmxlU3RyZWFtRnJvbVdyaXRlck9wdGlvbnMgPSB7fSxcbik6IFdyaXRhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgeyBhdXRvQ2xvc2UgPSB0cnVlIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiBuZXcgV3JpdGFibGVTdHJlYW0oe1xuICAgIGFzeW5jIHdyaXRlKGNodW5rLCBjb250cm9sbGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB3cml0ZUFsbCh3cml0ZXIsIGNodW5rKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29udHJvbGxlci5lcnJvcihlKTtcbiAgICAgICAgaWYgKGlzQ2xvc2VyKHdyaXRlcikgJiYgYXV0b0Nsb3NlKSB7XG4gICAgICAgICAgd3JpdGVyLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNsb3NlKCkge1xuICAgICAgaWYgKGlzQ2xvc2VyKHdyaXRlcikgJiYgYXV0b0Nsb3NlKSB7XG4gICAgICAgIHdyaXRlci5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgYWJvcnQoKSB7XG4gICAgICBpZiAoaXNDbG9zZXIod3JpdGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgd3JpdGVyLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfSxcbiAgfSk7XG59XG5cbi8qKiBDcmVhdGUgYSBgUmVhZGFibGVTdHJlYW1gIGZyb20gYW55IGtpbmQgb2YgaXRlcmFibGUuXG4gKlxuICogYGBgdHNcbiAqICAgICAgaW1wb3J0IHsgcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogICAgICBjb25zdCByMSA9IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlKFtcImZvbywgYmFyLCBiYXpcIl0pO1xuICogICAgICBjb25zdCByMiA9IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlKGFzeW5jIGZ1bmN0aW9uKiAoKSB7XG4gKiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UoKChyKSA9PiBzZXRUaW1lb3V0KHIsIDEwMDApKSk7XG4gKiAgICAgICAgeWllbGQgXCJmb29cIjtcbiAqICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZSgoKHIpID0+IHNldFRpbWVvdXQociwgMTAwMCkpKTtcbiAqICAgICAgICB5aWVsZCBcImJhclwiO1xuICogICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKCgocikgPT4gc2V0VGltZW91dChyLCAxMDAwKSkpO1xuICogICAgICAgIHlpZWxkIFwiYmF6XCI7XG4gKiAgICAgIH0oKSk7XG4gKiBgYGBcbiAqXG4gKiBJZiB0aGUgcHJvZHVjZWQgaXRlcmF0b3IgKGBpdGVyYWJsZVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKWAgb3JcbiAqIGBpdGVyYWJsZVtTeW1ib2wuaXRlcmF0b3JdKClgKSBpcyBhIGdlbmVyYXRvciwgb3IgbW9yZSBzcGVjaWZpY2FsbHkgaXMgZm91bmRcbiAqIHRvIGhhdmUgYSBgLnRocm93KClgIG1ldGhvZCBvbiBpdCwgdGhhdCB3aWxsIGJlIGNhbGxlZCB1cG9uXG4gKiBgcmVhZGFibGVTdHJlYW0uY2FuY2VsKClgLiBUaGlzIGlzIHRoZSBjYXNlIGZvciB0aGUgc2Vjb25kIGlucHV0IHR5cGUgYWJvdmU6XG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuICpcbiAqIGNvbnN0IHIzID0gcmVhZGFibGVTdHJlYW1Gcm9tSXRlcmFibGUoYXN5bmMgZnVuY3Rpb24qICgpIHtcbiAqICAgdHJ5IHtcbiAqICAgICB5aWVsZCBcImZvb1wiO1xuICogICB9IGNhdGNoIChlcnJvcikge1xuICogICAgIGNvbnNvbGUubG9nKGVycm9yKTsgLy8gRXJyb3I6IENhbmNlbGxlZCBieSBjb25zdW1lci5cbiAqICAgfVxuICogfSgpKTtcbiAqIGNvbnN0IHJlYWRlciA9IHIzLmdldFJlYWRlcigpO1xuICogY29uc29sZS5sb2coYXdhaXQgcmVhZGVyLnJlYWQoKSk7IC8vIHsgdmFsdWU6IFwiZm9vXCIsIGRvbmU6IGZhbHNlIH1cbiAqIGF3YWl0IHJlYWRlci5jYW5jZWwobmV3IEVycm9yKFwiQ2FuY2VsbGVkIGJ5IGNvbnN1bWVyLlwiKSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRhYmxlU3RyZWFtRnJvbUl0ZXJhYmxlPFQ+KFxuICBpdGVyYWJsZTogSXRlcmFibGU8VD4gfCBBc3luY0l0ZXJhYmxlPFQ+LFxuKTogUmVhZGFibGVTdHJlYW08VD4ge1xuICBjb25zdCBpdGVyYXRvcjogSXRlcmF0b3I8VD4gfCBBc3luY0l0ZXJhdG9yPFQ+ID1cbiAgICAoaXRlcmFibGUgYXMgQXN5bmNJdGVyYWJsZTxUPilbU3ltYm9sLmFzeW5jSXRlcmF0b3JdPy4oKSA/P1xuICAgICAgKGl0ZXJhYmxlIGFzIEl0ZXJhYmxlPFQ+KVtTeW1ib2wuaXRlcmF0b3JdPy4oKTtcbiAgcmV0dXJuIG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgYXN5bmMgcHVsbChjb250cm9sbGVyKSB7XG4gICAgICBjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBpZiAoZG9uZSkge1xuICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb250cm9sbGVyLmVucXVldWUodmFsdWUpO1xuICAgICAgfVxuICAgIH0sXG4gICAgYXN5bmMgY2FuY2VsKHJlYXNvbikge1xuICAgICAgaWYgKHR5cGVvZiBpdGVyYXRvci50aHJvdyA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBpdGVyYXRvci50aHJvdyhyZWFzb24pO1xuICAgICAgICB9IGNhdGNoIHsgLyogYGl0ZXJhdG9yLnRocm93KClgIGFsd2F5cyB0aHJvd3Mgb24gc2l0ZS4gV2UgY2F0Y2ggaXQuICovIH1cbiAgICAgIH1cbiAgICB9LFxuICB9KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWFkYWJsZVN0cmVhbUZyb21SZWFkZXJPcHRpb25zIHtcbiAgLyoqIElmIHRoZSBgcmVhZGVyYCBpcyBhbHNvIGEgYERlbm8uQ2xvc2VyYCwgYXV0b21hdGljYWxseSBjbG9zZSB0aGUgYHJlYWRlcmBcbiAgICogd2hlbiBgRU9GYCBpcyBlbmNvdW50ZXJlZCwgb3IgYSByZWFkIGVycm9yIG9jY3Vycy5cbiAgICpcbiAgICogRGVmYXVsdHMgdG8gYHRydWVgLiAqL1xuICBhdXRvQ2xvc2U/OiBib29sZWFuO1xuXG4gIC8qKiBUaGUgc2l6ZSBvZiBjaHVua3MgdG8gYWxsb2NhdGUgdG8gcmVhZCwgdGhlIGRlZmF1bHQgaXMgfjE2S2lCLCB3aGljaCBpc1xuICAgKiB0aGUgbWF4aW11bSBzaXplIHRoYXQgRGVubyBvcGVyYXRpb25zIGNhbiBjdXJyZW50bHkgc3VwcG9ydC4gKi9cbiAgY2h1bmtTaXplPzogbnVtYmVyO1xuXG4gIC8qKiBUaGUgcXVldWluZyBzdHJhdGVneSB0byBjcmVhdGUgdGhlIGBSZWFkYWJsZVN0cmVhbWAgd2l0aC4gKi9cbiAgc3RyYXRlZ3k/OiB7IGhpZ2hXYXRlck1hcms/OiBudW1iZXIgfCB1bmRlZmluZWQ7IHNpemU/OiB1bmRlZmluZWQgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBgUmVhZGFibGVTdHJlYW08VWludDhBcnJheT5gIGZyb20gZnJvbSBhIGBEZW5vLlJlYWRlcmAuXG4gKlxuICogV2hlbiB0aGUgcHVsbCBhbGdvcml0aG0gaXMgY2FsbGVkIG9uIHRoZSBzdHJlYW0sIGEgY2h1bmsgZnJvbSB0aGUgcmVhZGVyXG4gKiB3aWxsIGJlIHJlYWQuICBXaGVuIGBudWxsYCBpcyByZXR1cm5lZCBmcm9tIHRoZSByZWFkZXIsIHRoZSBzdHJlYW0gd2lsbCBiZVxuICogY2xvc2VkIGFsb25nIHdpdGggdGhlIHJlYWRlciAoaWYgaXQgaXMgYWxzbyBhIGBEZW5vLkNsb3NlcmApLlxuICpcbiAqIEFuIGV4YW1wbGUgY29udmVydGluZyBhIGBEZW5vLkZpbGVgIGludG8gYSByZWFkYWJsZSBzdHJlYW06XG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlciB9IGZyb20gXCIuL21vZC50c1wiO1xuICpcbiAqIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oXCIuL2ZpbGUudHh0XCIsIHsgcmVhZDogdHJ1ZSB9KTtcbiAqIGNvbnN0IGZpbGVTdHJlYW0gPSByZWFkYWJsZVN0cmVhbUZyb21SZWFkZXIoZmlsZSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRhYmxlU3RyZWFtRnJvbVJlYWRlcihcbiAgcmVhZGVyOiBEZW5vLlJlYWRlciB8IChEZW5vLlJlYWRlciAmIERlbm8uQ2xvc2VyKSxcbiAgb3B0aW9uczogUmVhZGFibGVTdHJlYW1Gcm9tUmVhZGVyT3B0aW9ucyA9IHt9LFxuKTogUmVhZGFibGVTdHJlYW08VWludDhBcnJheT4ge1xuICBjb25zdCB7XG4gICAgYXV0b0Nsb3NlID0gdHJ1ZSxcbiAgICBjaHVua1NpemUgPSBERUZBVUxUX0NIVU5LX1NJWkUsXG4gICAgc3RyYXRlZ3ksXG4gIH0gPSBvcHRpb25zO1xuXG4gIHJldHVybiBuZXcgUmVhZGFibGVTdHJlYW0oe1xuICAgIGFzeW5jIHB1bGwoY29udHJvbGxlcikge1xuICAgICAgY29uc3QgY2h1bmsgPSBuZXcgVWludDhBcnJheShjaHVua1NpemUpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVhZCA9IGF3YWl0IHJlYWRlci5yZWFkKGNodW5rKTtcbiAgICAgICAgaWYgKHJlYWQgPT09IG51bGwpIHtcbiAgICAgICAgICBpZiAoaXNDbG9zZXIocmVhZGVyKSAmJiBhdXRvQ2xvc2UpIHtcbiAgICAgICAgICAgIHJlYWRlci5jbG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShjaHVuay5zdWJhcnJheSgwLCByZWFkKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZSk7XG4gICAgICAgIGlmIChpc0Nsb3NlcihyZWFkZXIpKSB7XG4gICAgICAgICAgcmVhZGVyLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIGNhbmNlbCgpIHtcbiAgICAgIGlmIChpc0Nsb3NlcihyZWFkZXIpICYmIGF1dG9DbG9zZSkge1xuICAgICAgICByZWFkZXIuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9LFxuICB9LCBzdHJhdGVneSk7XG59XG5cbi8qKiBSZWFkIFJlYWRlciBgcmAgdW50aWwgRU9GIChgbnVsbGApIGFuZCByZXNvbHZlIHRvIHRoZSBjb250ZW50IGFzXG4gKiBVaW50OEFycmF5YC5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgcmVhZEFsbCB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gc3RkaW5cbiAqIGNvbnN0IHN0ZGluQ29udGVudCA9IGF3YWl0IHJlYWRBbGwoRGVuby5zdGRpbik7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGZpbGVcbiAqIGNvbnN0IGZpbGUgPSBhd2FpdCBEZW5vLm9wZW4oXCJteV9maWxlLnR4dFwiLCB7cmVhZDogdHJ1ZX0pO1xuICogY29uc3QgbXlGaWxlQ29udGVudCA9IGF3YWl0IHJlYWRBbGwoZmlsZSk7XG4gKiBEZW5vLmNsb3NlKGZpbGUucmlkKTtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gYnVmZmVyXG4gKiBjb25zdCBteURhdGEgPSBuZXcgVWludDhBcnJheSgxMDApO1xuICogLy8gLi4uIGZpbGwgbXlEYXRhIGFycmF5IHdpdGggZGF0YVxuICogY29uc3QgcmVhZGVyID0gbmV3IEJ1ZmZlcihteURhdGEuYnVmZmVyKTtcbiAqIGNvbnN0IGJ1ZmZlckNvbnRlbnQgPSBhd2FpdCByZWFkQWxsKHJlYWRlcik7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlYWRBbGwocjogRGVuby5SZWFkZXIpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgYnVmID0gbmV3IEJ1ZmZlcigpO1xuICBhd2FpdCBidWYucmVhZEZyb20ocik7XG4gIHJldHVybiBidWYuYnl0ZXMoKTtcbn1cblxuLyoqIFN5bmNocm9ub3VzbHkgcmVhZHMgUmVhZGVyIGByYCB1bnRpbCBFT0YgKGBudWxsYCkgYW5kIHJldHVybnMgdGhlIGNvbnRlbnRcbiAqIGFzIGBVaW50OEFycmF5YC5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSBcIi4uL2lvL2J1ZmZlci50c1wiO1xuICogaW1wb3J0IHsgcmVhZEFsbFN5bmMgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIHN0ZGluXG4gKiBjb25zdCBzdGRpbkNvbnRlbnQgPSByZWFkQWxsU3luYyhEZW5vLnN0ZGluKTtcbiAqXG4gKiAvLyBFeGFtcGxlIGZyb20gZmlsZVxuICogY29uc3QgZmlsZSA9IERlbm8ub3BlblN5bmMoXCJteV9maWxlLnR4dFwiLCB7cmVhZDogdHJ1ZX0pO1xuICogY29uc3QgbXlGaWxlQ29udGVudCA9IHJlYWRBbGxTeW5jKGZpbGUpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSBmcm9tIGJ1ZmZlclxuICogY29uc3QgbXlEYXRhID0gbmV3IFVpbnQ4QXJyYXkoMTAwKTtcbiAqIC8vIC4uLiBmaWxsIG15RGF0YSBhcnJheSB3aXRoIGRhdGFcbiAqIGNvbnN0IHJlYWRlciA9IG5ldyBCdWZmZXIobXlEYXRhLmJ1ZmZlcik7XG4gKiBjb25zdCBidWZmZXJDb250ZW50ID0gcmVhZEFsbFN5bmMocmVhZGVyKTtcbiAqIGBgYFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFsbFN5bmMocjogRGVuby5SZWFkZXJTeW5jKTogVWludDhBcnJheSB7XG4gIGNvbnN0IGJ1ZiA9IG5ldyBCdWZmZXIoKTtcbiAgYnVmLnJlYWRGcm9tU3luYyhyKTtcbiAgcmV0dXJuIGJ1Zi5ieXRlcygpO1xufVxuXG4vKiogV3JpdGUgYWxsIHRoZSBjb250ZW50IG9mIHRoZSBhcnJheSBidWZmZXIgKGBhcnJgKSB0byB0aGUgd3JpdGVyIChgd2ApLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG4gKiBpbXBvcnQgeyB3cml0ZUFsbCB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcblxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIHN0ZG91dFxuICogbGV0IGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogYXdhaXQgd3JpdGVBbGwoRGVuby5zdGRvdXQsIGNvbnRlbnRCeXRlcyk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGZpbGVcbiAqIGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3BlbigndGVzdC5maWxlJywge3dyaXRlOiB0cnVlfSk7XG4gKiBhd2FpdCB3cml0ZUFsbChmaWxlLCBjb250ZW50Qnl0ZXMpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGJ1ZmZlclxuICogY29udGVudEJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKFwiSGVsbG8gV29ybGRcIik7XG4gKiBjb25zdCB3cml0ZXIgPSBuZXcgQnVmZmVyKCk7XG4gKiBhd2FpdCB3cml0ZUFsbCh3cml0ZXIsIGNvbnRlbnRCeXRlcyk7XG4gKiBjb25zb2xlLmxvZyh3cml0ZXIuYnl0ZXMoKS5sZW5ndGgpOyAgLy8gMTFcbiAqIGBgYFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd3JpdGVBbGwodzogRGVuby5Xcml0ZXIsIGFycjogVWludDhBcnJheSkge1xuICBsZXQgbndyaXR0ZW4gPSAwO1xuICB3aGlsZSAobndyaXR0ZW4gPCBhcnIubGVuZ3RoKSB7XG4gICAgbndyaXR0ZW4gKz0gYXdhaXQgdy53cml0ZShhcnIuc3ViYXJyYXkobndyaXR0ZW4pKTtcbiAgfVxufVxuXG4vKiogU3luY2hyb25vdXNseSB3cml0ZSBhbGwgdGhlIGNvbnRlbnQgb2YgdGhlIGFycmF5IGJ1ZmZlciAoYGFycmApIHRvIHRoZVxuICogd3JpdGVyIChgd2ApLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBCdWZmZXIgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG4gKiBpbXBvcnQgeyB3cml0ZUFsbFN5bmMgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIHN0ZG91dFxuICogbGV0IGNvbnRlbnRCeXRlcyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShcIkhlbGxvIFdvcmxkXCIpO1xuICogd3JpdGVBbGxTeW5jKERlbm8uc3Rkb3V0LCBjb250ZW50Qnl0ZXMpO1xuICpcbiAqIC8vIEV4YW1wbGUgd3JpdGluZyB0byBmaWxlXG4gKiBjb250ZW50Qnl0ZXMgPSBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoXCJIZWxsbyBXb3JsZFwiKTtcbiAqIGNvbnN0IGZpbGUgPSBEZW5vLm9wZW5TeW5jKCd0ZXN0LmZpbGUnLCB7d3JpdGU6IHRydWV9KTtcbiAqIHdyaXRlQWxsU3luYyhmaWxlLCBjb250ZW50Qnl0ZXMpO1xuICogRGVuby5jbG9zZShmaWxlLnJpZCk7XG4gKlxuICogLy8gRXhhbXBsZSB3cml0aW5nIHRvIGJ1ZmZlclxuICogY29udGVudEJ5dGVzID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKFwiSGVsbG8gV29ybGRcIik7XG4gKiBjb25zdCB3cml0ZXIgPSBuZXcgQnVmZmVyKCk7XG4gKiB3cml0ZUFsbFN5bmMod3JpdGVyLCBjb250ZW50Qnl0ZXMpO1xuICogY29uc29sZS5sb2cod3JpdGVyLmJ5dGVzKCkubGVuZ3RoKTsgIC8vIDExXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyaXRlQWxsU3luYyh3OiBEZW5vLldyaXRlclN5bmMsIGFycjogVWludDhBcnJheSk6IHZvaWQge1xuICBsZXQgbndyaXR0ZW4gPSAwO1xuICB3aGlsZSAobndyaXR0ZW4gPCBhcnIubGVuZ3RoKSB7XG4gICAgbndyaXR0ZW4gKz0gdy53cml0ZVN5bmMoYXJyLnN1YmFycmF5KG53cml0dGVuKSk7XG4gIH1cbn1cblxuLyoqIFR1cm5zIGEgUmVhZGVyLCBgcmAsIGludG8gYW4gYXN5bmMgaXRlcmF0b3IuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGl0ZXJhdGVSZWFkZXIgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogbGV0IGYgPSBhd2FpdCBEZW5vLm9wZW4oXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaXRlcmF0ZVJlYWRlcihmKSkge1xuICogICBjb25zb2xlLmxvZyhjaHVuayk7XG4gKiB9XG4gKiBmLmNsb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBTZWNvbmQgYXJndW1lbnQgY2FuIGJlIHVzZWQgdG8gdHVuZSBzaXplIG9mIGEgYnVmZmVyLlxuICogRGVmYXVsdCBzaXplIG9mIHRoZSBidWZmZXIgaXMgMzJrQi5cbiAqXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgaXRlcmF0ZVJlYWRlciB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiBsZXQgZiA9IGF3YWl0IERlbm8ub3BlbihcIi9ldGMvcGFzc3dkXCIpO1xuICogY29uc3QgaXQgPSBpdGVyYXRlUmVhZGVyKGYsIHtcbiAqICAgYnVmU2l6ZTogMTAyNCAqIDEwMjRcbiAqIH0pO1xuICogZm9yIGF3YWl0IChjb25zdCBjaHVuayBvZiBpdCkge1xuICogICBjb25zb2xlLmxvZyhjaHVuayk7XG4gKiB9XG4gKiBmLmNsb3NlKCk7XG4gKiBgYGBcbiAqXG4gKiBJdGVyYXRvciB1c2VzIGFuIGludGVybmFsIGJ1ZmZlciBvZiBmaXhlZCBzaXplIGZvciBlZmZpY2llbmN5OyBpdCByZXR1cm5zXG4gKiBhIHZpZXcgb24gdGhhdCBidWZmZXIgb24gZWFjaCBpdGVyYXRpb24uIEl0IGlzIHRoZXJlZm9yZSBjYWxsZXInc1xuICogcmVzcG9uc2liaWxpdHkgdG8gY29weSBjb250ZW50cyBvZiB0aGUgYnVmZmVyIGlmIG5lZWRlZDsgb3RoZXJ3aXNlIHRoZVxuICogbmV4dCBpdGVyYXRpb24gd2lsbCBvdmVyd3JpdGUgY29udGVudHMgb2YgcHJldmlvdXNseSByZXR1cm5lZCBjaHVuay5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiBpdGVyYXRlUmVhZGVyKFxuICByOiBEZW5vLlJlYWRlcixcbiAgb3B0aW9ucz86IHtcbiAgICBidWZTaXplPzogbnVtYmVyO1xuICB9LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgYnVmU2l6ZSA9IG9wdGlvbnM/LmJ1ZlNpemUgPz8gREVGQVVMVF9CVUZGRVJfU0laRTtcbiAgY29uc3QgYiA9IG5ldyBVaW50OEFycmF5KGJ1ZlNpemUpO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHIucmVhZChiKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICB5aWVsZCBiLnN1YmFycmF5KDAsIHJlc3VsdCk7XG4gIH1cbn1cblxuLyoqIFR1cm5zIGEgUmVhZGVyU3luYywgYHJgLCBpbnRvIGFuIGl0ZXJhdG9yLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBpdGVyYXRlUmVhZGVyU3luYyB9IGZyb20gXCIuL2NvbnZlcnNpb24udHNcIjtcbiAqXG4gKiBsZXQgZiA9IERlbm8ub3BlblN5bmMoXCIvZXRjL3Bhc3N3ZFwiKTtcbiAqIGZvciAoY29uc3QgY2h1bmsgb2YgaXRlcmF0ZVJlYWRlclN5bmMoZikpIHtcbiAqICAgY29uc29sZS5sb2coY2h1bmspO1xuICogfVxuICogZi5jbG9zZSgpO1xuICogYGBgXG4gKlxuICogU2Vjb25kIGFyZ3VtZW50IGNhbiBiZSB1c2VkIHRvIHR1bmUgc2l6ZSBvZiBhIGJ1ZmZlci5cbiAqIERlZmF1bHQgc2l6ZSBvZiB0aGUgYnVmZmVyIGlzIDMya0IuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGl0ZXJhdGVSZWFkZXJTeW5jIH0gZnJvbSBcIi4vY29udmVyc2lvbi50c1wiO1xuXG4gKiBsZXQgZiA9IGF3YWl0IERlbm8ub3BlbihcIi9ldGMvcGFzc3dkXCIpO1xuICogY29uc3QgaXRlciA9IGl0ZXJhdGVSZWFkZXJTeW5jKGYsIHtcbiAqICAgYnVmU2l6ZTogMTAyNCAqIDEwMjRcbiAqIH0pO1xuICogZm9yIChjb25zdCBjaHVuayBvZiBpdGVyKSB7XG4gKiAgIGNvbnNvbGUubG9nKGNodW5rKTtcbiAqIH1cbiAqIGYuY2xvc2UoKTtcbiAqIGBgYFxuICpcbiAqIEl0ZXJhdG9yIHVzZXMgYW4gaW50ZXJuYWwgYnVmZmVyIG9mIGZpeGVkIHNpemUgZm9yIGVmZmljaWVuY3k7IGl0IHJldHVybnNcbiAqIGEgdmlldyBvbiB0aGF0IGJ1ZmZlciBvbiBlYWNoIGl0ZXJhdGlvbi4gSXQgaXMgdGhlcmVmb3JlIGNhbGxlcidzXG4gKiByZXNwb25zaWJpbGl0eSB0byBjb3B5IGNvbnRlbnRzIG9mIHRoZSBidWZmZXIgaWYgbmVlZGVkOyBvdGhlcndpc2UgdGhlXG4gKiBuZXh0IGl0ZXJhdGlvbiB3aWxsIG92ZXJ3cml0ZSBjb250ZW50cyBvZiBwcmV2aW91c2x5IHJldHVybmVkIGNodW5rLlxuICovXG5leHBvcnQgZnVuY3Rpb24qIGl0ZXJhdGVSZWFkZXJTeW5jKFxuICByOiBEZW5vLlJlYWRlclN5bmMsXG4gIG9wdGlvbnM/OiB7XG4gICAgYnVmU2l6ZT86IG51bWJlcjtcbiAgfSxcbik6IEl0ZXJhYmxlSXRlcmF0b3I8VWludDhBcnJheT4ge1xuICBjb25zdCBidWZTaXplID0gb3B0aW9ucz8uYnVmU2l6ZSA/PyBERUZBVUxUX0JVRkZFUl9TSVpFO1xuICBjb25zdCBiID0gbmV3IFVpbnQ4QXJyYXkoYnVmU2l6ZSk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gci5yZWFkU3luYyhiKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICB5aWVsZCBiLnN1YmFycmF5KDAsIHJlc3VsdCk7XG4gIH1cbn1cblxuLyoqIENvcGllcyBmcm9tIGBzcmNgIHRvIGBkc3RgIHVudGlsIGVpdGhlciBFT0YgKGBudWxsYCkgaXMgcmVhZCBmcm9tIGBzcmNgIG9yXG4gKiBhbiBlcnJvciBvY2N1cnMuIEl0IHJlc29sdmVzIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXMgY29waWVkIG9yIHJlamVjdHMgd2l0aFxuICogdGhlIGZpcnN0IGVycm9yIGVuY291bnRlcmVkIHdoaWxlIGNvcHlpbmcuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IGNvcHkgfSBmcm9tIFwiLi9jb252ZXJzaW9uLnRzXCI7XG4gKlxuICogY29uc3Qgc291cmNlID0gYXdhaXQgRGVuby5vcGVuKFwibXlfZmlsZS50eHRcIik7XG4gKiBjb25zdCBieXRlc0NvcGllZDEgPSBhd2FpdCBjb3B5KHNvdXJjZSwgRGVuby5zdGRvdXQpO1xuICogY29uc3QgZGVzdGluYXRpb24gPSBhd2FpdCBEZW5vLmNyZWF0ZShcIm15X2ZpbGVfMi50eHRcIik7XG4gKiBjb25zdCBieXRlc0NvcGllZDIgPSBhd2FpdCBjb3B5KHNvdXJjZSwgZGVzdGluYXRpb24pO1xuICogYGBgXG4gKlxuICogQHBhcmFtIHNyYyBUaGUgc291cmNlIHRvIGNvcHkgZnJvbVxuICogQHBhcmFtIGRzdCBUaGUgZGVzdGluYXRpb24gdG8gY29weSB0b1xuICogQHBhcmFtIG9wdGlvbnMgQ2FuIGJlIHVzZWQgdG8gdHVuZSBzaXplIG9mIHRoZSBidWZmZXIuIERlZmF1bHQgc2l6ZSBpcyAzMmtCXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb3B5KFxuICBzcmM6IERlbm8uUmVhZGVyLFxuICBkc3Q6IERlbm8uV3JpdGVyLFxuICBvcHRpb25zPzoge1xuICAgIGJ1ZlNpemU/OiBudW1iZXI7XG4gIH0sXG4pOiBQcm9taXNlPG51bWJlcj4ge1xuICBsZXQgbiA9IDA7XG4gIGNvbnN0IGJ1ZlNpemUgPSBvcHRpb25zPy5idWZTaXplID8/IERFRkFVTFRfQlVGRkVSX1NJWkU7XG4gIGNvbnN0IGIgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgbGV0IGdvdEVPRiA9IGZhbHNlO1xuICB3aGlsZSAoZ290RU9GID09PSBmYWxzZSkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNyYy5yZWFkKGIpO1xuICAgIGlmIChyZXN1bHQgPT09IG51bGwpIHtcbiAgICAgIGdvdEVPRiA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBud3JpdHRlbiA9IDA7XG4gICAgICB3aGlsZSAobndyaXR0ZW4gPCByZXN1bHQpIHtcbiAgICAgICAgbndyaXR0ZW4gKz0gYXdhaXQgZHN0LndyaXRlKGIuc3ViYXJyYXkobndyaXR0ZW4sIHJlc3VsdCkpO1xuICAgICAgfVxuICAgICAgbiArPSBud3JpdHRlbjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG47XG59XG4iXX0=