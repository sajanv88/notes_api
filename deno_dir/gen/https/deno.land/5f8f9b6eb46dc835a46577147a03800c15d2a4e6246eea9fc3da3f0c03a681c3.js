const matchCache = {};
const FIELD_CONTENT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
const KEY_REGEXP = /(?:^|;) *([^=]*)=[^;]*/g;
const SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;
function getPattern(name) {
    if (name in matchCache) {
        return matchCache[name];
    }
    return matchCache[name] = new RegExp(`(?:^|;) *${name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}=([^;]*)`);
}
function pushCookie(headers, cookie) {
    if (cookie.overwrite) {
        for (let i = headers.length - 1; i >= 0; i--) {
            if (headers[i].indexOf(`${cookie.name}=`) === 0) {
                headers.splice(i, 1);
            }
        }
    }
    headers.push(cookie.toHeader());
}
function validateCookieProperty(key, value) {
    if (value && !FIELD_CONTENT_REGEXP.test(value)) {
        throw new TypeError(`The ${key} of the cookie (${value}) is invalid.`);
    }
}
class Cookie {
    domain;
    expires;
    httpOnly = true;
    maxAge;
    name;
    overwrite = false;
    path = "/";
    sameSite = false;
    secure = false;
    signed;
    value;
    constructor(name, value, attributes) {
        validateCookieProperty("name", name);
        validateCookieProperty("value", value);
        this.name = name;
        this.value = value ?? "";
        Object.assign(this, attributes);
        if (!this.value) {
            this.expires = new Date(0);
            this.maxAge = undefined;
        }
        validateCookieProperty("path", this.path);
        validateCookieProperty("domain", this.domain);
        if (this.sameSite && typeof this.sameSite === "string" &&
            !SAME_SITE_REGEXP.test(this.sameSite)) {
            throw new TypeError(`The sameSite of the cookie ("${this.sameSite}") is invalid.`);
        }
    }
    toHeader() {
        let header = this.toString();
        if (this.maxAge) {
            this.expires = new Date(Date.now() + (this.maxAge * 1000));
        }
        if (this.path) {
            header += `; path=${this.path}`;
        }
        if (this.expires) {
            header += `; expires=${this.expires.toUTCString()}`;
        }
        if (this.domain) {
            header += `; domain=${this.domain}`;
        }
        if (this.sameSite) {
            header += `; samesite=${this.sameSite === true ? "strict" : this.sameSite.toLowerCase()}`;
        }
        if (this.secure) {
            header += "; secure";
        }
        if (this.httpOnly) {
            header += "; httponly";
        }
        return header;
    }
    toString() {
        return `${this.name}=${this.value}`;
    }
}
export class Cookies {
    #cookieKeys;
    #keys;
    #request;
    #response;
    #secure;
    #requestKeys() {
        if (this.#cookieKeys) {
            return this.#cookieKeys;
        }
        const result = this.#cookieKeys = [];
        const header = this.#request.headers.get("cookie");
        if (!header) {
            return result;
        }
        let matches;
        while ((matches = KEY_REGEXP.exec(header))) {
            const [, key] = matches;
            result.push(key);
        }
        return result;
    }
    constructor(request, response, options = {}) {
        const { keys, secure } = options;
        this.#keys = keys;
        this.#request = request;
        this.#response = response;
        this.#secure = secure;
    }
    delete(name, options = {}) {
        this.set(name, null, options);
        return true;
    }
    async *entries() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                yield [key, value];
            }
        }
    }
    async forEach(callback, thisArg = null) {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                callback.call(thisArg, key, value, this);
            }
        }
    }
    async get(name, options = {}) {
        const signed = options.signed ?? !!this.#keys;
        const nameSig = `${name}.sig`;
        const header = this.#request.headers.get("cookie");
        if (!header) {
            return;
        }
        const match = header.match(getPattern(name));
        if (!match) {
            return;
        }
        const [, value] = match;
        if (!signed) {
            return value;
        }
        const digest = await this.get(nameSig, { signed: false });
        if (!digest) {
            return;
        }
        const data = `${name}=${value}`;
        if (!this.#keys) {
            throw new TypeError("keys required for signed cookies");
        }
        const index = await this.#keys.indexOf(data, digest);
        if (index < 0) {
            this.delete(nameSig, { path: "/", signed: false });
        }
        else {
            if (index) {
                this.set(nameSig, await this.#keys.sign(data), { signed: false });
            }
            return value;
        }
    }
    async *keys() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                yield key;
            }
        }
    }
    async set(name, value, options = {}) {
        const request = this.#request;
        const response = this.#response;
        const headers = [];
        for (const [key, value] of response.headers.entries()) {
            if (key === "set-cookie") {
                headers.push(value);
            }
        }
        const secure = this.#secure !== undefined ? this.#secure : request.secure;
        const signed = options.signed ?? !!this.#keys;
        if (!secure && options.secure && !options.ignoreInsecure) {
            throw new TypeError("Cannot send secure cookie over unencrypted connection.");
        }
        const cookie = new Cookie(name, value, options);
        cookie.secure = options.secure ?? secure;
        pushCookie(headers, cookie);
        if (signed) {
            if (!this.#keys) {
                throw new TypeError(".keys required for signed cookies.");
            }
            cookie.value = await this.#keys.sign(cookie.toString());
            cookie.name += ".sig";
            pushCookie(headers, cookie);
        }
        response.headers.delete("Set-Cookie");
        for (const header of headers) {
            response.headers.append("Set-Cookie", header);
        }
        return this;
    }
    async *values() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                yield value;
            }
        }
    }
    async *[Symbol.asyncIterator]() {
        const keys = this.#requestKeys();
        for (const key of keys) {
            const value = await this.get(key);
            if (value) {
                yield [key, value];
            }
        }
    }
    [Symbol.for("Deno.customInspect")]() {
        return `${this.constructor.name} []`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29va2llcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvb2tpZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBbUNBLE1BQU0sVUFBVSxHQUEyQixFQUFFLENBQUM7QUFHOUMsTUFBTSxvQkFBb0IsR0FBRyx1Q0FBdUMsQ0FBQztBQUNyRSxNQUFNLFVBQVUsR0FBRyx5QkFBeUIsQ0FBQztBQUM3QyxNQUFNLGdCQUFnQixHQUFHLHdCQUF3QixDQUFDO0FBRWxELFNBQVMsVUFBVSxDQUFDLElBQVk7SUFDOUIsSUFBSSxJQUFJLElBQUksVUFBVSxFQUFFO1FBQ3RCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3pCO0lBRUQsT0FBTyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQ2xDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUN2RSxDQUFDO0FBQ0osQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLE9BQWlCLEVBQUUsTUFBYztJQUNuRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUU7UUFDcEIsS0FBSyxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzVDLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDL0MsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7YUFDdEI7U0FDRjtLQUNGO0lBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNsQyxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FDN0IsR0FBVyxFQUNYLEtBQWdDO0lBRWhDLElBQUksS0FBSyxJQUFJLENB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QU0sQ0FBQyxhQUFhLENBQUM7UUFDM0IsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2pDLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFO1lBQ3RCLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNsQyxJQUFJLEtBQUssRUFBRTtnQkFDVCxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQ3BCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDaEMsT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxLQUFLLENBQUM7SUFDdkMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgb2FrIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG4vLyBUaGlzIHdhcyBoZWF2aWx5IGluZmx1ZW5jZWQgYnlcbi8vIFtjb29raWVzXShodHRwczovL2dpdGh1Yi5jb20vcGlsbGFyanMvY29va2llcy9ibG9iL21hc3Rlci9pbmRleC5qcylcblxuaW1wb3J0IHR5cGUgeyBLZXlTdGFjayB9IGZyb20gXCIuL2tleVN0YWNrLnRzXCI7XG5pbXBvcnQgdHlwZSB7IFJlcXVlc3QgfSBmcm9tIFwiLi9yZXF1ZXN0LnRzXCI7XG5pbXBvcnQgdHlwZSB7IFJlc3BvbnNlIH0gZnJvbSBcIi4vcmVzcG9uc2UudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDb29raWVzT3B0aW9ucyB7XG4gIGtleXM/OiBLZXlTdGFjaztcbiAgc2VjdXJlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDb29raWVzR2V0T3B0aW9ucyB7XG4gIHNpZ25lZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29va2llc1NldERlbGV0ZU9wdGlvbnMge1xuICBkb21haW4/OiBzdHJpbmc7XG4gIGV4cGlyZXM/OiBEYXRlO1xuICBodHRwT25seT86IGJvb2xlYW47XG4gIC8qKiBGb3IgdXNlIGluIHNpdHVhdGlvbnMgd2hlcmUgcmVxdWVzdHMgYXJlIHByZXNlbnRlZCB0byBEZW5vIGFzIFwiaW5zZWN1cmVcIlxuICAgKiBidXQgYXJlIG90aGVyd2lzZSBzZWN1cmUgYW5kIHNvIHNlY3VyZSBjb29raWVzIGNhbiBiZSB0cmVhdGVkIGFzIHNlY3VyZS4gKi9cbiAgaWdub3JlSW5zZWN1cmU/OiBib29sZWFuO1xuICBtYXhBZ2U/OiBudW1iZXI7XG4gIG92ZXJ3cml0ZT86IGJvb2xlYW47XG4gIHBhdGg/OiBzdHJpbmc7XG4gIHNlY3VyZT86IGJvb2xlYW47XG4gIHNhbWVTaXRlPzogXCJzdHJpY3RcIiB8IFwibGF4XCIgfCBcIm5vbmVcIiB8IGJvb2xlYW47XG4gIHNpZ25lZD86IGJvb2xlYW47XG59XG5cbnR5cGUgQ29va2llQXR0cmlidXRlcyA9IENvb2tpZXNTZXREZWxldGVPcHRpb25zO1xuXG5jb25zdCBtYXRjaENhY2hlOiBSZWNvcmQ8c3RyaW5nLCBSZWdFeHA+ID0ge307XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tY29udHJvbC1yZWdleFxuY29uc3QgRklFTERfQ09OVEVOVF9SRUdFWFAgPSAvXltcXHUwMDA5XFx1MDAyMC1cXHUwMDdlXFx1MDA4MC1cXHUwMGZmXSskLztcbmNvbnN0IEtFWV9SRUdFWFAgPSAvKD86Xnw7KSAqKFtePV0qKT1bXjtdKi9nO1xuY29uc3QgU0FNRV9TSVRFX1JFR0VYUCA9IC9eKD86bGF4fG5vbmV8c3RyaWN0KSQvaTtcblxuZnVuY3Rpb24gZ2V0UGF0dGVybihuYW1lOiBzdHJpbmcpOiBSZWdFeHAge1xuICBpZiAobmFtZSBpbiBtYXRjaENhY2hlKSB7XG4gICAgcmV0dXJuIG1hdGNoQ2FjaGVbbmFtZV07XG4gIH1cblxuICByZXR1cm4gbWF0Y2hDYWNoZVtuYW1lXSA9IG5ldyBSZWdFeHAoXG4gICAgYCg/Ol58OykgKiR7bmFtZS5yZXBsYWNlKC9bLVtcXF17fSgpKis/LixcXFxcXiR8I1xcc10vZywgXCJcXFxcJCZcIil9PShbXjtdKilgLFxuICApO1xufVxuXG5mdW5jdGlvbiBwdXNoQ29va2llKGhlYWRlcnM6IHN0cmluZ1tdLCBjb29raWU6IENvb2tpZSk6IHZvaWQge1xuICBpZiAoY29va2llLm92ZXJ3cml0ZSkge1xuICAgIGZvciAobGV0IGkgPSBoZWFkZXJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBpZiAoaGVhZGVyc1tpXS5pbmRleE9mKGAke2Nvb2tpZS5uYW1lfT1gKSA9PT0gMCkge1xuICAgICAgICBoZWFkZXJzLnNwbGljZShpLCAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaGVhZGVycy5wdXNoKGNvb2tpZS50b0hlYWRlcigpKTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVDb29raWVQcm9wZXJ0eShcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsLFxuKTogdm9pZCB7XG4gIGlmICh2YWx1ZSAmJiAhRklFTERfQ09OVEVOVF9SRUdFWFAudGVzdCh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBUaGUgJHtrZXl9IG9mIHRoZSBjb29raWUgKCR7dmFsdWV9KSBpcyBpbnZhbGlkLmApO1xuICB9XG59XG5cbmNsYXNzIENvb2tpZSBpbXBsZW1lbnRzIENvb2tpZUF0dHJpYnV0ZXMge1xuICBkb21haW4/OiBzdHJpbmc7XG4gIGV4cGlyZXM/OiBEYXRlO1xuICBodHRwT25seSA9IHRydWU7XG4gIG1heEFnZT86IG51bWJlcjtcbiAgbmFtZTogc3RyaW5nO1xuICBvdmVyd3JpdGUgPSBmYWxzZTtcbiAgcGF0aCA9IFwiL1wiO1xuICBzYW1lU2l0ZTogXCJzdHJpY3RcIiB8IFwibGF4XCIgfCBcIm5vbmVcIiB8IGJvb2xlYW4gPSBmYWxzZTtcbiAgc2VjdXJlID0gZmFsc2U7XG4gIHNpZ25lZD86IGJvb2xlYW47XG4gIHZhbHVlOiBzdHJpbmc7XG5cbiAgLyoqIEEgbG9naWNhbCByZXByZXNlbnRhdGlvbiBvZiBhIGNvb2tpZSwgdXNlZCB0byBpbnRlcm5hbGx5IG1hbmFnZSB0aGVcbiAgICogY29va2llIGluc3RhbmNlcy4gKi9cbiAgY29uc3RydWN0b3IoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHZhbHVlOiBzdHJpbmcgfCBudWxsLFxuICAgIGF0dHJpYnV0ZXM6IENvb2tpZUF0dHJpYnV0ZXMsXG4gICkge1xuICAgIHZhbGlkYXRlQ29va2llUHJvcGVydHkoXCJuYW1lXCIsIG5hbWUpO1xuICAgIHZhbGlkYXRlQ29va2llUHJvcGVydHkoXCJ2YWx1ZVwiLCB2YWx1ZSk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWUgPz8gXCJcIjtcbiAgICBPYmplY3QuYXNzaWduKHRoaXMsIGF0dHJpYnV0ZXMpO1xuICAgIGlmICghdGhpcy52YWx1ZSkge1xuICAgICAgdGhpcy5leHBpcmVzID0gbmV3IERhdGUoMCk7XG4gICAgICB0aGlzLm1heEFnZSA9IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICB2YWxpZGF0ZUNvb2tpZVByb3BlcnR5KFwicGF0aFwiLCB0aGlzLnBhdGgpO1xuICAgIHZhbGlkYXRlQ29va2llUHJvcGVydHkoXCJkb21haW5cIiwgdGhpcy5kb21haW4pO1xuICAgIGlmIChcbiAgICAgIHRoaXMuc2FtZVNpdGUgJiYgdHlwZW9mIHRoaXMuc2FtZVNpdGUgPT09IFwic3RyaW5nXCIgJiZcbiAgICAgICFTQU1FX1NJVEVfUkVHRVhQLnRlc3QodGhpcy5zYW1lU2l0ZSlcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBUaGUgc2FtZVNpdGUgb2YgdGhlIGNvb2tpZSAoXCIke3RoaXMuc2FtZVNpdGV9XCIpIGlzIGludmFsaWQuYCxcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgdG9IZWFkZXIoKTogc3RyaW5nIHtcbiAgICBsZXQgaGVhZGVyID0gdGhpcy50b1N0cmluZygpO1xuICAgIGlmICh0aGlzLm1heEFnZSkge1xuICAgICAgdGhpcy5leHBpcmVzID0gbmV3IERhdGUoRGF0ZS5ub3coKSArICh0aGlzLm1heEFnZSAqIDEwMDApKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5wYXRoKSB7XG4gICAgICBoZWFkZXIgKz0gYDsgcGF0aD0ke3RoaXMucGF0aH1gO1xuICAgIH1cbiAgICBpZiAodGhpcy5leHBpcmVzKSB7XG4gICAgICBoZWFkZXIgKz0gYDsgZXhwaXJlcz0ke3RoaXMuZXhwaXJlcy50b1VUQ1N0cmluZygpfWA7XG4gICAgfVxuICAgIGlmICh0aGlzLmRvbWFpbikge1xuICAgICAgaGVhZGVyICs9IGA7IGRvbWFpbj0ke3RoaXMuZG9tYWlufWA7XG4gICAgfVxuICAgIGlmICh0aGlzLnNhbWVTaXRlKSB7XG4gICAgICBoZWFkZXIgKz0gYDsgc2FtZXNpdGU9JHtcbiAgICAgICAgdGhpcy5zYW1lU2l0ZSA9PT0gdHJ1ZSA/IFwic3RyaWN0XCIgOiB0aGlzLnNhbWVTaXRlLnRvTG93ZXJDYXNlKClcbiAgICAgIH1gO1xuICAgIH1cbiAgICBpZiAodGhpcy5zZWN1cmUpIHtcbiAgICAgIGhlYWRlciArPSBcIjsgc2VjdXJlXCI7XG4gICAgfVxuICAgIGlmICh0aGlzLmh0dHBPbmx5KSB7XG4gICAgICBoZWFkZXIgKz0gXCI7IGh0dHBvbmx5XCI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhlYWRlcjtcbiAgfVxuXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGAke3RoaXMubmFtZX09JHt0aGlzLnZhbHVlfWA7XG4gIH1cbn1cblxuLyoqIEFuIGludGVyZmFjZSB3aGljaCBhbGxvd3Mgc2V0dGluZyBhbmQgYWNjZXNzaW5nIGNvb2tpZXMgcmVsYXRlZCB0byBib3RoIHRoZVxuICogY3VycmVudCByZXF1ZXN0IGFuZCByZXNwb25zZS4gKi9cbmV4cG9ydCBjbGFzcyBDb29raWVzIHtcbiAgI2Nvb2tpZUtleXM/OiBzdHJpbmdbXTtcbiAgI2tleXM/OiBLZXlTdGFjaztcbiAgI3JlcXVlc3Q6IFJlcXVlc3Q7XG4gICNyZXNwb25zZTogUmVzcG9uc2U7XG4gICNzZWN1cmU/OiBib29sZWFuO1xuXG4gICNyZXF1ZXN0S2V5cygpOiBzdHJpbmdbXSB7XG4gICAgaWYgKHRoaXMuI2Nvb2tpZUtleXMpIHtcbiAgICAgIHJldHVybiB0aGlzLiNjb29raWVLZXlzO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSB0aGlzLiNjb29raWVLZXlzID0gW10gYXMgc3RyaW5nW107XG4gICAgY29uc3QgaGVhZGVyID0gdGhpcy4jcmVxdWVzdC5oZWFkZXJzLmdldChcImNvb2tpZVwiKTtcbiAgICBpZiAoIWhlYWRlcikge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgbGV0IG1hdGNoZXM6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gICAgd2hpbGUgKChtYXRjaGVzID0gS0VZX1JFR0VYUC5leGVjKGhlYWRlcikpKSB7XG4gICAgICBjb25zdCBbLCBrZXldID0gbWF0Y2hlcztcbiAgICAgIHJlc3VsdC5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICByZXF1ZXN0OiBSZXF1ZXN0LFxuICAgIHJlc3BvbnNlOiBSZXNwb25zZSxcbiAgICBvcHRpb25zOiBDb29raWVzT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBjb25zdCB7IGtleXMsIHNlY3VyZSB9ID0gb3B0aW9ucztcbiAgICB0aGlzLiNrZXlzID0ga2V5cztcbiAgICB0aGlzLiNyZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICB0aGlzLiNyZXNwb25zZSA9IHJlc3BvbnNlO1xuICAgIHRoaXMuI3NlY3VyZSA9IHNlY3VyZTtcbiAgfVxuXG4gIC8qKiBTZXQgYSBjb29raWUgdG8gYmUgZGVsZXRlZCBpbiB0aGUgcmVzcG9uc2UuICBUaGlzIGlzIGEgXCJzaG9ydGN1dFwiIHRvXG4gICAqIGAuc2V0KG5hbWUsIG51bGwsIG9wdGlvbnM/KWAuICovXG4gIGRlbGV0ZShuYW1lOiBzdHJpbmcsIG9wdGlvbnM6IENvb2tpZXNTZXREZWxldGVPcHRpb25zID0ge30pOiBib29sZWFuIHtcbiAgICB0aGlzLnNldChuYW1lLCBudWxsLCBvcHRpb25zKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJlcXVlc3QncyBjb29raWVzLCB5aWVsZGluZyB1cCBhIHR1cGxlIGNvbnRhaW5pbmcgdGhlXG4gICAqIGtleSBhbmQgdGhlIHZhbHVlLlxuICAgKlxuICAgKiBJZiB0aGVyZSBhcmUga2V5cyBzZXQgb24gdGhlIGFwcGxpY2F0aW9uLCBvbmx5IGtleXMgYW5kIHZhbHVlcyB0aGF0IGFyZVxuICAgKiBwcm9wZXJseSBzaWduZWQgd2lsbCBiZSByZXR1cm5lZC4gKi9cbiAgYXN5bmMgKmVudHJpZXMoKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFtzdHJpbmcsIHN0cmluZ10+IHtcbiAgICBjb25zdCBrZXlzID0gdGhpcy4jcmVxdWVzdEtleXMoKTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuZ2V0KGtleSk7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgeWllbGQgW2tleSwgdmFsdWVdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZvckVhY2goXG4gICAgY2FsbGJhY2s6IChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZywgY29va2llczogdGhpcykgPT4gdm9pZCxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRoaXNBcmc6IGFueSA9IG51bGwsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGtleXMgPSB0aGlzLiNyZXF1ZXN0S2V5cygpO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5nZXQoa2V5KTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGtleSwgdmFsdWUsIHRoaXMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBHZXQgdGhlIHZhbHVlIG9mIGEgY29va2llIGZyb20gdGhlIHJlcXVlc3QuXG4gICAqXG4gICAqIElmIHRoZSBjb29raWUgaXMgc2lnbmVkLCBhbmQgdGhlIHNpZ25hdHVyZSBpcyBpbnZhbGlkLCB0aGUgY29va2llIHdpbGxcbiAgICogYmUgc2V0IHRvIGJlIGRlbGV0ZWQgaW4gdGhlIHRoZSByZXNwb25zZS4gIElmIHRoZSBzaWduYXR1cmUgdXNlcyBhbiBcIm9sZFwiXG4gICAqIGtleSwgdGhlIGNvb2tpZSB3aWxsIGJlIHJlLXNpZ25lZCB3aXRoIHRoZSBjdXJyZW50IGtleSBhbmQgYmUgYWRkZWQgdG8gdGhlXG4gICAqIHJlc3BvbnNlIHRvIGJlIHVwZGF0ZWQuICovXG4gIGFzeW5jIGdldChcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgb3B0aW9uczogQ29va2llc0dldE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBjb25zdCBzaWduZWQgPSBvcHRpb25zLnNpZ25lZCA/PyAhIXRoaXMuI2tleXM7XG4gICAgY29uc3QgbmFtZVNpZyA9IGAke25hbWV9LnNpZ2A7XG5cbiAgICBjb25zdCBoZWFkZXIgPSB0aGlzLiNyZXF1ZXN0LmhlYWRlcnMuZ2V0KFwiY29va2llXCIpO1xuICAgIGlmICghaGVhZGVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG1hdGNoID0gaGVhZGVyLm1hdGNoKGdldFBhdHRlcm4obmFtZSkpO1xuICAgIGlmICghbWF0Y2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgWywgdmFsdWVdID0gbWF0Y2g7XG4gICAgaWYgKCFzaWduZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgY29uc3QgZGlnZXN0ID0gYXdhaXQgdGhpcy5nZXQobmFtZVNpZywgeyBzaWduZWQ6IGZhbHNlIH0pO1xuICAgIGlmICghZGlnZXN0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBgJHtuYW1lfT0ke3ZhbHVlfWA7XG4gICAgaWYgKCF0aGlzLiNrZXlzKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwia2V5cyByZXF1aXJlZCBmb3Igc2lnbmVkIGNvb2tpZXNcIik7XG4gICAgfVxuICAgIGNvbnN0IGluZGV4ID0gYXdhaXQgdGhpcy4ja2V5cy5pbmRleE9mKGRhdGEsIGRpZ2VzdCk7XG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICB0aGlzLmRlbGV0ZShuYW1lU2lnLCB7IHBhdGg6IFwiL1wiLCBzaWduZWQ6IGZhbHNlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW5kZXgpIHtcbiAgICAgICAgLy8gdGhlIGtleSBoYXMgXCJhZ2VkXCIgYW5kIG5lZWRzIHRvIGJlIHJlLXNpZ25lZFxuICAgICAgICB0aGlzLnNldChuYW1lU2lnLCBhd2FpdCB0aGlzLiNrZXlzLnNpZ24oZGF0YSksIHsgc2lnbmVkOiBmYWxzZSB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSByZXF1ZXN0J3MgY29va2llcywgeWllbGRpbmcgdXAgdGhlIGtleXMuXG4gICAqXG4gICAqIElmIHRoZXJlIGFyZSBrZXlzIHNldCBvbiB0aGUgYXBwbGljYXRpb24sIG9ubHkgdGhlIGtleXMgdGhhdCBhcmUgcHJvcGVybHlcbiAgICogc2lnbmVkIHdpbGwgYmUgcmV0dXJuZWQuICovXG4gIGFzeW5jICprZXlzKCk6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxzdHJpbmc+IHtcbiAgICBjb25zdCBrZXlzID0gdGhpcy4jcmVxdWVzdEtleXMoKTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuZ2V0KGtleSk7XG4gICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgeWllbGQga2V5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKiBTZXQgYSBjb29raWUgaW4gdGhlIHJlc3BvbnNlLlxuICAgKlxuICAgKiBJZiB0aGVyZSBhcmUga2V5cyBzZXQgaW4gdGhlIGFwcGxpY2F0aW9uLCBjb29raWVzIHdpbGwgYmUgYXV0b21hdGljYWxseVxuICAgKiBzaWduZWQsIHVubGVzcyBvdmVycmlkZGVuIGJ5IHRoZSBzZXQgb3B0aW9ucy4gIENvb2tpZXMgY2FuIGJlIGRlbGV0ZWQgYnlcbiAgICogc2V0dGluZyB0aGUgdmFsdWUgdG8gYG51bGxgLiAqL1xuICBhc3luYyBzZXQoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHZhbHVlOiBzdHJpbmcgfCBudWxsLFxuICAgIG9wdGlvbnM6IENvb2tpZXNTZXREZWxldGVPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8dGhpcz4ge1xuICAgIGNvbnN0IHJlcXVlc3QgPSB0aGlzLiNyZXF1ZXN0O1xuICAgIGNvbnN0IHJlc3BvbnNlID0gdGhpcy4jcmVzcG9uc2U7XG4gICAgY29uc3QgaGVhZGVyczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiByZXNwb25zZS5oZWFkZXJzLmVudHJpZXMoKSkge1xuICAgICAgaWYgKGtleSA9PT0gXCJzZXQtY29va2llXCIpIHtcbiAgICAgICAgaGVhZGVycy5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc2VjdXJlID0gdGhpcy4jc2VjdXJlICE9PSB1bmRlZmluZWQgPyB0aGlzLiNzZWN1cmUgOiByZXF1ZXN0LnNlY3VyZTtcbiAgICBjb25zdCBzaWduZWQgPSBvcHRpb25zLnNpZ25lZCA/PyAhIXRoaXMuI2tleXM7XG5cbiAgICBpZiAoIXNlY3VyZSAmJiBvcHRpb25zLnNlY3VyZSAmJiAhb3B0aW9ucy5pZ25vcmVJbnNlY3VyZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgXCJDYW5ub3Qgc2VuZCBzZWN1cmUgY29va2llIG92ZXIgdW5lbmNyeXB0ZWQgY29ubmVjdGlvbi5cIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgY29va2llID0gbmV3IENvb2tpZShuYW1lLCB2YWx1ZSwgb3B0aW9ucyk7XG4gICAgY29va2llLnNlY3VyZSA9IG9wdGlvbnMuc2VjdXJlID8/IHNlY3VyZTtcbiAgICBwdXNoQ29va2llKGhlYWRlcnMsIGNvb2tpZSk7XG5cbiAgICBpZiAoc2lnbmVkKSB7XG4gICAgICBpZiAoIXRoaXMuI2tleXMpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIi5rZXlzIHJlcXVpcmVkIGZvciBzaWduZWQgY29va2llcy5cIik7XG4gICAgICB9XG4gICAgICBjb29raWUudmFsdWUgPSBhd2FpdCB0aGlzLiNrZXlzLnNpZ24oY29va2llLnRvU3RyaW5nKCkpO1xuICAgICAgY29va2llLm5hbWUgKz0gXCIuc2lnXCI7XG4gICAgICBwdXNoQ29va2llKGhlYWRlcnMsIGNvb2tpZSk7XG4gICAgfVxuXG4gICAgcmVzcG9uc2UuaGVhZGVycy5kZWxldGUoXCJTZXQtQ29va2llXCIpO1xuICAgIGZvciAoY29uc3QgaGVhZGVyIG9mIGhlYWRlcnMpIHtcbiAgICAgIHJlc3BvbnNlLmhlYWRlcnMuYXBwZW5kKFwiU2V0LUNvb2tpZVwiLCBoZWFkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJlcXVlc3QncyBjb29raWVzLCB5aWVsZGluZyB1cCBlYWNoIHZhbHVlLlxuICAgKlxuICAgKiBJZiB0aGVyZSBhcmUga2V5cyBzZXQgb24gdGhlIGFwcGxpY2F0aW9uLCBvbmx5IHRoZSB2YWx1ZXMgdGhhdCBhcmVcbiAgICogcHJvcGVybHkgc2lnbmVkIHdpbGwgYmUgcmV0dXJuZWQuICovXG4gIGFzeW5jICp2YWx1ZXMoKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPHN0cmluZz4ge1xuICAgIGNvbnN0IGtleXMgPSB0aGlzLiNyZXF1ZXN0S2V5cygpO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5nZXQoa2V5KTtcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB5aWVsZCB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKiogSXRlcmF0ZSBvdmVyIHRoZSByZXF1ZXN0J3MgY29va2llcywgeWllbGRpbmcgdXAgYSB0dXBsZSBjb250YWluaW5nIHRoZVxuICAgKiBrZXkgYW5kIHRoZSB2YWx1ZS5cbiAgICpcbiAgICogSWYgdGhlcmUgYXJlIGtleXMgc2V0IG9uIHRoZSBhcHBsaWNhdGlvbiwgb25seSBrZXlzIGFuZCB2YWx1ZXMgdGhhdCBhcmVcbiAgICogcHJvcGVybHkgc2lnbmVkIHdpbGwgYmUgcmV0dXJuZWQuICovXG4gIGFzeW5jICpbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBzdHJpbmddPiB7XG4gICAgY29uc3Qga2V5cyA9IHRoaXMuI3JlcXVlc3RLZXlzKCk7XG4gICAgZm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLmdldChrZXkpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHlpZWxkIFtrZXksIHZhbHVlXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIkRlbm8uY3VzdG9tSW5zcGVjdFwiKV0oKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gW11gO1xuICB9XG59XG4iXX0=