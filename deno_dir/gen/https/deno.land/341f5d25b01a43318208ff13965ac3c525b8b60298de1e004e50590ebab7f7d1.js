import { assert, isListenTlsOptions } from "./util.ts";
export const DomResponse = Response;
const serveHttp = "serveHttp" in Deno
    ?
        Deno.serveHttp.bind(Deno)
    : undefined;
const maybeUpgradeWebSocket = "upgradeWebSocket" in Deno
    ?
        Deno.upgradeWebSocket.bind(Deno)
    : undefined;
export class NativeRequest {
    #conn;
    #reject;
    #request;
    #requestPromise;
    #resolve;
    #resolved = false;
    #upgradeWebSocket;
    constructor(requestEvent, options = {}) {
        const { conn } = options;
        this.#conn = conn;
        this.#upgradeWebSocket = "upgradeWebSocket" in options
            ? options["upgradeWebSocket"]
            : maybeUpgradeWebSocket;
        this.#request = requestEvent.request;
        const p = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
        this.#requestPromise = requestEvent.respondWith(p);
    }
    get body() {
        return this.#request.body;
    }
    get donePromise() {
        return this.#requestPromise;
    }
    get headers() {
        return this.#request.headers;
    }
    get method() {
        return this.#request.method;
    }
    get remoteAddr() {
        return this.#conn?.remoteAddr?.hostname;
    }
    get request() {
        return this.#request;
    }
    get url() {
        try {
            const url = new URL(this.#request.url);
            return this.#request.url.replace(url.origin, "");
        }
        catch {
        }
        return this.#request.url;
    }
    get rawUrl() {
        return this.#request.url;
    }
    error(reason) {
        if (this.#resolved) {
            throw new Error("Request already responded to.");
        }
        this.#reject(reason);
        this.#resolved = true;
    }
    respond(response) {
        if (this.#resolved) {
            throw new Error("Request already responded to.");
        }
        this.#resolve(response);
        this.#resolved = true;
        return this.#requestPromise;
    }
    upgrade(options) {
        if (this.#resolved) {
            throw new Error("Request already responded to.");
        }
        if (!this.#upgradeWebSocket) {
            throw new TypeError("Upgrading web sockets not supported.");
        }
        const { response, socket } = this.#upgradeWebSocket(this.#request, options);
        this.#resolve(response);
        this.#resolved = true;
        return socket;
    }
}
export class HttpServerNative {
    #app;
    #closed = false;
    #listener;
    #httpConnections = new Set();
    #options;
    constructor(app, options) {
        if (!("serveHttp" in Deno)) {
            throw new Error("The native bindings for serving HTTP are not available.");
        }
        this.#app = app;
        this.#options = options;
    }
    get app() {
        return this.#app;
    }
    get closed() {
        return this.#closed;
    }
    close() {
        this.#closed = true;
        if (this.#listener) {
            this.#listener.close();
            this.#listener = undefined;
        }
        for (const httpConn of this.#httpConnections) {
            try {
                httpConn.close();
            }
            catch (error) {
                if (!(error instanceof Deno.errors.BadResource)) {
                    throw error;
                }
            }
        }
        this.#httpConnections.clear();
    }
    listen() {
        return this.#listener = isListenTlsOptions(this.#options)
            ? Deno.listenTls(this.#options)
            : Deno.listen(this.#options);
    }
    #trackHttpConnection(httpConn) {
        this.#httpConnections.add(httpConn);
    }
    #untrackHttpConnection(httpConn) {
        this.#httpConnections.delete(httpConn);
    }
    [Symbol.asyncIterator]() {
        const start = (controller) => {
            const server = this;
            async function serve(conn) {
                const httpConn = serveHttp(conn);
                server.#trackHttpConnection(httpConn);
                while (true) {
                    try {
                        const requestEvent = await httpConn.nextRequest();
                        if (requestEvent === null) {
                            return;
                        }
                        const nativeRequest = new NativeRequest(requestEvent, { conn });
                        controller.enqueue(nativeRequest);
                        await nativeRequest.donePromise;
                    }
                    catch (error) {
                        server.app.dispatchEvent(new ErrorEvent("error", { error }));
                    }
                    if (server.closed) {
                        server.#untrackHttpConnection(httpConn);
                        httpConn.close();
                        controller.close();
                    }
                }
            }
            const listener = this.#listener;
            assert(listener);
            async function accept() {
                while (true) {
                    try {
                        const conn = await listener.accept();
                        serve(conn);
                    }
                    catch (error) {
                        if (!server.closed) {
                            server.app.dispatchEvent(new ErrorEvent("error", { error }));
                        }
                    }
                    if (server.closed) {
                        controller.close();
                        return;
                    }
                }
            }
            accept();
        };
        const stream = new ReadableStream({ start });
        return stream[Symbol.asyncIterator]();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cF9zZXJ2ZXJfbmF0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaHR0cF9zZXJ2ZXJfbmF0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUlBLE9BQU8sRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFHdkQsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFvQixRQUFRLENBQUM7QUF1QnJELE1BQU0sU0FBUyxHQUFrQyxXQUFXLElBQUksSUFBSTtJQUNsRSxDQUFDO1FBQ0UsSUFBWSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQzFCLElBQUksQ0FDTDtJQUNILENBQUMsQ0FBQyxTQUFTLENBQUM7QUFZZCxNQUFNLHFCQUFxQixHQUN6QixrQkFBa0IsSUFBSSxJQUFJO0lBQ3hCLENBQUM7UUFDRSxJQUFZLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUMzQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBT2hCLE1BQU0sT0FBTyxhQUFhO0lBQ3hCLEtBQUssQ0FBYTtJQUVsQixPQUFPLENBQTBCO0lBQ2pDLFFBQVEsQ0FBVTtJQUNsQixlQUFlLENBQWdCO0lBQy9CLFFBQVEsQ0FBNkI7SUFDckMsU0FBUyxHQUFHLEtBQUssQ0FBQztJQUNsQixpQkFBaUIsQ0FBc0I7SUFFdkMsWUFDRSxZQUEwQixFQUMxQixVQUFnQyxFQUFFO1FBRWxDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFFbEIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLGtCQUFrQixJQUFJLE9BQU87WUFDcEQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQztZQUM3QixDQUFDLENBQUMscUJBQXFCLENBQUM7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLElBQUks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QUM5RDtvQkFFRCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUU7d0JBQ2pCLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsQ0FBQzt3QkFDeEMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO3dCQUNqQixVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7cUJBQ3BCO2lCQUNGO1lBQ0gsQ0FBQztZQUVELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDaEMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2pCLEtBQUssVUFBVSxNQUFNO2dCQUNuQixPQUFPLElBQUksRUFBRTtvQkFDWCxJQUFJO3dCQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sUUFBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUN0QyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7cUJBQ2I7b0JBQUMsT0FBTyxLQUFLLEVBQUU7d0JBQ2QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7NEJBQ2xCLE1BQU0sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQzt5QkFDOUQ7cUJBQ0Y7b0JBQ0QsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFO3dCQUNqQixVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7d0JBQ25CLE9BQU87cUJBQ1I7aUJBQ0Y7WUFDSCxDQUFDO1lBRUQsTUFBTSxFQUFFLENBQUM7UUFDWCxDQUFDLENBQUM7UUFDRixNQUFNLE1BQU0sR0FBRyxJQUFJLGNBQWMsQ0FBZ0IsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBRTVELE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO0lBQ3hDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIG9hayBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvbiwgU3RhdGUgfSBmcm9tIFwiLi9hcHBsaWNhdGlvbi50c1wiO1xuaW1wb3J0IHR5cGUgeyBTZXJ2ZXIsIFVwZ3JhZGVXZWJTb2NrZXRPcHRpb25zIH0gZnJvbSBcIi4vdHlwZXMuZC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0LCBpc0xpc3RlblRsc09wdGlvbnMgfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbmV4cG9ydCB0eXBlIFJlc3BvbmQgPSAocjogUmVzcG9uc2UgfCBQcm9taXNlPFJlc3BvbnNlPikgPT4gdm9pZDtcbmV4cG9ydCBjb25zdCBEb21SZXNwb25zZTogdHlwZW9mIFJlc3BvbnNlID0gUmVzcG9uc2U7XG5cbi8vIFRoaXMgdHlwZSBpcyBwYXJ0IG9mIERlbm8sIGJ1dCBub3QgcGFydCBvZiBsaWIuZG9tLmQudHMsIHRoZXJlZm9yZSBhZGQgaXQgaGVyZVxuLy8gc28gdGhhdCB0eXBlIGNoZWNraW5nIGNhbiBvY2N1ciBwcm9wZXJseSB1bmRlciBgbGliLmRvbS5kLnRzYC5cbmludGVyZmFjZSBSZWFkYWJsZVN0cmVhbURlZmF1bHRDb250cm9sbGVyQ2FsbGJhY2s8Uj4ge1xuICAoY29udHJvbGxlcjogUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlcjxSPik6IHZvaWQgfCBQcm9taXNlTGlrZTx2b2lkPjtcbn1cblxuLy8gU2luY2UgdGhlIG5hdGl2ZSBiaW5kaW5ncyBhcmUgY3VycmVudGx5IHVuc3RhYmxlIGluIERlbm8sIHdlIHdpbGwgYWRkIHRoZVxuLy8gaW50ZXJmYWNlcyBoZXJlLCBzbyB0aGF0IHdlIGNhbiB0eXBlIGNoZWNrIG9hayB3aXRob3V0IHJlcXVpcmluZyB0aGVcbi8vIGAtLXVuc3RhYmxlYCBmbGFnIHRvIGJlIHVzZWQuXG5cbmludGVyZmFjZSBSZXF1ZXN0RXZlbnQge1xuICByZWFkb25seSByZXF1ZXN0OiBSZXF1ZXN0O1xuICByZXNwb25kV2l0aChyOiBSZXNwb25zZSB8IFByb21pc2U8UmVzcG9uc2U+KTogUHJvbWlzZTx2b2lkPjtcbn1cblxuaW50ZXJmYWNlIEh0dHBDb25uIGV4dGVuZHMgQXN5bmNJdGVyYWJsZTxSZXF1ZXN0RXZlbnQ+IHtcbiAgcmVhZG9ubHkgcmlkOiBudW1iZXI7XG4gIG5leHRSZXF1ZXN0KCk6IFByb21pc2U8UmVxdWVzdEV2ZW50IHwgbnVsbD47XG4gIGNsb3NlKCk6IHZvaWQ7XG59XG5cbmNvbnN0IHNlcnZlSHR0cDogKGNvbm46IERlbm8uQ29ubikgPT4gSHR0cENvbm4gPSBcInNlcnZlSHR0cFwiIGluIERlbm9cbiAgPyAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIChEZW5vIGFzIGFueSkuc2VydmVIdHRwLmJpbmQoXG4gICAgICBEZW5vLFxuICAgIClcbiAgOiB1bmRlZmluZWQ7XG5cbmludGVyZmFjZSBXZWJTb2NrZXRVcGdyYWRlIHtcbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuICBzb2NrZXQ6IFdlYlNvY2tldDtcbn1cblxuZXhwb3J0IHR5cGUgVXBncmFkZVdlYlNvY2tldEZuID0gKFxuICByZXF1ZXN0OiBSZXF1ZXN0LFxuICBvcHRpb25zPzogVXBncmFkZVdlYlNvY2tldE9wdGlvbnMsXG4pID0+IFdlYlNvY2tldFVwZ3JhZGU7XG5cbmNvbnN0IG1heWJlVXBncmFkZVdlYlNvY2tldDogVXBncmFkZVdlYlNvY2tldEZuIHwgdW5kZWZpbmVkID1cbiAgXCJ1cGdyYWRlV2ViU29ja2V0XCIgaW4gRGVub1xuICAgID8gLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICAgIChEZW5vIGFzIGFueSkudXBncmFkZVdlYlNvY2tldC5iaW5kKERlbm8pXG4gICAgOiB1bmRlZmluZWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmF0aXZlUmVxdWVzdE9wdGlvbnMge1xuICBjb25uPzogRGVuby5Db25uO1xuICB1cGdyYWRlV2ViU29ja2V0PzogVXBncmFkZVdlYlNvY2tldEZuO1xufVxuXG5leHBvcnQgY2xhc3MgTmF0aXZlUmVxdWVzdCB7XG4gICNjb25uPzogRGVuby5Db25uO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAjcmVqZWN0ITogKHJlYXNvbj86IGFueSkgPT4gdm9pZDtcbiAgI3JlcXVlc3Q6IFJlcXVlc3Q7XG4gICNyZXF1ZXN0UHJvbWlzZTogUHJvbWlzZTx2b2lkPjtcbiAgI3Jlc29sdmUhOiAodmFsdWU6IFJlc3BvbnNlKSA9PiB2b2lkO1xuICAjcmVzb2x2ZWQgPSBmYWxzZTtcbiAgI3VwZ3JhZGVXZWJTb2NrZXQ/OiBVcGdyYWRlV2ViU29ja2V0Rm47XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcmVxdWVzdEV2ZW50OiBSZXF1ZXN0RXZlbnQsXG4gICAgb3B0aW9uczogTmF0aXZlUmVxdWVzdE9wdGlvbnMgPSB7fSxcbiAgKSB7XG4gICAgY29uc3QgeyBjb25uIH0gPSBvcHRpb25zO1xuICAgIHRoaXMuI2Nvbm4gPSBjb25uO1xuICAgIC8vIHRoaXMgYWxsb3dzIGZvciB0aGUgdmFsdWUgdG8gYmUgZXhwbGljaXRseSB1bmRlZmluZWQgaW4gdGhlIG9wdGlvbnNcbiAgICB0aGlzLiN1cGdyYWRlV2ViU29ja2V0ID0gXCJ1cGdyYWRlV2ViU29ja2V0XCIgaW4gb3B0aW9uc1xuICAgICAgPyBvcHRpb25zW1widXBncmFkZVdlYlNvY2tldFwiXVxuICAgICAgOiBtYXliZVVwZ3JhZGVXZWJTb2NrZXQ7XG4gICAgdGhpcy4jcmVxdWVzdCA9IHJlcXVlc3RFdmVudC5yZXF1ZXN0O1xuICAgIGNvbnN0IHAgPSBuZXcgUHJvbWlzZTxSZXNwb25zZT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy4jcmVzb2x2ZSA9IHJlc29sdmU7XG4gICAgICB0aGlzLiNyZWplY3QgPSByZWplY3Q7XG4gICAgfSk7XG4gICAgdGhpcy4jcmVxdWVzdFByb21pc2UgPSByZXF1ZXN0RXZlbnQucmVzcG9uZFdpdGgocCk7XG4gIH1cblxuICBnZXQgYm9keSgpOiBSZWFkYWJsZVN0cmVhbTxVaW50OEFycmF5PiB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0LmJvZHk7XG4gIH1cblxuICBnZXQgZG9uZVByb21pc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuI3JlcXVlc3RQcm9taXNlO1xuICB9XG5cbiAgZ2V0IGhlYWRlcnMoKTogSGVhZGVycyB7XG4gICAgcmV0dXJuIHRoaXMuI3JlcXVlc3QuaGVhZGVycztcbiAgfVxuXG4gIGdldCBtZXRob2QoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy4jcmVxdWVzdC5tZXRob2Q7XG4gIH1cblxuICBnZXQgcmVtb3RlQWRkcigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiAodGhpcy4jY29ubj8ucmVtb3RlQWRkciBhcyBEZW5vLk5ldEFkZHIpPy5ob3N0bmFtZTtcbiAgfVxuXG4gIGdldCByZXF1ZXN0KCk6IFJlcXVlc3Qge1xuICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0O1xuICB9XG5cbiAgZ2V0IHVybCgpOiBzdHJpbmcge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHRoaXMuI3JlcXVlc3QudXJsKTtcbiAgICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0LnVybC5yZXBsYWNlKHVybC5vcmlnaW4sIFwiXCIpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCBlcnJvcnMsIHdlIGp1c3Qgd2FudCB0byBmYWxsIGJhY2tcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuI3JlcXVlc3QudXJsO1xuICB9XG5cbiAgZ2V0IHJhd1VybCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0LnVybDtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGVycm9yKHJlYXNvbj86IGFueSk6IHZvaWQge1xuICAgIGlmICh0aGlzLiNyZXNvbHZlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVxdWVzdCBhbHJlYWR5IHJlc3BvbmRlZCB0by5cIik7XG4gICAgfVxuICAgIHRoaXMuI3JlamVjdChyZWFzb24pO1xuICAgIHRoaXMuI3Jlc29sdmVkID0gdHJ1ZTtcbiAgfVxuXG4gIHJlc3BvbmQocmVzcG9uc2U6IFJlc3BvbnNlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuI3Jlc29sdmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJSZXF1ZXN0IGFscmVhZHkgcmVzcG9uZGVkIHRvLlwiKTtcbiAgICB9XG4gICAgdGhpcy4jcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgdGhpcy4jcmVzb2x2ZWQgPSB0cnVlO1xuICAgIHJldHVybiB0aGlzLiNyZXF1ZXN0UHJvbWlzZTtcbiAgfVxuXG4gIHVwZ3JhZGUob3B0aW9ucz86IFVwZ3JhZGVXZWJTb2NrZXRPcHRpb25zKTogV2ViU29ja2V0IHtcbiAgICBpZiAodGhpcy4jcmVzb2x2ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlJlcXVlc3QgYWxyZWFkeSByZXNwb25kZWQgdG8uXCIpO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuI3VwZ3JhZGVXZWJTb2NrZXQpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJVcGdyYWRpbmcgd2ViIHNvY2tldHMgbm90IHN1cHBvcnRlZC5cIik7XG4gICAgfVxuICAgIGNvbnN0IHsgcmVzcG9uc2UsIHNvY2tldCB9ID0gdGhpcy4jdXBncmFkZVdlYlNvY2tldChcbiAgICAgIHRoaXMuI3JlcXVlc3QsXG4gICAgICBvcHRpb25zLFxuICAgICk7XG4gICAgdGhpcy4jcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgdGhpcy4jcmVzb2x2ZWQgPSB0cnVlO1xuICAgIHJldHVybiBzb2NrZXQ7XG4gIH1cbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmV4cG9ydCBjbGFzcyBIdHRwU2VydmVyTmF0aXZlPEFTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+PlxuICBpbXBsZW1lbnRzIFNlcnZlcjxOYXRpdmVSZXF1ZXN0PiB7XG4gICNhcHA6IEFwcGxpY2F0aW9uPEFTPjtcbiAgI2Nsb3NlZCA9IGZhbHNlO1xuICAjbGlzdGVuZXI/OiBEZW5vLkxpc3RlbmVyO1xuICAjaHR0cENvbm5lY3Rpb25zOiBTZXQ8RGVuby5IdHRwQ29ubj4gPSBuZXcgU2V0KCk7XG4gICNvcHRpb25zOiBEZW5vLkxpc3Rlbk9wdGlvbnMgfCBEZW5vLkxpc3RlblRsc09wdGlvbnM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHBsaWNhdGlvbjxBUz4sXG4gICAgb3B0aW9uczogRGVuby5MaXN0ZW5PcHRpb25zIHwgRGVuby5MaXN0ZW5UbHNPcHRpb25zLFxuICApIHtcbiAgICBpZiAoIShcInNlcnZlSHR0cFwiIGluIERlbm8pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiVGhlIG5hdGl2ZSBiaW5kaW5ncyBmb3Igc2VydmluZyBIVFRQIGFyZSBub3QgYXZhaWxhYmxlLlwiLFxuICAgICAgKTtcbiAgICB9XG4gICAgdGhpcy4jYXBwID0gYXBwO1xuICAgIHRoaXMuI29wdGlvbnMgPSBvcHRpb25zO1xuICB9XG5cbiAgZ2V0IGFwcCgpOiBBcHBsaWNhdGlvbjxBUz4ge1xuICAgIHJldHVybiB0aGlzLiNhcHA7XG4gIH1cblxuICBnZXQgY2xvc2VkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLiNjbG9zZWQ7XG4gIH1cblxuICBjbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLiNjbG9zZWQgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuI2xpc3RlbmVyKSB7XG4gICAgICB0aGlzLiNsaXN0ZW5lci5jbG9zZSgpO1xuICAgICAgdGhpcy4jbGlzdGVuZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBodHRwQ29ubiBvZiB0aGlzLiNodHRwQ29ubmVjdGlvbnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGh0dHBDb25uLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoIShlcnJvciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlKSkge1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy4jaHR0cENvbm5lY3Rpb25zLmNsZWFyKCk7XG4gIH1cblxuICBsaXN0ZW4oKTogRGVuby5MaXN0ZW5lciB7XG4gICAgcmV0dXJuIHRoaXMuI2xpc3RlbmVyID0gaXNMaXN0ZW5UbHNPcHRpb25zKHRoaXMuI29wdGlvbnMpXG4gICAgICA/IERlbm8ubGlzdGVuVGxzKHRoaXMuI29wdGlvbnMpXG4gICAgICA6IERlbm8ubGlzdGVuKHRoaXMuI29wdGlvbnMpO1xuICB9XG5cbiAgI3RyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm46IERlbm8uSHR0cENvbm4pOiB2b2lkIHtcbiAgICB0aGlzLiNodHRwQ29ubmVjdGlvbnMuYWRkKGh0dHBDb25uKTtcbiAgfVxuXG4gICN1bnRyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm46IERlbm8uSHR0cENvbm4pOiB2b2lkIHtcbiAgICB0aGlzLiNodHRwQ29ubmVjdGlvbnMuZGVsZXRlKGh0dHBDb25uKTtcbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPE5hdGl2ZVJlcXVlc3Q+IHtcbiAgICBjb25zdCBzdGFydDogUmVhZGFibGVTdHJlYW1EZWZhdWx0Q29udHJvbGxlckNhbGxiYWNrPE5hdGl2ZVJlcXVlc3Q+ID0gKFxuICAgICAgY29udHJvbGxlcixcbiAgICApID0+IHtcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tdGhpcy1hbGlhc1xuICAgICAgY29uc3Qgc2VydmVyID0gdGhpcztcbiAgICAgIGFzeW5jIGZ1bmN0aW9uIHNlcnZlKGNvbm46IERlbm8uQ29ubikge1xuICAgICAgICBjb25zdCBodHRwQ29ubiA9IHNlcnZlSHR0cChjb25uKTtcbiAgICAgICAgc2VydmVyLiN0cmFja0h0dHBDb25uZWN0aW9uKGh0dHBDb25uKTtcblxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXF1ZXN0RXZlbnQgPSBhd2FpdCBodHRwQ29ubi5uZXh0UmVxdWVzdCgpO1xuXG4gICAgICAgICAgICBpZiAocmVxdWVzdEV2ZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUmVxdWVzdCA9IG5ldyBOYXRpdmVSZXF1ZXN0KHJlcXVlc3RFdmVudCwgeyBjb25uIH0pO1xuICAgICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKG5hdGl2ZVJlcXVlc3QpO1xuICAgICAgICAgICAgYXdhaXQgbmF0aXZlUmVxdWVzdC5kb25lUHJvbWlzZTtcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgc2VydmVyLmFwcC5kaXNwYXRjaEV2ZW50KG5ldyBFcnJvckV2ZW50KFwiZXJyb3JcIiwgeyBlcnJvciB9KSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNlcnZlci5jbG9zZWQpIHtcbiAgICAgICAgICAgIHNlcnZlci4jdW50cmFja0h0dHBDb25uZWN0aW9uKGh0dHBDb25uKTtcbiAgICAgICAgICAgIGh0dHBDb25uLmNsb3NlKCk7XG4gICAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGxpc3RlbmVyID0gdGhpcy4jbGlzdGVuZXI7XG4gICAgICBhc3NlcnQobGlzdGVuZXIpO1xuICAgICAgYXN5bmMgZnVuY3Rpb24gYWNjZXB0KCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25uID0gYXdhaXQgbGlzdGVuZXIhLmFjY2VwdCgpO1xuICAgICAgICAgICAgc2VydmUoY29ubik7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICghc2VydmVyLmNsb3NlZCkge1xuICAgICAgICAgICAgICBzZXJ2ZXIuYXBwLmRpc3BhdGNoRXZlbnQobmV3IEVycm9yRXZlbnQoXCJlcnJvclwiLCB7IGVycm9yIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlcnZlci5jbG9zZWQpIHtcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgYWNjZXB0KCk7XG4gICAgfTtcbiAgICBjb25zdCBzdHJlYW0gPSBuZXcgUmVhZGFibGVTdHJlYW08TmF0aXZlUmVxdWVzdD4oeyBzdGFydCB9KTtcblxuICAgIHJldHVybiBzdHJlYW1bU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk7XG4gIH1cbn1cbiJdfQ==