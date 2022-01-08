import { RequestBody } from "./body.ts";
import { preferredCharsets } from "./negotiation/charset.ts";
import { preferredEncodings } from "./negotiation/encoding.ts";
import { preferredLanguages } from "./negotiation/language.ts";
import { preferredMediaTypes } from "./negotiation/mediaType.ts";
export class Request {
    #body;
    #proxy;
    #secure;
    #serverRequest;
    #url;
    #getRemoteAddr() {
        return this.#serverRequest.remoteAddr ?? "";
    }
    get hasBody() {
        return this.#body.has();
    }
    get headers() {
        return this.#serverRequest.headers;
    }
    get ip() {
        return (this.#proxy ? this.ips[0] : this.#getRemoteAddr()) ?? "";
    }
    get ips() {
        return this.#proxy
            ? (this.#serverRequest.headers.get("x-forwarded-for") ??
                this.#getRemoteAddr()).split(/\s*,\s*/)
            : [];
    }
    get method() {
        return this.#serverRequest.method;
    }
    get secure() {
        return this.#secure;
    }
    get originalRequest() {
        return this.#serverRequest;
    }
    get url() {
        if (!this.#url) {
            const serverRequest = this.#serverRequest;
            if (!this.#proxy) {
                try {
                    this.#url = new URL(serverRequest.rawUrl);
                    return this.#url;
                }
                catch {
                }
            }
            let proto;
            let host;
            if (this.#proxy) {
                proto = serverRequest
                    .headers.get("x-forwarded-proto")?.split(/\s*,\s*/, 1)[0] ??
                    "http";
                host = serverRequest.headers.get("x-forwarded-host") ??
                    serverRequest.headers.get("host") ?? "";
            }
            else {
                proto = this.#secure ? "https" : "http";
                host = serverRequest.headers.get("host") ?? "";
            }
            try {
                this.#url = new URL(`${proto}://${host}${serverRequest.url}`);
            }
            catch {
                throw new TypeError(`The server request URL of "${proto}://${host}${serverRequest.url}" is invalid.`);
            }
        }
        return this.#url;
    }
    constructor(serverRequest, proxy = false, secure = false) {
        this.#proxy = proxy;
        this.#secure = secure;
        this.#serverRequest = serverRequest;
        this.#body = new RequestBody(serverRequest.request);
    }
    accepts(...types) {
        const acceptValue = this.#serverRequest.headers.get("Accept");
        if (!acceptValue) {
            return;
        }
        if (types.length) {
            return preferredMediaTypes(acceptValue, types)[0];
        }
        return preferredMediaTypes(acceptValue);
    }
    acceptsCharsets(...charsets) {
        const acceptCharsetValue = this.#serverRequest.headers.get("Accept-Charset");
        if (!acceptCharsetValue) {
            return;
        }
        if (charsets.length) {
            return preferredCharsets(acceptCharsetValue, charsets)[0];
        }
        return preferredCharsets(acceptCharsetValue);
    }
    acceptsEncodings(...encodings) {
        const acceptEncodingValue = this.#serverRequest.headers.get("Accept-Encoding");
        if (!acceptEncodingValue) {
            return;
        }
        if (encodings.length) {
            return preferredEncodings(acceptEncodingValue, encodings)[0];
        }
        return preferredEncodings(acceptEncodingValue);
    }
    acceptsLanguages(...langs) {
        const acceptLanguageValue = this.#serverRequest.headers.get("Accept-Language");
        if (!acceptLanguageValue) {
            return;
        }
        if (langs.length) {
            return preferredLanguages(acceptLanguageValue, langs)[0];
        }
        return preferredLanguages(acceptLanguageValue);
    }
    body(options = {}) {
        return this.#body.get(options);
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        const { hasBody, headers, ip, ips, method, secure, url } = this;
        return `Request ${inspect({
            hasBody,
            headers,
            ip,
            ips,
            method,
            secure,
            url: url.toString(),
        })}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJlcXVlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBYUEsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUd4QyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUM3RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUMvRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUdqRSxNQUFNLE9BQU8sT0FBTztJQUNsQixLQUFLLENBQWM7SUFDbkIsTUFBTSxDQUFVO0lBQ2hCLE9BQU8sQ0FBVTtJQUNqQixjQUFjLENBQWdCO0lBQzlCLElBQUksQ0FBTztJQUVYLGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0lBVUQsSUFBSSxPQUFPO1FBQ1QsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQzFCLENBQUM7SUFHRCxJQUFJLE9BQU87UUFDVCxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDO0lBQ3JDLENBQUM7SUFLRCxJQUFJLEVBQUU7UUFDSixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ25FLENBQUM7SUFLRCxJQUFJLEdBQUc7UUFDTCxPQUFPLElBQUksQ0FBQyxNQUFNO1lBQ2hCLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQztnQkFD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QyxDQUFDO0lBQ2pELENBQUM7SUFVRCxJQUFJLENBQUMsVUFBdUIsRUFBRTtRQUM1QixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLE9BQW1DO1FBQ3BFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDaEUsT0FBTyxXQUNMLE9BQU8sQ0FBQztZQUNOLE9BQU87WUFDUCxPQUFPO1lBQ1AsRUFBRTtZQUNGLEdBQUc7WUFDSCxNQUFNO1lBQ04sTUFBTTtZQUNOLEdBQUcsRUFBRSxHQUFHLENBQUMsUUFBUSxFQUFFO1NBQ3BCLENBQ0gsRUFBRSxDQUFDO0lBQ0wsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgb2FrIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7XG4gIEJvZHksXG4gIEJvZHlCeXRlcyxcbiAgQm9keUZvcm0sXG4gIEJvZHlGb3JtRGF0YSxcbiAgQm9keUpzb24sXG4gIEJvZHlPcHRpb25zLFxuICBCb2R5UmVhZGVyLFxuICBCb2R5U3RyZWFtLFxuICBCb2R5VGV4dCxcbn0gZnJvbSBcIi4vYm9keS50c1wiO1xuaW1wb3J0IHsgUmVxdWVzdEJvZHkgfSBmcm9tIFwiLi9ib2R5LnRzXCI7XG5pbXBvcnQgdHlwZSB7IE5hdGl2ZVJlcXVlc3QgfSBmcm9tIFwiLi9odHRwX3NlcnZlcl9uYXRpdmUudHNcIjtcbmltcG9ydCB0eXBlIHsgSFRUUE1ldGhvZHMgfSBmcm9tIFwiLi90eXBlcy5kLnRzXCI7XG5pbXBvcnQgeyBwcmVmZXJyZWRDaGFyc2V0cyB9IGZyb20gXCIuL25lZ290aWF0aW9uL2NoYXJzZXQudHNcIjtcbmltcG9ydCB7IHByZWZlcnJlZEVuY29kaW5ncyB9IGZyb20gXCIuL25lZ290aWF0aW9uL2VuY29kaW5nLnRzXCI7XG5pbXBvcnQgeyBwcmVmZXJyZWRMYW5ndWFnZXMgfSBmcm9tIFwiLi9uZWdvdGlhdGlvbi9sYW5ndWFnZS50c1wiO1xuaW1wb3J0IHsgcHJlZmVycmVkTWVkaWFUeXBlcyB9IGZyb20gXCIuL25lZ290aWF0aW9uL21lZGlhVHlwZS50c1wiO1xuXG4vKiogQW4gaW50ZXJmYWNlIHdoaWNoIHByb3ZpZGVzIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjdXJyZW50IHJlcXVlc3QuICovXG5leHBvcnQgY2xhc3MgUmVxdWVzdCB7XG4gICNib2R5OiBSZXF1ZXN0Qm9keTtcbiAgI3Byb3h5OiBib29sZWFuO1xuICAjc2VjdXJlOiBib29sZWFuO1xuICAjc2VydmVyUmVxdWVzdDogTmF0aXZlUmVxdWVzdDtcbiAgI3VybD86IFVSTDtcblxuICAjZ2V0UmVtb3RlQWRkcigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLiNzZXJ2ZXJSZXF1ZXN0LnJlbW90ZUFkZHIgPz8gXCJcIjtcbiAgfVxuXG4gIC8qKiBJcyBgdHJ1ZWAgaWYgdGhlIHJlcXVlc3QgbWlnaHQgaGF2ZSBhIGJvZHksIG90aGVyd2lzZSBgZmFsc2VgLlxuICAgKlxuICAgKiAqKldBUk5JTkcqKiB0aGlzIGlzIGFuIHVucmVsaWFibGUgQVBJLiBJbiBIVFRQLzIgaW4gbWFueSBzaXR1YXRpb25zIHlvdVxuICAgKiBjYW5ub3QgZGV0ZXJtaW5lIGlmIGEgcmVxdWVzdCBoYXMgYSBib2R5IG9yIG5vdCB1bmxlc3MgeW91IGF0dGVtcHQgdG8gcmVhZFxuICAgKiB0aGUgYm9keSwgZHVlIHRvIHRoZSBzdHJlYW1pbmcgbmF0dXJlIG9mIEhUVFAvMi4gQXMgb2YgRGVubyAxLjE2LjEsIGZvclxuICAgKiBIVFRQLzEuMSwgRGVubyBhbHNvIHJlZmxlY3RzIHRoYXQgYmVoYXZpb3VyLiAgVGhlIG9ubHkgcmVsaWFibGUgd2F5IHRvXG4gICAqIGRldGVybWluZSBpZiBhIHJlcXVlc3QgaGFzIGEgYm9keSBvciBub3QgaXMgdG8gYXR0ZW1wdCB0byByZWFkIHRoZSBib2R5LlxuICAgKi9cbiAgZ2V0IGhhc0JvZHkoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuI2JvZHkuaGFzKCk7XG4gIH1cblxuICAvKiogVGhlIGBIZWFkZXJzYCBzdXBwbGllZCBpbiB0aGUgcmVxdWVzdC4gKi9cbiAgZ2V0IGhlYWRlcnMoKTogSGVhZGVycyB7XG4gICAgcmV0dXJuIHRoaXMuI3NlcnZlclJlcXVlc3QuaGVhZGVycztcbiAgfVxuXG4gIC8qKiBSZXF1ZXN0IHJlbW90ZSBhZGRyZXNzLiBXaGVuIHRoZSBhcHBsaWNhdGlvbidzIGAucHJveHlgIGlzIHRydWUsIHRoZVxuICAgKiBgWC1Gb3J3YXJkZWQtRm9yYCB3aWxsIGJlIHVzZWQgdG8gZGV0ZXJtaW5lIHRoZSByZXF1ZXN0aW5nIHJlbW90ZSBhZGRyZXNzLlxuICAgKi9cbiAgZ2V0IGlwKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuICh0aGlzLiNwcm94eSA/IHRoaXMuaXBzWzBdIDogdGhpcy4jZ2V0UmVtb3RlQWRkcigpKSA/PyBcIlwiO1xuICB9XG5cbiAgLyoqIFdoZW4gdGhlIGFwcGxpY2F0aW9uJ3MgYC5wcm94eWAgaXMgYHRydWVgLCB0aGlzIHdpbGwgYmUgc2V0IHRvIGFuIGFycmF5IG9mXG4gICAqIElQcywgb3JkZXJlZCBmcm9tIHVwc3RyZWFtIHRvIGRvd25zdHJlYW0sIGJhc2VkIG9uIHRoZSB2YWx1ZSBvZiB0aGUgaGVhZGVyXG4gICAqIGBYLUZvcndhcmRlZC1Gb3JgLiAgV2hlbiBgZmFsc2VgIGFuIGVtcHR5IGFycmF5IGlzIHJldHVybmVkLiAqL1xuICBnZXQgaXBzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy4jcHJveHlcbiAgICAgID8gKHRoaXMuI3NlcnZlclJlcXVlc3QuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1mb3JcIikgPz9cbiAgICAgICAgdGhpcy4jZ2V0UmVtb3RlQWRkcigpKS5zcGxpdCgvXFxzKixcXHMqLylcbiAgICAgIDogW107XG4gIH1cblxuICAvKiogVGhlIEhUVFAgTWV0aG9kIHVzZWQgYnkgdGhlIHJlcXVlc3QuICovXG4gIGdldCBtZXRob2QoKTogSFRUUE1ldGhvZHMge1xuICAgIHJldHVybiB0aGlzLiNzZXJ2ZXJSZXF1ZXN0Lm1ldGhvZCBhcyBIVFRQTWV0aG9kcztcbiAgfVxuXG4gIC8qKiBTaG9ydGN1dCB0byBgcmVxdWVzdC51cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCJgLiAqL1xuICBnZXQgc2VjdXJlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLiNzZWN1cmU7XG4gIH1cblxuICAvKiogU2V0IHRvIHRoZSB2YWx1ZSBvZiB0aGUgX29yaWdpbmFsXyBEZW5vIHNlcnZlciByZXF1ZXN0LiAqL1xuICBnZXQgb3JpZ2luYWxSZXF1ZXN0KCk6IE5hdGl2ZVJlcXVlc3Qge1xuICAgIHJldHVybiB0aGlzLiNzZXJ2ZXJSZXF1ZXN0O1xuICB9XG5cbiAgLyoqIEEgcGFyc2VkIFVSTCBmb3IgdGhlIHJlcXVlc3Qgd2hpY2ggY29tcGxpZXMgd2l0aCB0aGUgYnJvd3NlciBzdGFuZGFyZHMuXG4gICAqIFdoZW4gdGhlIGFwcGxpY2F0aW9uJ3MgYC5wcm94eWAgaXMgYHRydWVgLCB0aGlzIHZhbHVlIHdpbGwgYmUgYmFzZWQgb2ZmIG9mXG4gICAqIHRoZSBgWC1Gb3J3YXJkZWQtUHJvdG9gIGFuZCBgWC1Gb3J3YXJkZWQtSG9zdGAgaGVhZGVyIHZhbHVlcyBpZiBwcmVzZW50IGluXG4gICAqIHRoZSByZXF1ZXN0LiAqL1xuICBnZXQgdXJsKCk6IFVSTCB7XG4gICAgaWYgKCF0aGlzLiN1cmwpIHtcbiAgICAgIGNvbnN0IHNlcnZlclJlcXVlc3QgPSB0aGlzLiNzZXJ2ZXJSZXF1ZXN0O1xuICAgICAgaWYgKCF0aGlzLiNwcm94eSkge1xuICAgICAgICAvLyBiZXR3ZWVuIDEuOS4wIGFuZCAxLjkuMSB0aGUgcmVxdWVzdC51cmwgb2YgdGhlIG5hdGl2ZSBIVFRQIHN0YXJ0ZWRcbiAgICAgICAgLy8gcmV0dXJuaW5nIHRoZSBmdWxsIFVSTCwgd2hlcmUgcHJldmlvdXNseSBpdCBvbmx5IHJldHVybmVkIHRoZSBwYXRoXG4gICAgICAgIC8vIHNvIHdlIHdpbGwgdHJ5IHRvIHVzZSB0aGF0IFVSTCBoZXJlLCBidXQgZGVmYXVsdCBiYWNrIHRvIG9sZCBsb2dpY1xuICAgICAgICAvLyBpZiB0aGUgVVJMIGlzbid0IHZhbGlkLlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMuI3VybCA9IG5ldyBVUkwoc2VydmVyUmVxdWVzdC5yYXdVcmwpO1xuICAgICAgICAgIHJldHVybiB0aGlzLiN1cmw7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgZXJyb3JzIGhlcmVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV0IHByb3RvOiBzdHJpbmc7XG4gICAgICBsZXQgaG9zdDogc3RyaW5nO1xuICAgICAgaWYgKHRoaXMuI3Byb3h5KSB7XG4gICAgICAgIHByb3RvID0gc2VydmVyUmVxdWVzdFxuICAgICAgICAgIC5oZWFkZXJzLmdldChcIngtZm9yd2FyZGVkLXByb3RvXCIpPy5zcGxpdCgvXFxzKixcXHMqLywgMSlbMF0gPz9cbiAgICAgICAgICBcImh0dHBcIjtcbiAgICAgICAgaG9zdCA9IHNlcnZlclJlcXVlc3QuaGVhZGVycy5nZXQoXCJ4LWZvcndhcmRlZC1ob3N0XCIpID8/XG4gICAgICAgICAgc2VydmVyUmVxdWVzdC5oZWFkZXJzLmdldChcImhvc3RcIikgPz8gXCJcIjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHByb3RvID0gdGhpcy4jc2VjdXJlID8gXCJodHRwc1wiIDogXCJodHRwXCI7XG4gICAgICAgIGhvc3QgPSBzZXJ2ZXJSZXF1ZXN0LmhlYWRlcnMuZ2V0KFwiaG9zdFwiKSA/PyBcIlwiO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgdGhpcy4jdXJsID0gbmV3IFVSTChgJHtwcm90b306Ly8ke2hvc3R9JHtzZXJ2ZXJSZXF1ZXN0LnVybH1gKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBUaGUgc2VydmVyIHJlcXVlc3QgVVJMIG9mIFwiJHtwcm90b306Ly8ke2hvc3R9JHtzZXJ2ZXJSZXF1ZXN0LnVybH1cIiBpcyBpbnZhbGlkLmAsXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLiN1cmw7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICBzZXJ2ZXJSZXF1ZXN0OiBOYXRpdmVSZXF1ZXN0LFxuICAgIHByb3h5ID0gZmFsc2UsXG4gICAgc2VjdXJlID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuI3Byb3h5ID0gcHJveHk7XG4gICAgdGhpcy4jc2VjdXJlID0gc2VjdXJlO1xuICAgIHRoaXMuI3NlcnZlclJlcXVlc3QgPSBzZXJ2ZXJSZXF1ZXN0O1xuICAgIHRoaXMuI2JvZHkgPSBuZXcgUmVxdWVzdEJvZHkoc2VydmVyUmVxdWVzdC5yZXF1ZXN0KTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIGFuIGFycmF5IG9mIG1lZGlhIHR5cGVzLCBhY2NlcHRlZCBieSB0aGUgcmVxdWVzdG9yLCBpbiBvcmRlciBvZlxuICAgKiBwcmVmZXJlbmNlLiAgSWYgdGhlcmUgYXJlIG5vIGVuY29kaW5ncyBzdXBwbGllZCBieSB0aGUgcmVxdWVzdG9yLFxuICAgKiBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC5cbiAgICovXG4gIGFjY2VwdHMoKTogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gIC8qKiBGb3IgYSBnaXZlbiBzZXQgb2YgbWVkaWEgdHlwZXMsIHJldHVybiB0aGUgYmVzdCBtYXRjaCBhY2NlcHRlZCBieSB0aGVcbiAgICogcmVxdWVzdG9yLiAgSWYgdGhlcmUgYXJlIG5vIGVuY29kaW5nIHRoYXQgbWF0Y2gsIHRoZW4gdGhlIG1ldGhvZCByZXR1cm5zXG4gICAqIGB1bmRlZmluZWRgLlxuICAgKi9cbiAgYWNjZXB0cyguLi50eXBlczogc3RyaW5nW10pOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIGFjY2VwdHMoLi4udHlwZXM6IHN0cmluZ1tdKTogc3RyaW5nIHwgc3RyaW5nW10gfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGFjY2VwdFZhbHVlID0gdGhpcy4jc2VydmVyUmVxdWVzdC5oZWFkZXJzLmdldChcIkFjY2VwdFwiKTtcbiAgICBpZiAoIWFjY2VwdFZhbHVlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0eXBlcy5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBwcmVmZXJyZWRNZWRpYVR5cGVzKGFjY2VwdFZhbHVlLCB0eXBlcylbMF07XG4gICAgfVxuICAgIHJldHVybiBwcmVmZXJyZWRNZWRpYVR5cGVzKGFjY2VwdFZhbHVlKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIGFuIGFycmF5IG9mIGNoYXJzZXRzLCBhY2NlcHRlZCBieSB0aGUgcmVxdWVzdG9yLCBpbiBvcmRlciBvZlxuICAgKiBwcmVmZXJlbmNlLiAgSWYgdGhlcmUgYXJlIG5vIGNoYXJzZXRzIHN1cHBsaWVkIGJ5IHRoZSByZXF1ZXN0b3IsXG4gICAqIGB1bmRlZmluZWRgIGlzIHJldHVybmVkLlxuICAgKi9cbiAgYWNjZXB0c0NoYXJzZXRzKCk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuICAvKiogRm9yIGEgZ2l2ZW4gc2V0IG9mIGNoYXJzZXRzLCByZXR1cm4gdGhlIGJlc3QgbWF0Y2ggYWNjZXB0ZWQgYnkgdGhlXG4gICAqIHJlcXVlc3Rvci4gIElmIHRoZXJlIGFyZSBubyBjaGFyc2V0cyB0aGF0IG1hdGNoLCB0aGVuIHRoZSBtZXRob2QgcmV0dXJuc1xuICAgKiBgdW5kZWZpbmVkYC4gKi9cbiAgYWNjZXB0c0NoYXJzZXRzKC4uLmNoYXJzZXRzOiBzdHJpbmdbXSk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgYWNjZXB0c0NoYXJzZXRzKC4uLmNoYXJzZXRzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBhY2NlcHRDaGFyc2V0VmFsdWUgPSB0aGlzLiNzZXJ2ZXJSZXF1ZXN0LmhlYWRlcnMuZ2V0KFxuICAgICAgXCJBY2NlcHQtQ2hhcnNldFwiLFxuICAgICk7XG4gICAgaWYgKCFhY2NlcHRDaGFyc2V0VmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGNoYXJzZXRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHByZWZlcnJlZENoYXJzZXRzKGFjY2VwdENoYXJzZXRWYWx1ZSwgY2hhcnNldHMpWzBdO1xuICAgIH1cbiAgICByZXR1cm4gcHJlZmVycmVkQ2hhcnNldHMoYWNjZXB0Q2hhcnNldFZhbHVlKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIGFuIGFycmF5IG9mIGVuY29kaW5ncywgYWNjZXB0ZWQgYnkgdGhlIHJlcXVlc3RvciwgaW4gb3JkZXIgb2ZcbiAgICogcHJlZmVyZW5jZS4gIElmIHRoZXJlIGFyZSBubyBlbmNvZGluZ3Mgc3VwcGxpZWQgYnkgdGhlIHJlcXVlc3RvcixcbiAgICogYHVuZGVmaW5lZGAgaXMgcmV0dXJuZWQuXG4gICAqL1xuICBhY2NlcHRzRW5jb2RpbmdzKCk6IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuICAvKiogRm9yIGEgZ2l2ZW4gc2V0IG9mIGVuY29kaW5ncywgcmV0dXJuIHRoZSBiZXN0IG1hdGNoIGFjY2VwdGVkIGJ5IHRoZVxuICAgKiByZXF1ZXN0b3IuICBJZiB0aGVyZSBhcmUgbm8gZW5jb2RpbmdzIHRoYXQgbWF0Y2gsIHRoZW4gdGhlIG1ldGhvZCByZXR1cm5zXG4gICAqIGB1bmRlZmluZWRgLlxuICAgKlxuICAgKiAqKk5PVEU6KiogWW91IHNob3VsZCBhbHdheXMgc3VwcGx5IGBpZGVudGl0eWAgYXMgb25lIG9mIHRoZSBlbmNvZGluZ3NcbiAgICogdG8gZW5zdXJlIHRoYXQgdGhlcmUgaXMgYSBtYXRjaCB3aGVuIHRoZSBgQWNjZXB0LUVuY29kaW5nYCBoZWFkZXIgaXMgcGFydFxuICAgKiBvZiB0aGUgcmVxdWVzdC5cbiAgICovXG4gIGFjY2VwdHNFbmNvZGluZ3MoLi4uZW5jb2RpbmdzOiBzdHJpbmdbXSk6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgYWNjZXB0c0VuY29kaW5ncyguLi5lbmNvZGluZ3M6IHN0cmluZ1tdKTogc3RyaW5nW10gfCBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IGFjY2VwdEVuY29kaW5nVmFsdWUgPSB0aGlzLiNzZXJ2ZXJSZXF1ZXN0LmhlYWRlcnMuZ2V0KFxuICAgICAgXCJBY2NlcHQtRW5jb2RpbmdcIixcbiAgICApO1xuICAgIGlmICghYWNjZXB0RW5jb2RpbmdWYWx1ZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoZW5jb2RpbmdzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHByZWZlcnJlZEVuY29kaW5ncyhhY2NlcHRFbmNvZGluZ1ZhbHVlLCBlbmNvZGluZ3MpWzBdO1xuICAgIH1cbiAgICByZXR1cm4gcHJlZmVycmVkRW5jb2RpbmdzKGFjY2VwdEVuY29kaW5nVmFsdWUpO1xuICB9XG5cbiAgLyoqIFJldHVybnMgYW4gYXJyYXkgb2YgbGFuZ3VhZ2VzLCBhY2NlcHRlZCBieSB0aGUgcmVxdWVzdG9yLCBpbiBvcmRlciBvZlxuICAgKiBwcmVmZXJlbmNlLiAgSWYgdGhlcmUgYXJlIG5vIGxhbmd1YWdlcyBzdXBwbGllZCBieSB0aGUgcmVxdWVzdG9yLFxuICAgKiBgdW5kZWZpbmVkYCBpcyByZXR1cm5lZC5cbiAgICovXG4gIGFjY2VwdHNMYW5ndWFnZXMoKTogc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gIC8qKiBGb3IgYSBnaXZlbiBzZXQgb2YgbGFuZ3VhZ2VzLCByZXR1cm4gdGhlIGJlc3QgbWF0Y2ggYWNjZXB0ZWQgYnkgdGhlXG4gICAqIHJlcXVlc3Rvci4gIElmIHRoZXJlIGFyZSBubyBsYW5ndWFnZXMgdGhhdCBtYXRjaCwgdGhlbiB0aGUgbWV0aG9kIHJldHVybnNcbiAgICogYHVuZGVmaW5lZGAuICovXG4gIGFjY2VwdHNMYW5ndWFnZXMoLi4ubGFuZ3M6IHN0cmluZ1tdKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBhY2NlcHRzTGFuZ3VhZ2VzKC4uLmxhbmdzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBhY2NlcHRMYW5ndWFnZVZhbHVlID0gdGhpcy4jc2VydmVyUmVxdWVzdC5oZWFkZXJzLmdldChcbiAgICAgIFwiQWNjZXB0LUxhbmd1YWdlXCIsXG4gICAgKTtcbiAgICBpZiAoIWFjY2VwdExhbmd1YWdlVmFsdWUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGxhbmdzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHByZWZlcnJlZExhbmd1YWdlcyhhY2NlcHRMYW5ndWFnZVZhbHVlLCBsYW5ncylbMF07XG4gICAgfVxuICAgIHJldHVybiBwcmVmZXJyZWRMYW5ndWFnZXMoYWNjZXB0TGFuZ3VhZ2VWYWx1ZSk7XG4gIH1cblxuICBib2R5KG9wdGlvbnM6IEJvZHlPcHRpb25zPFwiYnl0ZXNcIj4pOiBCb2R5Qnl0ZXM7XG4gIGJvZHkob3B0aW9uczogQm9keU9wdGlvbnM8XCJmb3JtXCI+KTogQm9keUZvcm07XG4gIGJvZHkob3B0aW9uczogQm9keU9wdGlvbnM8XCJmb3JtLWRhdGFcIj4pOiBCb2R5Rm9ybURhdGE7XG4gIGJvZHkob3B0aW9uczogQm9keU9wdGlvbnM8XCJqc29uXCI+KTogQm9keUpzb247XG4gIGJvZHkob3B0aW9uczogQm9keU9wdGlvbnM8XCJyZWFkZXJcIj4pOiBCb2R5UmVhZGVyO1xuICBib2R5KG9wdGlvbnM6IEJvZHlPcHRpb25zPFwic3RyZWFtXCI+KTogQm9keVN0cmVhbTtcbiAgYm9keShvcHRpb25zOiBCb2R5T3B0aW9uczxcInRleHRcIj4pOiBCb2R5VGV4dDtcbiAgYm9keShvcHRpb25zPzogQm9keU9wdGlvbnMpOiBCb2R5O1xuICBib2R5KG9wdGlvbnM6IEJvZHlPcHRpb25zID0ge30pOiBCb2R5IHwgQm9keVJlYWRlciB8IEJvZHlTdHJlYW0ge1xuICAgIHJldHVybiB0aGlzLiNib2R5LmdldChvcHRpb25zKTtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXShpbnNwZWN0OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZykge1xuICAgIGNvbnN0IHsgaGFzQm9keSwgaGVhZGVycywgaXAsIGlwcywgbWV0aG9kLCBzZWN1cmUsIHVybCB9ID0gdGhpcztcbiAgICByZXR1cm4gYFJlcXVlc3QgJHtcbiAgICAgIGluc3BlY3Qoe1xuICAgICAgICBoYXNCb2R5LFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgICBpcCxcbiAgICAgICAgaXBzLFxuICAgICAgICBtZXRob2QsXG4gICAgICAgIHNlY3VyZSxcbiAgICAgICAgdXJsOiB1cmwudG9TdHJpbmcoKSxcbiAgICAgIH0pXG4gICAgfWA7XG4gIH1cbn1cbiJdfQ==