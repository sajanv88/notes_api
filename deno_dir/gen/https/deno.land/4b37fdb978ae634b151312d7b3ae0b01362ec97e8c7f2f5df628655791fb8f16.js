import { Cookies } from "./cookies.ts";
import { createHttpError } from "./httpError.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { send } from "./send.ts";
import { SSEStreamTarget, } from "./server_sent_event.ts";
export class Context {
    #socket;
    #sse;
    app;
    cookies;
    get isUpgradable() {
        const upgrade = this.request.headers.get("upgrade");
        if (!upgrade || upgrade.toLowerCase() !== "websocket") {
            return false;
        }
        const secKey = this.request.headers.get("sec-websocket-key");
        return typeof secKey === "string" && secKey != "";
    }
    respond;
    request;
    response;
    get socket() {
        return this.#socket;
    }
    state;
    constructor(app, serverRequest, state, secure = false) {
        this.app = app;
        this.state = state;
        this.request = new Request(serverRequest, app.proxy, secure);
        this.respond = true;
        this.response = new Response(this.request);
        this.cookies = new Cookies(this.request, this.response, {
            keys: this.app.keys,
            secure: this.request.secure,
        });
    }
    assert(condition, errorStatus = 500, message, props) {
        if (condition) {
            return;
        }
        const err = createHttpError(errorStatus, message);
        if (props) {
            Object.assign(err, props);
        }
        throw err;
    }
    send(options) {
        const { path = this.request.url.pathname, ...sendOptions } = options;
        return send(this, path, sendOptions);
    }
    sendEvents(options) {
        if (!this.#sse) {
            this.#sse = new SSEStreamTarget(this, options);
        }
        return this.#sse;
    }
    throw(errorStatus, message, props) {
        const err = createHttpError(errorStatus, message);
        if (props) {
            Object.assign(err, props);
        }
        throw err;
    }
    upgrade(options) {
        if (this.#socket) {
            return this.#socket;
        }
        this.#socket = this.request.originalRequest.upgrade(options);
        this.respond = false;
        return this.#socket;
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        const { app, cookies, isUpgradable, respond, request, response, socket, state, } = this;
        return `${this.constructor.name} ${inspect({
            app,
            cookies,
            isUpgradable,
            respond,
            request,
            response,
            socket,
            state,
        })}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUV2QyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFakQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxJQUFJLEVBQWUsTUFBTSxXQUFXLENBQUM7QUFDOUMsT0FBTyxFQUVMLGVBQWUsR0FDaEIsTUFBTSx3QkFBd0IsQ0FBQztBQWFoQyxNQUFNLE9BQU8sT0FBTztJQUtsQixPQUFPLENBQWE7SUFDcEIsSUFBSSxDQUF5QjtJQUc3QixHQUFHLENBQWtCO0lBSXJCLE9BQU8sQ0FBVTtJQUtqQixJQUFJLFlBQVk7UUFDZCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLEtBQUssV0FBVyxFQUFFO1lBQ3JELE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFDRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztRQUM3RCxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLElBQUksRUFBRSxDQUFDO0lBQ3BELENBQUM7SUFVRCxPQUFPLENBQVU7SUFHakIsT0FBTyxDQUFVO0lBSWpCLFFBQVEsQ0FBVztJQUluQixJQUFJLE1BQU07UUFDUixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEIsQ0FBQztJQXNCRCxLQUFLLENBQUk7SUFFVCxZQUNFLEdBQW9CLEVBQ3BCLGFB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QUFZO1lBQ1osT0FBTztZQUNQLE9BQU87WUFDUCxRQUFRO1lBQ1IsTUFBTTtZQUNOLEtBQUs7U0FDTixDQUNILEVBQUUsQ0FBQztJQUNMLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIG9hayBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHR5cGUgeyBBcHBsaWNhdGlvbiwgU3RhdGUgfSBmcm9tIFwiLi9hcHBsaWNhdGlvbi50c1wiO1xuaW1wb3J0IHsgQ29va2llcyB9IGZyb20gXCIuL2Nvb2tpZXMudHNcIjtcbmltcG9ydCB7IE5hdGl2ZVJlcXVlc3QgfSBmcm9tIFwiLi9odHRwX3NlcnZlcl9uYXRpdmUudHNcIjtcbmltcG9ydCB7IGNyZWF0ZUh0dHBFcnJvciB9IGZyb20gXCIuL2h0dHBFcnJvci50c1wiO1xuaW1wb3J0IHR5cGUgeyBLZXlTdGFjayB9IGZyb20gXCIuL2tleVN0YWNrLnRzXCI7XG5pbXBvcnQgeyBSZXF1ZXN0IH0gZnJvbSBcIi4vcmVxdWVzdC50c1wiO1xuaW1wb3J0IHsgUmVzcG9uc2UgfSBmcm9tIFwiLi9yZXNwb25zZS50c1wiO1xuaW1wb3J0IHsgc2VuZCwgU2VuZE9wdGlvbnMgfSBmcm9tIFwiLi9zZW5kLnRzXCI7XG5pbXBvcnQge1xuICBTZXJ2ZXJTZW50RXZlbnRUYXJnZXRPcHRpb25zLFxuICBTU0VTdHJlYW1UYXJnZXQsXG59IGZyb20gXCIuL3NlcnZlcl9zZW50X2V2ZW50LnRzXCI7XG5pbXBvcnQgdHlwZSB7IFNlcnZlclNlbnRFdmVudFRhcmdldCB9IGZyb20gXCIuL3NlcnZlcl9zZW50X2V2ZW50LnRzXCI7XG5pbXBvcnQgdHlwZSB7IEVycm9yU3RhdHVzLCBVcGdyYWRlV2ViU29ja2V0T3B0aW9ucyB9IGZyb20gXCIuL3R5cGVzLmQudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDb250ZXh0U2VuZE9wdGlvbnMgZXh0ZW5kcyBTZW5kT3B0aW9ucyB7XG4gIC8qKiBUaGUgZmlsZW5hbWUgdG8gc2VuZCwgd2hpY2ggd2lsbCBiZSByZXNvbHZlZCBiYXNlZCBvbiB0aGUgb3RoZXIgb3B0aW9ucy5cbiAgICogSWYgdGhpcyBwcm9wZXJ0eSBpcyBvbWl0dGVkLCB0aGUgY3VycmVudCBjb250ZXh0J3MgYC5yZXF1ZXN0LnVybC5wYXRobmFtZWBcbiAgICogd2lsbCBiZSB1c2VkLiAqL1xuICBwYXRoPzogc3RyaW5nO1xufVxuXG4vKiogUHJvdmlkZXMgY29udGV4dCBhYm91dCB0aGUgY3VycmVudCByZXF1ZXN0IGFuZCByZXNwb25zZSB0byBtaWRkbGV3YXJlXG4gKiBmdW5jdGlvbnMuICovXG5leHBvcnQgY2xhc3MgQ29udGV4dDxcbiAgUyBleHRlbmRzIEFTID0gU3RhdGUsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIEFTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuPiB7XG4gICNzb2NrZXQ/OiBXZWJTb2NrZXQ7XG4gICNzc2U/OiBTZXJ2ZXJTZW50RXZlbnRUYXJnZXQ7XG5cbiAgLyoqIEEgcmVmZXJlbmNlIHRvIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uLiAqL1xuICBhcHA6IEFwcGxpY2F0aW9uPEFTPjtcblxuICAvKiogQW4gb2JqZWN0IHdoaWNoIGFsbG93cyBhY2Nlc3MgdG8gY29va2llcywgbWVkaWF0aW5nIGJvdGggdGhlIHJlcXVlc3QgYW5kXG4gICAqIHJlc3BvbnNlLiAqL1xuICBjb29raWVzOiBDb29raWVzO1xuXG4gIC8qKiBJcyBgdHJ1ZWAgaWYgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiBpcyB1cGdyYWRlYWJsZSB0byBhIHdlYiBzb2NrZXQuXG4gICAqIE90aGVyd2lzZSB0aGUgdmFsdWUgaXMgYGZhbHNlYC4gIFVzZSBgLnVwZ3JhZGUoKWAgdG8gdXBncmFkZSB0aGUgY29ubmVjdGlvblxuICAgKiBhbmQgcmV0dXJuIHRoZSB3ZWIgc29ja2V0LiAqL1xuICBnZXQgaXNVcGdyYWRhYmxlKCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHVwZ3JhZGUgPSB0aGlzLnJlcXVlc3QuaGVhZGVycy5nZXQoXCJ1cGdyYWRlXCIpO1xuICAgIGlmICghdXBncmFkZSB8fCB1cGdyYWRlLnRvTG93ZXJDYXNlKCkgIT09IFwid2Vic29ja2V0XCIpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3Qgc2VjS2V5ID0gdGhpcy5yZXF1ZXN0LmhlYWRlcnMuZ2V0KFwic2VjLXdlYnNvY2tldC1rZXlcIik7XG4gICAgcmV0dXJuIHR5cGVvZiBzZWNLZXkgPT09IFwic3RyaW5nXCIgJiYgc2VjS2V5ICE9IFwiXCI7XG4gIH1cblxuICAvKiogRGV0ZXJtaW5lcyBpZiB0aGUgcmVxdWVzdCBzaG91bGQgYmUgcmVzcG9uZGVkIHRvLiAgSWYgYGZhbHNlYCB3aGVuIHRoZVxuICAgKiBtaWRkbGV3YXJlIGNvbXBsZXRlcyBwcm9jZXNzaW5nLCB0aGUgcmVzcG9uc2Ugd2lsbCBub3QgYmUgc2VudCBiYWNrIHRvIHRoZVxuICAgKiByZXF1ZXN0b3IuICBUeXBpY2FsbHkgdGhpcyBpcyB1c2VkIGlmIHRoZSBtaWRkbGV3YXJlIHdpbGwgdGFrZSBvdmVyIGxvd1xuICAgKiBsZXZlbCBwcm9jZXNzaW5nIG9mIHJlcXVlc3RzIGFuZCByZXNwb25zZXMsIGZvciBleGFtcGxlIGlmIHVzaW5nIHdlYlxuICAgKiBzb2NrZXRzLiAgVGhpcyBhdXRvbWF0aWNhbGx5IGdldHMgc2V0IHRvIGBmYWxzZWAgd2hlbiB0aGUgY29udGV4dCBpc1xuICAgKiB1cGdyYWRlZCB0byBhIHdlYiBzb2NrZXQgdmlhIHRoZSBgLnVwZ3JhZGUoKWAgbWV0aG9kLlxuICAgKlxuICAgKiBUaGUgZGVmYXVsdCBpcyBgdHJ1ZWAuICovXG4gIHJlc3BvbmQ6IGJvb2xlYW47XG5cbiAgLyoqIEFuIG9iamVjdCB3aGljaCBjb250YWlucyBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY3VycmVudCByZXF1ZXN0LiAqL1xuICByZXF1ZXN0OiBSZXF1ZXN0O1xuXG4gIC8qKiBBbiBvYmplY3Qgd2hpY2ggY29udGFpbnMgaW5mb3JtYXRpb24gYWJvdXQgdGhlIHJlc3BvbnNlIHRoYXQgd2lsbCBiZSBzZW50XG4gICAqIHdoZW4gdGhlIG1pZGRsZXdhcmUgZmluaXNoZXMgcHJvY2Vzc2luZy4gKi9cbiAgcmVzcG9uc2U6IFJlc3BvbnNlO1xuXG4gIC8qKiBJZiB0aGUgdGhlIGN1cnJlbnQgY29udGV4dCBoYXMgYmVlbiB1cGdyYWRlZCwgdGhlbiB0aGlzIHdpbGwgYmUgc2V0IHRvXG4gICAqIHdpdGggdGhlIGN1cnJlbnQgd2ViIHNvY2tldCwgb3RoZXJ3aXNlIGl0IGlzIGB1bmRlZmluZWRgLiAqL1xuICBnZXQgc29ja2V0KCk6IFdlYlNvY2tldCB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuI3NvY2tldDtcbiAgfVxuXG4gIC8qKiBUaGUgb2JqZWN0IHRvIHBhc3Mgc3RhdGUgdG8gZnJvbnQtZW5kIHZpZXdzLiAgVGhpcyBjYW4gYmUgdHlwZWQgYnlcbiAgICogc3VwcGx5aW5nIHRoZSBnZW5lcmljIHN0YXRlIGFyZ3VtZW50IHdoZW4gY3JlYXRpbmcgYSBuZXcgYXBwLiAgRm9yXG4gICAqIGV4YW1wbGU6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbjx7IGZvbzogc3RyaW5nIH0+KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBPciBjYW4gYmUgY29udGV4dHVhbGx5IGluZmVycmVkIGJhc2VkIG9uIHNldHRpbmcgYW4gaW5pdGlhbCBzdGF0ZSBvYmplY3Q6XG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGNvbnN0IGFwcCA9IG5ldyBBcHBsaWNhdGlvbih7IHN0YXRlOiB7IGZvbzogXCJiYXJcIiB9IH0pO1xuICAgKiBgYGBcbiAgICpcbiAgICogT24gZWFjaCByZXF1ZXN0L3Jlc3BvbnNlIGN5Y2xlLCB0aGUgY29udGV4dCdzIHN0YXRlIGlzIGNsb25lZCBmcm9tIHRoZVxuICAgKiBhcHBsaWNhdGlvbiBzdGF0ZS4gVGhpcyBtZWFucyBjaGFuZ2VzIHRvIHRoZSBjb250ZXh0J3MgYC5zdGF0ZWAgd2lsbCBiZVxuICAgKiBkcm9wcGVkIHdoZW4gdGhlIHJlcXVlc3QgZHJvcHMsIGJ1dCBcImRlZmF1bHRzXCIgY2FuIGJlIGFwcGxpZWQgdG8gdGhlXG4gICAqIGFwcGxpY2F0aW9uJ3Mgc3RhdGUuICBDaGFuZ2VzIHRvIHRoZSBhcHBsaWNhdGlvbidzIHN0YXRlIHRob3VnaCB3b24ndCBiZVxuICAgKiByZWZsZWN0ZWQgdW50aWwgdGhlIG5leHQgcmVxdWVzdCBpbiB0aGUgY29udGV4dCdzIHN0YXRlLlxuICAgKi9cbiAgc3RhdGU6IFM7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHBsaWNhdGlvbjxBUz4sXG4gICAgc2VydmVyUmVxdWVzdDogTmF0aXZlUmVxdWVzdCxcbiAgICBzdGF0ZTogUyxcbiAgICBzZWN1cmUgPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5zdGF0ZSA9IHN0YXRlO1xuICAgIHRoaXMucmVxdWVzdCA9IG5ldyBSZXF1ZXN0KHNlcnZlclJlcXVlc3QsIGFwcC5wcm94eSwgc2VjdXJlKTtcbiAgICB0aGlzLnJlc3BvbmQgPSB0cnVlO1xuICAgIHRoaXMucmVzcG9uc2UgPSBuZXcgUmVzcG9uc2UodGhpcy5yZXF1ZXN0KTtcbiAgICB0aGlzLmNvb2tpZXMgPSBuZXcgQ29va2llcyh0aGlzLnJlcXVlc3QsIHRoaXMucmVzcG9uc2UsIHtcbiAgICAgIGtleXM6IHRoaXMuYXBwLmtleXMgYXMgS2V5U3RhY2sgfCB1bmRlZmluZWQsXG4gICAgICBzZWN1cmU6IHRoaXMucmVxdWVzdC5zZWN1cmUsXG4gICAgfSk7XG4gIH1cblxuICAvKiogQXNzZXJ0cyB0aGUgY29uZGl0aW9uIGFuZCBpZiB0aGUgY29uZGl0aW9uIGZhaWxzLCBjcmVhdGVzIGFuIEhUVFAgZXJyb3JcbiAgICogd2l0aCB0aGUgcHJvdmlkZWQgc3RhdHVzICh3aGljaCBkZWZhdWx0cyB0byBgNTAwYCkuICBUaGUgZXJyb3Igc3RhdHVzIGJ5XG4gICAqIGRlZmF1bHQgd2lsbCBiZSBzZXQgb24gdGhlIGAucmVzcG9uc2Uuc3RhdHVzYC5cbiAgICovXG4gIGFzc2VydChcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGNvbmRpdGlvbjogYW55LFxuICAgIGVycm9yU3RhdHVzOiBFcnJvclN0YXR1cyA9IDUwMCxcbiAgICBtZXNzYWdlPzogc3RyaW5nLFxuICAgIHByb3BzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gICk6IGFzc2VydHMgY29uZGl0aW9uIHtcbiAgICBpZiAoY29uZGl0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGVyciA9IGNyZWF0ZUh0dHBFcnJvcihlcnJvclN0YXR1cywgbWVzc2FnZSk7XG4gICAgaWYgKHByb3BzKSB7XG4gICAgICBPYmplY3QuYXNzaWduKGVyciwgcHJvcHMpO1xuICAgIH1cbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICAvKiogQXN5bmNocm9ub3VzbHkgZnVsZmlsbCBhIHJlc3BvbnNlIHdpdGggYSBmaWxlIGZyb20gdGhlIGxvY2FsIGZpbGVcbiAgICogc3lzdGVtLlxuICAgKlxuICAgKiBJZiB0aGUgYG9wdGlvbnMucGF0aGAgaXMgbm90IHN1cHBsaWVkLCB0aGUgZmlsZSB0byBiZSBzZW50IHdpbGwgZGVmYXVsdFxuICAgKiB0byB0aGlzIGAucmVxdWVzdC51cmwucGF0aG5hbWVgLlxuICAgKlxuICAgKiBSZXF1aXJlcyBEZW5vIHJlYWQgcGVybWlzc2lvbi4gKi9cbiAgc2VuZChvcHRpb25zOiBDb250ZXh0U2VuZE9wdGlvbnMpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHsgcGF0aCA9IHRoaXMucmVxdWVzdC51cmwucGF0aG5hbWUsIC4uLnNlbmRPcHRpb25zIH0gPSBvcHRpb25zO1xuICAgIHJldHVybiBzZW5kKHRoaXMsIHBhdGgsIHNlbmRPcHRpb25zKTtcbiAgfVxuXG4gIC8qKiBDb252ZXJ0IHRoZSBjb25uZWN0aW9uIHRvIHN0cmVhbSBldmVudHMsIHJldHVybmluZyBhbiBldmVudCB0YXJnZXQgZm9yXG4gICAqIHNlbmRpbmcgc2VydmVyIHNlbnQgZXZlbnRzLiAgRXZlbnRzIGRpc3BhdGNoZWQgb24gdGhlIHJldHVybmVkIHRhcmdldCB3aWxsXG4gICAqIGJlIHNlbnQgdG8gdGhlIGNsaWVudCBhbmQgYmUgYXZhaWxhYmxlIGluIHRoZSBjbGllbnQncyBgRXZlbnRTb3VyY2VgIHRoYXRcbiAgICogaW5pdGlhdGVkIHRoZSBjb25uZWN0aW9uLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgc2V0IGAucmVzcG9uZGAgdG8gYGZhbHNlYC4gKi9cbiAgc2VuZEV2ZW50cyhvcHRpb25zPzogU2VydmVyU2VudEV2ZW50VGFyZ2V0T3B0aW9ucyk6IFNlcnZlclNlbnRFdmVudFRhcmdldCB7XG4gICAgaWYgKCF0aGlzLiNzc2UpIHtcbiAgICAgIHRoaXMuI3NzZSA9IG5ldyBTU0VTdHJlYW1UYXJnZXQodGhpcywgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiNzc2U7XG4gIH1cblxuICAvKiogQ3JlYXRlIGFuZCB0aHJvdyBhbiBIVFRQIEVycm9yLCB3aGljaCBjYW4gYmUgdXNlZCB0byBwYXNzIHN0YXR1c1xuICAgKiBpbmZvcm1hdGlvbiB3aGljaCBjYW4gYmUgY2F1Z2h0IGJ5IG90aGVyIG1pZGRsZXdhcmUgdG8gc2VuZCBtb3JlXG4gICAqIG1lYW5pbmdmdWwgZXJyb3IgbWVzc2FnZXMgYmFjayB0byB0aGUgY2xpZW50LiAgVGhlIHBhc3NlZCBlcnJvciBzdGF0dXMgd2lsbFxuICAgKiBiZSBzZXQgb24gdGhlIGAucmVzcG9uc2Uuc3RhdHVzYCBieSBkZWZhdWx0IGFzIHdlbGwuXG4gICAqL1xuICB0aHJvdyhcbiAgICBlcnJvclN0YXR1czogRXJyb3JTdGF0dXMsXG4gICAgbWVzc2FnZT86IHN0cmluZyxcbiAgICBwcm9wcz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICApOiBuZXZlciB7XG4gICAgY29uc3QgZXJyID0gY3JlYXRlSHR0cEVycm9yKGVycm9yU3RhdHVzLCBtZXNzYWdlKTtcbiAgICBpZiAocHJvcHMpIHtcbiAgICAgIE9iamVjdC5hc3NpZ24oZXJyLCBwcm9wcyk7XG4gICAgfVxuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIC8qKiBUYWtlIHRoZSBjdXJyZW50IHJlcXVlc3QgYW5kIHVwZ3JhZGUgaXQgdG8gYSB3ZWIgc29ja2V0LCByZXNvbHZpbmcgd2l0aFxuICAgKiB0aGUgYSB3ZWIgc3RhbmRhcmQgYFdlYlNvY2tldGAgb2JqZWN0LiBUaGlzIHdpbGwgc2V0IGAucmVzcG9uZGAgdG9cbiAgICogYGZhbHNlYC4gIElmIHRoZSBzb2NrZXQgY2Fubm90IGJlIHVwZ3JhZGVkLCB0aGlzIG1ldGhvZCB3aWxsIHRocm93LiAqL1xuICB1cGdyYWRlKG9wdGlvbnM/OiBVcGdyYWRlV2ViU29ja2V0T3B0aW9ucyk6IFdlYlNvY2tldCB7XG4gICAgaWYgKHRoaXMuI3NvY2tldCkge1xuICAgICAgcmV0dXJuIHRoaXMuI3NvY2tldDtcbiAgICB9XG4gICAgdGhpcy4jc29ja2V0ID0gdGhpcy5yZXF1ZXN0Lm9yaWdpbmFsUmVxdWVzdC51cGdyYWRlKG9wdGlvbnMpO1xuICAgIHRoaXMucmVzcG9uZCA9IGZhbHNlO1xuICAgIHJldHVybiB0aGlzLiNzb2NrZXQ7XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIkRlbm8uY3VzdG9tSW5zcGVjdFwiKV0oaW5zcGVjdDogKHZhbHVlOiB1bmtub3duKSA9PiBzdHJpbmcpIHtcbiAgICBjb25zdCB7XG4gICAgICBhcHAsXG4gICAgICBjb29raWVzLFxuICAgICAgaXNVcGdyYWRhYmxlLFxuICAgICAgcmVzcG9uZCxcbiAgICAgIHJlcXVlc3QsXG4gICAgICByZXNwb25zZSxcbiAgICAgIHNvY2tldCxcbiAgICAgIHN0YXRlLFxuICAgIH0gPSB0aGlzO1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHtcbiAgICAgICAgYXBwLFxuICAgICAgICBjb29raWVzLFxuICAgICAgICBpc1VwZ3JhZGFibGUsXG4gICAgICAgIHJlc3BvbmQsXG4gICAgICAgIHJlcXVlc3QsXG4gICAgICAgIHJlc3BvbnNlLFxuICAgICAgICBzb2NrZXQsXG4gICAgICAgIHN0YXRlLFxuICAgICAgfSlcbiAgICB9YDtcbiAgfVxufVxuIl19