import { compile, pathParse, pathToRegexp, Status, } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { compose } from "./middleware.ts";
import { assert, decodeComponent } from "./util.ts";
function toUrl(url, params = {}, options) {
    const tokens = pathParse(url);
    let replace = {};
    if (tokens.some((token) => typeof token === "object")) {
        replace = params;
    }
    else {
        options = params;
    }
    const toPath = compile(url, options);
    const replaced = toPath(replace);
    if (options && options.query) {
        const url = new URL(replaced, "http://oak");
        if (typeof options.query === "string") {
            url.search = options.query;
        }
        else {
            url.search = String(options.query instanceof URLSearchParams
                ? options.query
                : new URLSearchParams(options.query));
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }
    return replaced;
}
class Layer {
    #opts;
    #paramNames = [];
    #regexp;
    methods;
    name;
    path;
    stack;
    constructor(path, methods, middleware, { name, ...opts } = {}) {
        this.#opts = opts;
        this.name = name;
        this.methods = [...methods];
        if (this.methods.includes("GET")) {
            this.methods.unshift("HEAD");
        }
        this.stack = Array.isArray(middleware) ? middleware.slice() : [middleware];
        this.path = path;
        this.#regexp = pathToRegexp(path, this.#paramNames, this.#opts);
    }
    clone() {
        return new Layer(this.path, this.methods, this.stack, { name: this.name, ...this.#opts });
    }
    match(path) {
        return this.#regexp.test(path);
    }
    params(captures, existingParams = {}) {
        const params = existingParams;
        for (let i = 0; i < captures.length; i++) {
            if (this.#paramNames[i]) {
                const c = captures[i];
                params[this.#paramNames[i].name] = c ? decodeComponent(c) : c;
            }
        }
        return params;
    }
    captures(path) {
        if (this.#opts.ignoreCaptures) {
            return [];
        }
        return path.match(this.#regexp)?.slice(1) ?? [];
    }
    url(params = {}, options) {
        const url = this.path.replace(/\(\.\*\)/g, "");
        return toUrl(url, params, options);
    }
    param(param, fn) {
        const stack = this.stack;
        const params = this.#paramNames;
        const middleware = function (ctx, next) {
            const p = ctx.params[param];
            assert(p);
            return fn.call(this, p, ctx, next);
        };
        middleware.param = param;
        const names = params.map((p) => p.name);
        const x = names.indexOf(param);
        if (x >= 0) {
            for (let i = 0; i < stack.length; i++) {
                const fn = stack[i];
                if (!fn.param || names.indexOf(fn.param) > x) {
                    stack.splice(i, 0, middleware);
                    break;
                }
            }
        }
        return this;
    }
    setPrefix(prefix) {
        if (this.path) {
            this.path = this.path !== "/" || this.#opts.strict === true
                ? `${prefix}${this.path}`
                : prefix;
            this.#paramNames = [];
            this.#regexp = pathToRegexp(this.path, this.#paramNames, this.#opts);
        }
        return this;
    }
    toJSON() {
        return {
            methods: [...this.methods],
            middleware: [...this.stack],
            paramNames: this.#paramNames.map((key) => key.name),
            path: this.path,
            regexp: this.#regexp,
            options: { ...this.#opts },
        };
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        return `${this.constructor.name} ${inspect({
            methods: this.methods,
            middleware: this.stack,
            options: this.#opts,
            paramNames: this.#paramNames.map((key) => key.name),
            path: this.path,
            regexp: this.#regexp,
        })}`;
    }
}
export class Router {
    #opts;
    #methods;
    #params = {};
    #stack = [];
    #match(path, method) {
        const matches = {
            path: [],
            pathAndMethod: [],
            route: false,
        };
        for (const route of this.#stack) {
            if (route.match(path)) {
                matches.path.push(route);
                if (route.methods.length === 0 || route.methods.includes(method)) {
                    matches.pathAndMethod.push(route);
                    if (route.methods.length) {
                        matches.route = true;
                    }
                }
            }
        }
        return matches;
    }
    #register(path, middlewares, methods, options = {}) {
        if (Array.isArray(path)) {
            for (const p of path) {
                this.#register(p, middlewares, methods, options);
            }
            return;
        }
        let layerMiddlewares = [];
        for (const middleware of middlewares) {
            if (!middleware.router) {
                layerMiddlewares.push(middleware);
                continue;
            }
            if (layerMiddlewares.length) {
                this.#addLayer(path, layerMiddlewares, methods, options);
                layerMiddlewares = [];
            }
            const router = middleware.router.#clone();
            for (const layer of router.#stack) {
                if (!options.ignorePrefix) {
                    layer.setPrefix(path);
                }
                if (this.#opts.prefix) {
                    layer.setPrefix(this.#opts.prefix);
                }
                this.#stack.push(layer);
            }
            for (const [param, mw] of Object.entries(this.#params)) {
                router.param(param, mw);
            }
        }
        if (layerMiddlewares.length) {
            this.#addLayer(path, layerMiddlewares, methods, options);
        }
    }
    #addLayer(path, middlewares, methods, options = {}) {
        const { end, name, sensitive = this.#opts.sensitive, strict = this.#opts.strict, ignoreCaptures, } = options;
        const route = new Layer(path, methods, middlewares, {
            end,
            name,
            sensitive,
            strict,
            ignoreCaptures,
        });
        if (this.#opts.prefix) {
            route.setPrefix(this.#opts.prefix);
        }
        for (const [param, mw] of Object.entries(this.#params)) {
            route.param(param, mw);
        }
        this.#stack.push(route);
    }
    #route(name) {
        for (const route of this.#stack) {
            if (route.name === name) {
                return route;
            }
        }
    }
    #useVerb(nameOrPath, pathOrMiddleware, middleware, methods) {
        let name = undefined;
        let path;
        if (typeof pathOrMiddleware === "string") {
            name = nameOrPath;
            path = pathOrMiddleware;
        }
        else {
            path = nameOrPath;
            middleware.unshift(pathOrMiddleware);
        }
        this.#register(path, middleware, methods, { name });
    }
    #clone() {
        const router = new Router(this.#opts);
        router.#methods = router.#methods.slice();
        router.#params = { ...this.#params };
        router.#stack = this.#stack.map((layer) => layer.clone());
        return router;
    }
    constructor(opts = {}) {
        this.#opts = opts;
        this.#methods = opts.methods ?? [
            "DELETE",
            "GET",
            "HEAD",
            "OPTIONS",
            "PATCH",
            "POST",
            "PUT",
        ];
    }
    all(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["DELETE", "GET", "POST", "PUT"]);
        return this;
    }
    allowedMethods(options = {}) {
        const implemented = this.#methods;
        const allowedMethods = async (context, next) => {
            const ctx = context;
            await next();
            if (!ctx.response.status || ctx.response.status === Status.NotFound) {
                assert(ctx.matched);
                const allowed = new Set();
                for (const route of ctx.matched) {
                    for (const method of route.methods) {
                        allowed.add(method);
                    }
                }
                const allowedStr = [...allowed].join(", ");
                if (!implemented.includes(ctx.request.method)) {
                    if (options.throw) {
                        throw options.notImplemented
                            ? options.notImplemented()
                            : new httpErrors.NotImplemented();
                    }
                    else {
                        ctx.response.status = Status.NotImplemented;
                        ctx.response.headers.set("Allowed", allowedStr);
                    }
                }
                else if (allowed.size) {
                    if (ctx.request.method === "OPTIONS") {
                        ctx.response.status = Status.OK;
                        ctx.response.headers.set("Allowed", allowedStr);
                    }
                    else if (!allowed.has(ctx.request.method)) {
                        if (options.throw) {
                            throw options.methodNotAllowed
                                ? options.methodNotAllowed()
                                : new httpErrors.MethodNotAllowed();
                        }
                        else {
                            ctx.response.status = Status.MethodNotAllowed;
                            ctx.response.headers.set("Allowed", allowedStr);
                        }
                    }
                }
            }
        };
        return allowedMethods;
    }
    delete(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["DELETE"]);
        return this;
    }
    *entries() {
        for (const route of this.#stack) {
            const value = route.toJSON();
            yield [value, value];
        }
    }
    forEach(callback, thisArg = null) {
        for (const route of this.#stack) {
            const value = route.toJSON();
            callback.call(thisArg, value, value, this);
        }
    }
    get(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["GET"]);
        return this;
    }
    head(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["HEAD"]);
        return this;
    }
    *keys() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    options(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["OPTIONS"]);
        return this;
    }
    param(param, middleware) {
        this.#params[param] = middleware;
        for (const route of this.#stack) {
            route.param(param, middleware);
        }
        return this;
    }
    patch(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["PATCH"]);
        return this;
    }
    post(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["POST"]);
        return this;
    }
    prefix(prefix) {
        prefix = prefix.replace(/\/$/, "");
        this.#opts.prefix = prefix;
        for (const route of this.#stack) {
            route.setPrefix(prefix);
        }
        return this;
    }
    put(nameOrPath, pathOrMiddleware, ...middleware) {
        this.#useVerb(nameOrPath, pathOrMiddleware, middleware, ["PUT"]);
        return this;
    }
    redirect(source, destination, status = Status.Found) {
        if (source[0] !== "/") {
            const s = this.url(source);
            if (!s) {
                throw new RangeError(`Could not resolve named route: "${source}"`);
            }
            source = s;
        }
        if (typeof destination === "string") {
            if (destination[0] !== "/") {
                const d = this.url(destination);
                if (!d) {
                    try {
                        const url = new URL(destination);
                        destination = url;
                    }
                    catch {
                        throw new RangeError(`Could not resolve named route: "${source}"`);
                    }
                }
                else {
                    destination = d;
                }
            }
        }
        this.all(source, async (ctx, next) => {
            await next();
            ctx.response.redirect(destination);
            ctx.response.status = status;
        });
        return this;
    }
    routes() {
        const dispatch = (context, next) => {
            const ctx = context;
            let pathname;
            let method;
            try {
                const { url: { pathname: p }, method: m } = ctx.request;
                pathname = p;
                method = m;
            }
            catch (e) {
                return Promise.reject(e);
            }
            const path = this.#opts.routerPath ?? ctx.routerPath ??
                decodeURI(pathname);
            const matches = this.#match(path, method);
            if (ctx.matched) {
                ctx.matched.push(...matches.path);
            }
            else {
                ctx.matched = [...matches.path];
            }
            ctx.router = this;
            if (!matches.route)
                return next();
            const { pathAndMethod: matchedRoutes } = matches;
            const chain = matchedRoutes.reduce((prev, route) => [
                ...prev,
                (ctx, next) => {
                    ctx.captures = route.captures(path);
                    ctx.params = route.params(ctx.captures, ctx.params);
                    ctx.routeName = route.name;
                    return next();
                },
                ...route.stack,
            ], []);
            return compose(chain)(ctx, next);
        };
        dispatch.router = this;
        return dispatch;
    }
    url(name, params, options) {
        const route = this.#route(name);
        if (route) {
            return route.url(params, options);
        }
    }
    use(pathOrMiddleware, ...middleware) {
        let path;
        if (typeof pathOrMiddleware === "string" || Array.isArray(pathOrMiddleware)) {
            path = pathOrMiddleware;
        }
        else {
            middleware.unshift(pathOrMiddleware);
        }
        this.#register(path ?? "(.*)", middleware, [], { end: false, ignoreCaptures: !path, ignorePrefix: !path });
        return this;
    }
    *values() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    *[Symbol.iterator]() {
        for (const route of this.#stack) {
            yield route.toJSON();
        }
    }
    static url(path, params, options) {
        return toUrl(path, params, options);
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        return `${this.constructor.name} ${inspect({ "#params": this.#params, "#stack": this.#stack })}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicm91dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQTZCQSxPQUFPLEVBQ0wsT0FBTyxFQUdQLFNBQVMsRUFDVCxZQUFZLEVBQ1osTUFBTSxHQUVQLE1BQU0sV0FBVyxDQUFDO0FBQ25CLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1QyxPQUFPLEVBQUUsT0FBTyxFQUFjLE1BQU0saUJBQWlCLENBQUM7QUFFdEQsT0FBTyxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFtTHBELFNBQVMsS0FBSyxDQUNaLEdBQVcsRUFDWCxTQUFTLEVBQW9CLEVBQzdCLE9BQW9CO0lBRXBCLE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QixJQUFJLE9BQU8sR0FBRyxFQUFvQixDQUFDO0lBRW5DLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLEVBQUU7UUFDckQsT0FBTyxHQUFHLE1BQU0sQ0FBQztLQUNsQjtTQUFNO1FBQ0wsT0FBTyxHQUFHLE1BQU0sQ0FBQztLQUNsQjtJQUVELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDckMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRWpDLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7UUFDNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzVDLElBQUksT0FBTyxPQUFPLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRTtZQUNyQyxHQUFHLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7U0FDNUI7YUFBTTtZQUNM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QUUsQ0FDM0QsQ0FBQztRQUVGLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUdELENBQUMsTUFBTTtRQUNMLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUMvQixNQUFNLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztTQUN0QjtJQUNILENBQUM7SUFJRCxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztRQUdoQixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDL0IsTUFBTSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7U0FDdEI7SUFDSCxDQUFDO0lBSUQsTUFBTSxDQUFDLEdBQUcsQ0FDUixJQUFPLEVBQ1AsTUFBdUIsRUFDdkIsT0FBb0I7UUFFcEIsT0FBTyxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxPQUFtQztRQUNwRSxPQUFPLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQzdCLE9BQU8sQ0FBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQzVELEVBQUUsQ0FBQztJQUNMLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWRhcHRlZCBkaXJlY3RseSBmcm9tIEBrb2Evcm91dGVyIGF0XG4gKiBodHRwczovL2dpdGh1Yi5jb20va29hanMvcm91dGVyLyB3aGljaCBpcyBsaWNlbnNlZCBhczpcbiAqXG4gKiBUaGUgTUlUIExpY2Vuc2UgKE1JVClcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUgQWxleGFuZGVyIEMuIE1pbmdvaWFcbiAqXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICpcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICovXG5cbmltcG9ydCB0eXBlIHsgU3RhdGUgfSBmcm9tIFwiLi9hcHBsaWNhdGlvbi50c1wiO1xuaW1wb3J0IHR5cGUgeyBDb250ZXh0IH0gZnJvbSBcIi4vY29udGV4dC50c1wiO1xuaW1wb3J0IHtcbiAgY29tcGlsZSxcbiAgS2V5LFxuICBQYXJzZU9wdGlvbnMsXG4gIHBhdGhQYXJzZSxcbiAgcGF0aFRvUmVnZXhwLFxuICBTdGF0dXMsXG4gIFRva2Vuc1RvUmVnZXhwT3B0aW9ucyxcbn0gZnJvbSBcIi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgaHR0cEVycm9ycyB9IGZyb20gXCIuL2h0dHBFcnJvci50c1wiO1xuaW1wb3J0IHsgY29tcG9zZSwgTWlkZGxld2FyZSB9IGZyb20gXCIuL21pZGRsZXdhcmUudHNcIjtcbmltcG9ydCB0eXBlIHsgSFRUUE1ldGhvZHMsIFJlZGlyZWN0U3RhdHVzIH0gZnJvbSBcIi4vdHlwZXMuZC50c1wiO1xuaW1wb3J0IHsgYXNzZXJ0LCBkZWNvZGVDb21wb25lbnQgfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbmludGVyZmFjZSBNYXRjaGVzPFIgZXh0ZW5kcyBzdHJpbmc+IHtcbiAgcGF0aDogTGF5ZXI8Uj5bXTtcbiAgcGF0aEFuZE1ldGhvZDogTGF5ZXI8Uj5bXTtcbiAgcm91dGU6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUm91dGVyQWxsb3dlZE1ldGhvZHNPcHRpb25zIHtcbiAgLyoqIFVzZSB0aGUgdmFsdWUgcmV0dXJuZWQgZnJvbSB0aGlzIGZ1bmN0aW9uIGluc3RlYWQgb2YgYW4gSFRUUCBlcnJvclxuICAgKiBgTWV0aG9kTm90QWxsb3dlZGAuICovXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG1ldGhvZE5vdEFsbG93ZWQ/KCk6IGFueTtcblxuICAvKiogVXNlIHRoZSB2YWx1ZSByZXR1cm5lZCBmcm9tIHRoaXMgZnVuY3Rpb24gaW5zdGVhZCBvZiBhbiBIVFRQIGVycm9yXG4gICAqIGBOb3RJbXBsZW1lbnRlZGAuICovXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIG5vdEltcGxlbWVudGVkPygpOiBhbnk7XG5cbiAgLyoqIFdoZW4gZGVhbGluZyB3aXRoIGEgbm9uLWltcGxlbWVudGVkIG1ldGhvZCBvciBhIG1ldGhvZCBub3QgYWxsb3dlZCwgdGhyb3dcbiAgICogYW4gZXJyb3IgaW5zdGVhZCBvZiBzZXR0aW5nIHRoZSBzdGF0dXMgYW5kIGhlYWRlciBmb3IgdGhlIHJlc3BvbnNlLiAqL1xuICB0aHJvdz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUm91dGU8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuPiB7XG4gIC8qKiBUaGUgSFRUUCBtZXRob2RzIHRoYXQgdGhpcyByb3V0ZSBoYW5kbGVzLiAqL1xuICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdO1xuXG4gIC8qKiBUaGUgbWlkZGxld2FyZSB0aGF0IHdpbGwgYmUgYXBwbGllZCB0byB0aGlzIHJvdXRlLiAqL1xuICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W107XG5cbiAgLyoqIEFuIG9wdGlvbmFsIG5hbWUgZm9yIHRoZSByb3V0ZS4gKi9cbiAgbmFtZT86IHN0cmluZztcblxuICAvKiogT3B0aW9ucyB0aGF0IHdlcmUgdXNlZCB0byBjcmVhdGUgdGhlIHJvdXRlLiAqL1xuICBvcHRpb25zOiBMYXllck9wdGlvbnM7XG5cbiAgLyoqIFRoZSBwYXJhbWV0ZXJzIHRoYXQgYXJlIGlkZW50aWZpZWQgaW4gdGhlIHJvdXRlIHRoYXQgd2lsbCBiZSBwYXJzZWQgb3V0XG4gICAqIG9uIG1hdGNoZWQgcmVxdWVzdHMuICovXG4gIHBhcmFtTmFtZXM6IChrZXlvZiBQKVtdO1xuXG4gIC8qKiBUaGUgcGF0aCB0aGF0IHRoaXMgcm91dGUgbWFuYWdlcy4gKi9cbiAgcGF0aDogc3RyaW5nO1xuXG4gIC8qKiBUaGUgcmVndWxhciBleHByZXNzaW9uIHVzZWQgZm9yIG1hdGNoaW5nIGFuZCBwYXJzaW5nIHBhcmFtZXRlcnMgZm9yIHRoZVxuICAgKiByb3V0ZS4gKi9cbiAgcmVnZXhwOiBSZWdFeHA7XG59XG5cbi8qKiBUaGUgY29udGV4dCBwYXNzZWQgcm91dGVyIG1pZGRsZXdhcmUuICAqL1xuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXJDb250ZXh0PFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4gZXh0ZW5kcyBDb250ZXh0PFM+IHtcbiAgLyoqIFdoZW4gbWF0Y2hpbmcgdGhlIHJvdXRlLCBhbiBhcnJheSBvZiB0aGUgY2FwdHVyaW5nIGdyb3VwcyBmcm9tIHRoZSByZWd1bGFyXG4gICAqIGV4cHJlc3Npb24uICovXG4gIGNhcHR1cmVzOiBzdHJpbmdbXTtcblxuICAvKiogVGhlIHJvdXRlcyB0aGF0IHdlcmUgbWF0Y2hlZCBmb3IgdGhpcyByZXF1ZXN0LiAqL1xuICBtYXRjaGVkPzogTGF5ZXI8UiwgUCwgUz5bXTtcblxuICAvKiogQW55IHBhcmFtZXRlcnMgcGFyc2VkIGZyb20gdGhlIHJvdXRlIHdoZW4gbWF0Y2hlZC4gKi9cbiAgcGFyYW1zOiBQO1xuXG4gIC8qKiBBIHJlZmVyZW5jZSB0byB0aGUgcm91dGVyIGluc3RhbmNlLiAqL1xuICByb3V0ZXI6IFJvdXRlcjtcblxuICAvKiogSWYgdGhlIG1hdGNoZWQgcm91dGUgaGFzIGEgYG5hbWVgLCB0aGUgbWF0Y2hlZCByb3V0ZSBuYW1lIGlzIHByb3ZpZGVkXG4gICAqIGhlcmUuICovXG4gIHJvdXRlTmFtZT86IHN0cmluZztcblxuICAvKiogT3ZlcnJpZGVzIHRoZSBtYXRjaGVkIHBhdGggZm9yIGZ1dHVyZSByb3V0ZSBtaWRkbGV3YXJlLCB3aGVuIGFcbiAgICogYHJvdXRlclBhdGhgIG9wdGlvbiBpcyBub3QgZGVmaW5lZCBvbiB0aGUgYFJvdXRlcmAgb3B0aW9ucy4gKi9cbiAgcm91dGVyUGF0aD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSb3V0ZXJNaWRkbGV3YXJlPFxuICBSIGV4dGVuZHMgc3RyaW5nLFxuICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4ge1xuICAoY29udGV4dDogUm91dGVyQ29udGV4dDxSLCBQLCBTPiwgbmV4dDogKCkgPT4gUHJvbWlzZTx1bmtub3duPik6XG4gICAgfCBQcm9taXNlPHVua25vd24+XG4gICAgfCB1bmtub3duO1xuICAvKiogRm9yIHJvdXRlIHBhcmFtZXRlciBtaWRkbGV3YXJlLCB0aGUgYHBhcmFtYCBrZXkgZm9yIHRoaXMgcGFyYW1ldGVyIHdpbGxcbiAgICogYmUgc2V0LiAqL1xuICBwYXJhbT86IGtleW9mIFA7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIHJvdXRlcj86IFJvdXRlcjxhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlck9wdGlvbnMge1xuICAvKiogT3ZlcnJpZGUgdGhlIGRlZmF1bHQgc2V0IG9mIG1ldGhvZHMgc3VwcG9ydGVkIGJ5IHRoZSByb3V0ZXIuICovXG4gIG1ldGhvZHM/OiBIVFRQTWV0aG9kc1tdO1xuXG4gIC8qKiBPbmx5IGhhbmRsZSByb3V0ZXMgd2hlcmUgdGhlIHJlcXVlc3RlZCBwYXRoIHN0YXJ0cyB3aXRoIHRoZSBwcmVmaXguICovXG4gIHByZWZpeD86IHN0cmluZztcblxuICAvKiogT3ZlcnJpZGUgdGhlIGByZXF1ZXN0LnVybC5wYXRobmFtZWAgd2hlbiBtYXRjaGluZyBtaWRkbGV3YXJlIHRvIHJ1bi4gKi9cbiAgcm91dGVyUGF0aD86IHN0cmluZztcblxuICAvKiogRGV0ZXJtaW5lcyBpZiByb3V0ZXMgYXJlIG1hdGNoZWQgaW4gYSBjYXNlIHNlbnNpdGl2ZSB3YXkuICBEZWZhdWx0cyB0b1xuICAgKiBgZmFsc2VgLiAqL1xuICBzZW5zaXRpdmU/OiBib29sZWFuO1xuXG4gIC8qKiBEZXRlcm1pbmVzIGlmIHJvdXRlcyBhcmUgbWF0Y2hlZCBzdHJpY3RseSwgd2hlcmUgdGhlIHRyYWlsaW5nIGAvYCBpcyBub3RcbiAgICogb3B0aW9uYWwuICBEZWZhdWx0cyB0byBgZmFsc2VgLiAqL1xuICBzdHJpY3Q/OiBib29sZWFuO1xufVxuXG4vKiogTWlkZGxld2FyZSB0aGF0IHdpbGwgYmUgY2FsbGVkIGJ5IHRoZSByb3V0ZXIgd2hlbiBoYW5kbGluZyBhIHNwZWNpZmljXG4gKiBwYXJhbWV0ZXIsIHdoaWNoIHRoZSBtaWRkbGV3YXJlIHdpbGwgYmUgY2FsbGVkIHdoZW4gYSByZXF1ZXN0IG1hdGNoZXMgdGhlXG4gKiByb3V0ZSBwYXJhbWV0ZXIuICovXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlclBhcmFtTWlkZGxld2FyZTxcbiAgUiBleHRlbmRzIHN0cmluZyxcbiAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIFMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4sXG4+IHtcbiAgKFxuICAgIHBhcmFtOiBzdHJpbmcsXG4gICAgY29udGV4dDogUm91dGVyQ29udGV4dDxSLCBQLCBTPixcbiAgICBuZXh0OiAoKSA9PiBQcm9taXNlPHVua25vd24+LFxuICApOiBQcm9taXNlPHVua25vd24+IHwgdW5rbm93bjtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcm91dGVyPzogUm91dGVyPGFueT47XG59XG5cbmludGVyZmFjZSBQYXJhbXNEaWN0aW9uYXJ5IHtcbiAgW2tleTogc3RyaW5nXTogc3RyaW5nO1xufVxuXG50eXBlIFJlbW92ZVRhaWw8UyBleHRlbmRzIHN0cmluZywgVGFpbCBleHRlbmRzIHN0cmluZz4gPSBTIGV4dGVuZHNcbiAgYCR7aW5mZXIgUH0ke1RhaWx9YCA/IFAgOiBTO1xuXG50eXBlIEdldFJvdXRlUGFyYW1zPFMgZXh0ZW5kcyBzdHJpbmc+ID0gUmVtb3ZlVGFpbDxcbiAgUmVtb3ZlVGFpbDxSZW1vdmVUYWlsPFMsIGAvJHtzdHJpbmd9YD4sIGAtJHtzdHJpbmd9YD4sXG4gIGAuJHtzdHJpbmd9YFxuPjtcblxuZXhwb3J0IHR5cGUgUm91dGVQYXJhbXM8Um91dGUgZXh0ZW5kcyBzdHJpbmc+ID0gc3RyaW5nIGV4dGVuZHMgUm91dGVcbiAgPyBQYXJhbXNEaWN0aW9uYXJ5XG4gIDogUm91dGUgZXh0ZW5kcyBgJHtzdHJpbmd9KCR7c3RyaW5nfWAgPyBQYXJhbXNEaWN0aW9uYXJ5XG4gIDogUm91dGUgZXh0ZW5kcyBgJHtzdHJpbmd9OiR7aW5mZXIgUmVzdH1gID8gXG4gICAgJiAoXG4gICAgICBHZXRSb3V0ZVBhcmFtczxSZXN0PiBleHRlbmRzIG5ldmVyID8gUGFyYW1zRGljdGlvbmFyeVxuICAgICAgICA6IEdldFJvdXRlUGFyYW1zPFJlc3Q+IGV4dGVuZHMgYCR7aW5mZXIgUGFyYW1OYW1lfT9gXG4gICAgICAgICAgPyB7IFtQIGluIFBhcmFtTmFtZV0/OiBzdHJpbmcgfVxuICAgICAgICA6IHsgW1AgaW4gR2V0Um91dGVQYXJhbXM8UmVzdD5dOiBzdHJpbmcgfVxuICAgIClcbiAgICAmIChSZXN0IGV4dGVuZHMgYCR7R2V0Um91dGVQYXJhbXM8UmVzdD59JHtpbmZlciBOZXh0fWAgPyBSb3V0ZVBhcmFtczxOZXh0PlxuICAgICAgOiB1bmtub3duKVxuICA6IFJlY29yZDxzdHJpbmcgfCBudW1iZXIsIHN0cmluZyB8IHVuZGVmaW5lZD47XG5cbnR5cGUgTGF5ZXJPcHRpb25zID0gVG9rZW5zVG9SZWdleHBPcHRpb25zICYgUGFyc2VPcHRpb25zICYge1xuICBpZ25vcmVDYXB0dXJlcz86IGJvb2xlYW47XG4gIG5hbWU/OiBzdHJpbmc7XG59O1xuXG50eXBlIFJlZ2lzdGVyT3B0aW9ucyA9IExheWVyT3B0aW9ucyAmIHtcbiAgaWdub3JlUHJlZml4PzogYm9vbGVhbjtcbn07XG5cbnR5cGUgVXJsT3B0aW9ucyA9IFRva2Vuc1RvUmVnZXhwT3B0aW9ucyAmIFBhcnNlT3B0aW9ucyAmIHtcbiAgLyoqIFdoZW4gZ2VuZXJhdGluZyBhIFVSTCBmcm9tIGEgcm91dGUsIGFkZCB0aGUgcXVlcnkgdG8gdGhlIFVSTC4gIElmIGFuXG4gICAqIG9iamVjdCAqL1xuICBxdWVyeT86IFVSTFNlYXJjaFBhcmFtcyB8IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBzdHJpbmc7XG59O1xuXG4vKiogR2VuZXJhdGUgYSBVUkwgZnJvbSBhIHN0cmluZywgcG90ZW50aWFsbHkgcmVwbGFjZSByb3V0ZSBwYXJhbXMgd2l0aFxuICogdmFsdWVzLiAqL1xuZnVuY3Rpb24gdG9Vcmw8UiBleHRlbmRzIHN0cmluZz4oXG4gIHVybDogc3RyaW5nLFxuICBwYXJhbXMgPSB7fSBhcyBSb3V0ZVBhcmFtczxSPixcbiAgb3B0aW9ucz86IFVybE9wdGlvbnMsXG4pIHtcbiAgY29uc3QgdG9rZW5zID0gcGF0aFBhcnNlKHVybCk7XG4gIGxldCByZXBsYWNlID0ge30gYXMgUm91dGVQYXJhbXM8Uj47XG5cbiAgaWYgKHRva2Vucy5zb21lKCh0b2tlbikgPT4gdHlwZW9mIHRva2VuID09PSBcIm9iamVjdFwiKSkge1xuICAgIHJlcGxhY2UgPSBwYXJhbXM7XG4gIH0gZWxzZSB7XG4gICAgb3B0aW9ucyA9IHBhcmFtcztcbiAgfVxuXG4gIGNvbnN0IHRvUGF0aCA9IGNvbXBpbGUodXJsLCBvcHRpb25zKTtcbiAgY29uc3QgcmVwbGFjZWQgPSB0b1BhdGgocmVwbGFjZSk7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5xdWVyeSkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVwbGFjZWQsIFwiaHR0cDovL29ha1wiKTtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMucXVlcnkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHVybC5zZWFyY2ggPSBvcHRpb25zLnF1ZXJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICB1cmwuc2VhcmNoID0gU3RyaW5nKFxuICAgICAgICBvcHRpb25zLnF1ZXJ5IGluc3RhbmNlb2YgVVJMU2VhcmNoUGFyYW1zXG4gICAgICAgICAgPyBvcHRpb25zLnF1ZXJ5XG4gICAgICAgICAgOiBuZXcgVVJMU2VhcmNoUGFyYW1zKG9wdGlvbnMucXVlcnkpLFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIGAke3VybC5wYXRobmFtZX0ke3VybC5zZWFyY2h9JHt1cmwuaGFzaH1gO1xuICB9XG4gIHJldHVybiByZXBsYWNlZDtcbn1cblxuY2xhc3MgTGF5ZXI8XG4gIFIgZXh0ZW5kcyBzdHJpbmcsXG4gIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBTIGV4dGVuZHMgU3RhdGUgPSBSZWNvcmQ8c3RyaW5nLCBhbnk+LFxuPiB7XG4gICNvcHRzOiBMYXllck9wdGlvbnM7XG4gICNwYXJhbU5hbWVzOiBLZXlbXSA9IFtdO1xuICAjcmVnZXhwOiBSZWdFeHA7XG5cbiAgbWV0aG9kczogSFRUUE1ldGhvZHNbXTtcbiAgbmFtZT86IHN0cmluZztcbiAgcGF0aDogc3RyaW5nO1xuICBzdGFjazogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4gfCBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W10sXG4gICAgeyBuYW1lLCAuLi5vcHRzIH06IExheWVyT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICB0aGlzLiNvcHRzID0gb3B0cztcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIHRoaXMubWV0aG9kcyA9IFsuLi5tZXRob2RzXTtcbiAgICBpZiAodGhpcy5tZXRob2RzLmluY2x1ZGVzKFwiR0VUXCIpKSB7XG4gICAgICB0aGlzLm1ldGhvZHMudW5zaGlmdChcIkhFQURcIik7XG4gICAgfVxuICAgIHRoaXMuc3RhY2sgPSBBcnJheS5pc0FycmF5KG1pZGRsZXdhcmUpID8gbWlkZGxld2FyZS5zbGljZSgpIDogW21pZGRsZXdhcmVdO1xuICAgIHRoaXMucGF0aCA9IHBhdGg7XG4gICAgdGhpcy4jcmVnZXhwID0gcGF0aFRvUmVnZXhwKHBhdGgsIHRoaXMuI3BhcmFtTmFtZXMsIHRoaXMuI29wdHMpO1xuICB9XG5cbiAgY2xvbmUoKTogTGF5ZXI8UiwgUCwgUz4ge1xuICAgIHJldHVybiBuZXcgTGF5ZXIoXG4gICAgICB0aGlzLnBhdGgsXG4gICAgICB0aGlzLm1ldGhvZHMsXG4gICAgICB0aGlzLnN0YWNrLFxuICAgICAgeyBuYW1lOiB0aGlzLm5hbWUsIC4uLnRoaXMuI29wdHMgfSxcbiAgICApO1xuICB9XG5cbiAgbWF0Y2gocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuI3JlZ2V4cC50ZXN0KHBhdGgpO1xuICB9XG5cbiAgcGFyYW1zKFxuICAgIGNhcHR1cmVzOiBzdHJpbmdbXSxcbiAgICBleGlzdGluZ1BhcmFtcyA9IHt9IGFzIFJvdXRlUGFyYW1zPFI+LFxuICApOiBSb3V0ZVBhcmFtczxSPiB7XG4gICAgY29uc3QgcGFyYW1zID0gZXhpc3RpbmdQYXJhbXM7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYXB0dXJlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHRoaXMuI3BhcmFtTmFtZXNbaV0pIHtcbiAgICAgICAgY29uc3QgYyA9IGNhcHR1cmVzW2ldO1xuICAgICAgICBwYXJhbXNbdGhpcy4jcGFyYW1OYW1lc1tpXS5uYW1lXSA9IGMgPyBkZWNvZGVDb21wb25lbnQoYykgOiBjO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGFyYW1zO1xuICB9XG5cbiAgY2FwdHVyZXMocGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGlmICh0aGlzLiNvcHRzLmlnbm9yZUNhcHR1cmVzKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiBwYXRoLm1hdGNoKHRoaXMuI3JlZ2V4cCk/LnNsaWNlKDEpID8/IFtdO1xuICB9XG5cbiAgdXJsKFxuICAgIHBhcmFtcyA9IHt9IGFzIFJvdXRlUGFyYW1zPFI+LFxuICAgIG9wdGlvbnM/OiBVcmxPcHRpb25zLFxuICApOiBzdHJpbmcge1xuICAgIGNvbnN0IHVybCA9IHRoaXMucGF0aC5yZXBsYWNlKC9cXChcXC5cXCpcXCkvZywgXCJcIik7XG4gICAgcmV0dXJuIHRvVXJsKHVybCwgcGFyYW1zLCBvcHRpb25zKTtcbiAgfVxuXG4gIHBhcmFtKFxuICAgIHBhcmFtOiBzdHJpbmcsXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBmbjogUm91dGVyUGFyYW1NaWRkbGV3YXJlPGFueSwgYW55LCBhbnk+LFxuICApIHtcbiAgICBjb25zdCBzdGFjayA9IHRoaXMuc3RhY2s7XG4gICAgY29uc3QgcGFyYW1zID0gdGhpcy4jcGFyYW1OYW1lcztcbiAgICBjb25zdCBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFI+ID0gZnVuY3Rpb24gKFxuICAgICAgdGhpczogUm91dGVyLFxuICAgICAgY3R4LFxuICAgICAgbmV4dCxcbiAgICApOiBQcm9taXNlPHVua25vd24+IHwgdW5rbm93biB7XG4gICAgICBjb25zdCBwID0gY3R4LnBhcmFtc1twYXJhbV07XG4gICAgICBhc3NlcnQocCk7XG4gICAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBwLCBjdHgsIG5leHQpO1xuICAgIH07XG4gICAgbWlkZGxld2FyZS5wYXJhbSA9IHBhcmFtO1xuXG4gICAgY29uc3QgbmFtZXMgPSBwYXJhbXMubWFwKChwKSA9PiBwLm5hbWUpO1xuXG4gICAgY29uc3QgeCA9IG5hbWVzLmluZGV4T2YocGFyYW0pO1xuICAgIGlmICh4ID49IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgZm4gPSBzdGFja1tpXTtcbiAgICAgICAgaWYgKCFmbi5wYXJhbSB8fCBuYW1lcy5pbmRleE9mKGZuLnBhcmFtIGFzIChzdHJpbmcgfCBudW1iZXIpKSA+IHgpIHtcbiAgICAgICAgICBzdGFjay5zcGxpY2UoaSwgMCwgbWlkZGxld2FyZSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRQcmVmaXgocHJlZml4OiBzdHJpbmcpOiB0aGlzIHtcbiAgICBpZiAodGhpcy5wYXRoKSB7XG4gICAgICB0aGlzLnBhdGggPSB0aGlzLnBhdGggIT09IFwiL1wiIHx8IHRoaXMuI29wdHMuc3RyaWN0ID09PSB0cnVlXG4gICAgICAgID8gYCR7cHJlZml4fSR7dGhpcy5wYXRofWBcbiAgICAgICAgOiBwcmVmaXg7XG4gICAgICB0aGlzLiNwYXJhbU5hbWVzID0gW107XG4gICAgICB0aGlzLiNyZWdleHAgPSBwYXRoVG9SZWdleHAodGhpcy5wYXRoLCB0aGlzLiNwYXJhbU5hbWVzLCB0aGlzLiNvcHRzKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICB0b0pTT04oKTogUm91dGU8YW55LCBhbnksIGFueT4ge1xuICAgIHJldHVybiB7XG4gICAgICBtZXRob2RzOiBbLi4udGhpcy5tZXRob2RzXSxcbiAgICAgIG1pZGRsZXdhcmU6IFsuLi50aGlzLnN0YWNrXSxcbiAgICAgIHBhcmFtTmFtZXM6IHRoaXMuI3BhcmFtTmFtZXMubWFwKChrZXkpID0+IGtleS5uYW1lKSxcbiAgICAgIHBhdGg6IHRoaXMucGF0aCxcbiAgICAgIHJlZ2V4cDogdGhpcy4jcmVnZXhwLFxuICAgICAgb3B0aW9uczogeyAuLi50aGlzLiNvcHRzIH0sXG4gICAgfTtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXShpbnNwZWN0OiAodmFsdWU6IHVua25vd24pID0+IHN0cmluZykge1xuICAgIHJldHVybiBgJHt0aGlzLmNvbnN0cnVjdG9yLm5hbWV9ICR7XG4gICAgICBpbnNwZWN0KHtcbiAgICAgICAgbWV0aG9kczogdGhpcy5tZXRob2RzLFxuICAgICAgICBtaWRkbGV3YXJlOiB0aGlzLnN0YWNrLFxuICAgICAgICBvcHRpb25zOiB0aGlzLiNvcHRzLFxuICAgICAgICBwYXJhbU5hbWVzOiB0aGlzLiNwYXJhbU5hbWVzLm1hcCgoa2V5KSA9PiBrZXkubmFtZSksXG4gICAgICAgIHBhdGg6IHRoaXMucGF0aCxcbiAgICAgICAgcmVnZXhwOiB0aGlzLiNyZWdleHAsXG4gICAgICB9KVxuICAgIH1gO1xuICB9XG59XG5cbi8qKiBBbiBpbnRlcmZhY2UgZm9yIHJlZ2lzdGVyaW5nIG1pZGRsZXdhcmUgdGhhdCB3aWxsIHJ1biB3aGVuIGNlcnRhaW4gSFRUUFxuICogbWV0aG9kcyBhbmQgcGF0aHMgYXJlIHJlcXVlc3RlZCwgYXMgd2VsbCBhcyBwcm92aWRlcyBhIHdheSB0byBwYXJhbWV0ZXJpemVcbiAqIHBhcnRzIG9mIHRoZSByZXF1ZXN0ZWQgcGF0aC5cbiAqXG4gKiAjIyMgQmFzaWMgZXhhbXBsZVxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBBcHBsaWNhdGlvbiwgUm91dGVyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3gvb2FrL21vZC50c1wiO1xuICpcbiAqIGNvbnN0IHJvdXRlciA9IG5ldyBSb3V0ZXIoKTtcbiAqIHJvdXRlci5nZXQoXCIvXCIsIChjdHgsIG5leHQpID0+IHtcbiAqICAgLy8gaGFuZGxlIHRoZSBHRVQgZW5kcG9pbnQgaGVyZVxuICogfSk7XG4gKiByb3V0ZXIuYWxsKFwiL2l0ZW0vOml0ZW1cIiwgKGN0eCwgbmV4dCkgPT4ge1xuICogICAvLyBjYWxsZWQgZm9yIGFsbCBIVFRQIHZlcmJzL3JlcXVlc3RzXG4gKiAgIGN0eC5wYXJhbXMuaXRlbTsgLy8gY29udGFpbnMgdGhlIHZhbHVlIG9mIGA6aXRlbWAgZnJvbSB0aGUgcGFyc2VkIFVSTFxuICogfSk7XG4gKlxuICogY29uc3QgYXBwID0gbmV3IEFwcGxpY2F0aW9uKCk7XG4gKiBhcHAudXNlKHJvdXRlci5yb3V0ZXMoKSk7XG4gKiBhcHAudXNlKHJvdXRlci5hbGxvd2VkTWV0aG9kcygpKTtcbiAqXG4gKiBhcHAubGlzdGVuKHsgcG9ydDogODA4MCB9KTtcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgUm91dGVyPFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBSUyBleHRlbmRzIFN0YXRlID0gUmVjb3JkPHN0cmluZywgYW55Pixcbj4ge1xuICAjb3B0czogUm91dGVyT3B0aW9ucztcbiAgI21ldGhvZHM6IEhUVFBNZXRob2RzW107XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICNwYXJhbXM6IFJlY29yZDxzdHJpbmcsIFJvdXRlclBhcmFtTWlkZGxld2FyZTxhbnksIGFueSwgYW55Pj4gPSB7fTtcbiAgI3N0YWNrOiBMYXllcjxzdHJpbmc+W10gPSBbXTtcblxuICAjbWF0Y2gocGF0aDogc3RyaW5nLCBtZXRob2Q6IEhUVFBNZXRob2RzKTogTWF0Y2hlczxzdHJpbmc+IHtcbiAgICBjb25zdCBtYXRjaGVzOiBNYXRjaGVzPHN0cmluZz4gPSB7XG4gICAgICBwYXRoOiBbXSxcbiAgICAgIHBhdGhBbmRNZXRob2Q6IFtdLFxuICAgICAgcm91dGU6IGZhbHNlLFxuICAgIH07XG5cbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMuI3N0YWNrKSB7XG4gICAgICBpZiAocm91dGUubWF0Y2gocGF0aCkpIHtcbiAgICAgICAgbWF0Y2hlcy5wYXRoLnB1c2gocm91dGUpO1xuICAgICAgICBpZiAocm91dGUubWV0aG9kcy5sZW5ndGggPT09IDAgfHwgcm91dGUubWV0aG9kcy5pbmNsdWRlcyhtZXRob2QpKSB7XG4gICAgICAgICAgbWF0Y2hlcy5wYXRoQW5kTWV0aG9kLnB1c2gocm91dGUpO1xuICAgICAgICAgIGlmIChyb3V0ZS5tZXRob2RzLmxlbmd0aCkge1xuICAgICAgICAgICAgbWF0Y2hlcy5yb3V0ZSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoZXM7XG4gIH1cblxuICAjcmVnaXN0ZXIoXG4gICAgcGF0aDogc3RyaW5nIHwgc3RyaW5nW10sXG4gICAgbWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgIG1ldGhvZHM6IEhUVFBNZXRob2RzW10sXG4gICAgb3B0aW9uczogUmVnaXN0ZXJPcHRpb25zID0ge30sXG4gICk6IHZvaWQge1xuICAgIGlmIChBcnJheS5pc0FycmF5KHBhdGgpKSB7XG4gICAgICBmb3IgKGNvbnN0IHAgb2YgcGF0aCkge1xuICAgICAgICB0aGlzLiNyZWdpc3RlcihwLCBtaWRkbGV3YXJlcywgbWV0aG9kcywgb3B0aW9ucyk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGxheWVyTWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdID0gW107XG4gICAgZm9yIChjb25zdCBtaWRkbGV3YXJlIG9mIG1pZGRsZXdhcmVzKSB7XG4gICAgICBpZiAoIW1pZGRsZXdhcmUucm91dGVyKSB7XG4gICAgICAgIGxheWVyTWlkZGxld2FyZXMucHVzaChtaWRkbGV3YXJlKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXllck1pZGRsZXdhcmVzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLiNhZGRMYXllcihwYXRoLCBsYXllck1pZGRsZXdhcmVzLCBtZXRob2RzLCBvcHRpb25zKTtcbiAgICAgICAgbGF5ZXJNaWRkbGV3YXJlcyA9IFtdO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByb3V0ZXIgPSBtaWRkbGV3YXJlLnJvdXRlci4jY2xvbmUoKTtcblxuICAgICAgZm9yIChjb25zdCBsYXllciBvZiByb3V0ZXIuI3N0YWNrKSB7XG4gICAgICAgIGlmICghb3B0aW9ucy5pZ25vcmVQcmVmaXgpIHtcbiAgICAgICAgICBsYXllci5zZXRQcmVmaXgocGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuI29wdHMucHJlZml4KSB7XG4gICAgICAgICAgbGF5ZXIuc2V0UHJlZml4KHRoaXMuI29wdHMucHJlZml4KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiNzdGFjay5wdXNoKGxheWVyKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBbcGFyYW0sIG13XSBvZiBPYmplY3QuZW50cmllcyh0aGlzLiNwYXJhbXMpKSB7XG4gICAgICAgIHJvdXRlci5wYXJhbShwYXJhbSwgbXcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsYXllck1pZGRsZXdhcmVzLmxlbmd0aCkge1xuICAgICAgdGhpcy4jYWRkTGF5ZXIocGF0aCwgbGF5ZXJNaWRkbGV3YXJlcywgbWV0aG9kcywgb3B0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgI2FkZExheWVyKFxuICAgIHBhdGg6IHN0cmluZyxcbiAgICBtaWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgbWV0aG9kczogSFRUUE1ldGhvZHNbXSxcbiAgICBvcHRpb25zOiBMYXllck9wdGlvbnMgPSB7fSxcbiAgKSB7XG4gICAgY29uc3Qge1xuICAgICAgZW5kLFxuICAgICAgbmFtZSxcbiAgICAgIHNlbnNpdGl2ZSA9IHRoaXMuI29wdHMuc2Vuc2l0aXZlLFxuICAgICAgc3RyaWN0ID0gdGhpcy4jb3B0cy5zdHJpY3QsXG4gICAgICBpZ25vcmVDYXB0dXJlcyxcbiAgICB9ID0gb3B0aW9ucztcbiAgICBjb25zdCByb3V0ZSA9IG5ldyBMYXllcihwYXRoLCBtZXRob2RzLCBtaWRkbGV3YXJlcywge1xuICAgICAgZW5kLFxuICAgICAgbmFtZSxcbiAgICAgIHNlbnNpdGl2ZSxcbiAgICAgIHN0cmljdCxcbiAgICAgIGlnbm9yZUNhcHR1cmVzLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuI29wdHMucHJlZml4KSB7XG4gICAgICByb3V0ZS5zZXRQcmVmaXgodGhpcy4jb3B0cy5wcmVmaXgpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgW3BhcmFtLCBtd10gb2YgT2JqZWN0LmVudHJpZXModGhpcy4jcGFyYW1zKSkge1xuICAgICAgcm91dGUucGFyYW0ocGFyYW0sIG13KTtcbiAgICB9XG5cbiAgICB0aGlzLiNzdGFjay5wdXNoKHJvdXRlKTtcbiAgfVxuXG4gICNyb3V0ZShuYW1lOiBzdHJpbmcpOiBMYXllcjxzdHJpbmc+IHwgdW5kZWZpbmVkIHtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMuI3N0YWNrKSB7XG4gICAgICBpZiAocm91dGUubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICByZXR1cm4gcm91dGU7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgI3VzZVZlcmIoXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICBtZXRob2RzOiBIVFRQTWV0aG9kc1tdLFxuICApOiB2b2lkIHtcbiAgICBsZXQgbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGxldCBwYXRoOiBzdHJpbmc7XG4gICAgaWYgKHR5cGVvZiBwYXRoT3JNaWRkbGV3YXJlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICBuYW1lID0gbmFtZU9yUGF0aDtcbiAgICAgIHBhdGggPSBwYXRoT3JNaWRkbGV3YXJlO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXRoID0gbmFtZU9yUGF0aDtcbiAgICAgIG1pZGRsZXdhcmUudW5zaGlmdChwYXRoT3JNaWRkbGV3YXJlKTtcbiAgICB9XG5cbiAgICB0aGlzLiNyZWdpc3RlcihwYXRoLCBtaWRkbGV3YXJlLCBtZXRob2RzLCB7IG5hbWUgfSk7XG4gIH1cblxuICAjY2xvbmUoKTogUm91dGVyPFJTPiB7XG4gICAgY29uc3Qgcm91dGVyID0gbmV3IFJvdXRlcjxSUz4odGhpcy4jb3B0cyk7XG4gICAgcm91dGVyLiNtZXRob2RzID0gcm91dGVyLiNtZXRob2RzLnNsaWNlKCk7XG4gICAgcm91dGVyLiNwYXJhbXMgPSB7IC4uLnRoaXMuI3BhcmFtcyB9O1xuICAgIHJvdXRlci4jc3RhY2sgPSB0aGlzLiNzdGFjay5tYXAoKGxheWVyKSA9PiBsYXllci5jbG9uZSgpKTtcbiAgICByZXR1cm4gcm91dGVyO1xuICB9XG5cbiAgY29uc3RydWN0b3Iob3B0czogUm91dGVyT3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy4jb3B0cyA9IG9wdHM7XG4gICAgdGhpcy4jbWV0aG9kcyA9IG9wdHMubWV0aG9kcyA/PyBbXG4gICAgICBcIkRFTEVURVwiLFxuICAgICAgXCJHRVRcIixcbiAgICAgIFwiSEVBRFwiLFxuICAgICAgXCJPUFRJT05TXCIsXG4gICAgICBcIlBBVENIXCIsXG4gICAgICBcIlBPU1RcIixcbiAgICAgIFwiUFVUXCIsXG4gICAgXTtcbiAgfVxuXG4gIC8qKiBSZWdpc3RlciBuYW1lZCBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgREVMRVRFYCxcbiAgICogYEdFVGAsIGBQT1NUYCwgb3IgYFBVVGAgbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgYWxsPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYERFTEVURWAsXG4gICAqIGBHRVRgLCBgUE9TVGAsIG9yIGBQVVRgIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGFsbDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBhbGw8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJERUxFVEVcIiwgXCJHRVRcIiwgXCJQT1NUXCIsIFwiUFVUXCJdLFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogTWlkZGxld2FyZSB0aGF0IGhhbmRsZXMgcmVxdWVzdHMgZm9yIEhUVFAgbWV0aG9kcyByZWdpc3RlcmVkIHdpdGggdGhlXG4gICAqIHJvdXRlci4gIElmIG5vbmUgb2YgdGhlIHJvdXRlcyBoYW5kbGUgYSBtZXRob2QsIHRoZW4gXCJub3QgYWxsb3dlZFwiIGxvZ2ljXG4gICAqIHdpbGwgYmUgdXNlZC4gIElmIGEgbWV0aG9kIGlzIHN1cHBvcnRlZCBieSBzb21lIHJvdXRlcywgYnV0IG5vdCB0aGVcbiAgICogcGFydGljdWxhciBtYXRjaGVkIHJvdXRlciwgdGhlbiBcIm5vdCBpbXBsZW1lbnRlZFwiIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAqXG4gICAqIFRoZSBtaWRkbGV3YXJlIHdpbGwgYWxzbyBhdXRvbWF0aWNhbGx5IGhhbmRsZSB0aGUgYE9QVElPTlNgIG1ldGhvZCxcbiAgICogcmVzcG9uZGluZyB3aXRoIGEgYDIwMCBPS2Agd2hlbiB0aGUgYEFsbG93ZWRgIGhlYWRlciBzZW50IHRvIHRoZSBhbGxvd2VkXG4gICAqIG1ldGhvZHMgZm9yIGEgZ2l2ZW4gcm91dGUuXG4gICAqXG4gICAqIEJ5IGRlZmF1bHQsIGEgXCJub3QgYWxsb3dlZFwiIHJlcXVlc3Qgd2lsbCByZXNwb25kIHdpdGggYSBgNDA1IE5vdCBBbGxvd2VkYFxuICAgKiBhbmQgYSBcIm5vdCBpbXBsZW1lbnRlZFwiIHdpbGwgcmVzcG9uZCB3aXRoIGEgYDUwMSBOb3QgSW1wbGVtZW50ZWRgLiBTZXR0aW5nXG4gICAqIHRoZSBvcHRpb24gYC50aHJvd2AgdG8gYHRydWVgIHdpbGwgY2F1c2UgdGhlIG1pZGRsZXdhcmUgdG8gdGhyb3cgYW5cbiAgICogYEhUVFBFcnJvcmAgaW5zdGVhZCBvZiBzZXR0aW5nIHRoZSByZXNwb25zZSBzdGF0dXMuICBUaGUgZXJyb3IgY2FuIGJlXG4gICAqIG92ZXJyaWRkZW4gYnkgcHJvdmlkaW5nIGEgYC5ub3RJbXBsZW1lbnRlZGAgb3IgYC5ub3RBbGxvd2VkYCBtZXRob2QgaW4gdGhlXG4gICAqIG9wdGlvbnMsIG9mIHdoaWNoIHRoZSB2YWx1ZSB3aWxsIGJlIHJldHVybmVkIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgdGhlXG4gICAqIEhUVFAgZXJyb3IuICovXG4gIGFsbG93ZWRNZXRob2RzKFxuICAgIG9wdGlvbnM6IFJvdXRlckFsbG93ZWRNZXRob2RzT3B0aW9ucyA9IHt9LFxuICApOiBNaWRkbGV3YXJlIHtcbiAgICBjb25zdCBpbXBsZW1lbnRlZCA9IHRoaXMuI21ldGhvZHM7XG5cbiAgICBjb25zdCBhbGxvd2VkTWV0aG9kczogTWlkZGxld2FyZSA9IGFzeW5jIChjb250ZXh0LCBuZXh0KSA9PiB7XG4gICAgICBjb25zdCBjdHggPSBjb250ZXh0IGFzIFJvdXRlckNvbnRleHQ8c3RyaW5nPjtcbiAgICAgIGF3YWl0IG5leHQoKTtcbiAgICAgIGlmICghY3R4LnJlc3BvbnNlLnN0YXR1cyB8fCBjdHgucmVzcG9uc2Uuc3RhdHVzID09PSBTdGF0dXMuTm90Rm91bmQpIHtcbiAgICAgICAgYXNzZXJ0KGN0eC5tYXRjaGVkKTtcbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IG5ldyBTZXQ8SFRUUE1ldGhvZHM+KCk7XG4gICAgICAgIGZvciAoY29uc3Qgcm91dGUgb2YgY3R4Lm1hdGNoZWQpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiByb3V0ZS5tZXRob2RzKSB7XG4gICAgICAgICAgICBhbGxvd2VkLmFkZChtZXRob2QpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbG93ZWRTdHIgPSBbLi4uYWxsb3dlZF0uam9pbihcIiwgXCIpO1xuICAgICAgICBpZiAoIWltcGxlbWVudGVkLmluY2x1ZGVzKGN0eC5yZXF1ZXN0Lm1ldGhvZCkpIHtcbiAgICAgICAgICBpZiAob3B0aW9ucy50aHJvdykge1xuICAgICAgICAgICAgdGhyb3cgb3B0aW9ucy5ub3RJbXBsZW1lbnRlZFxuICAgICAgICAgICAgICA/IG9wdGlvbnMubm90SW1wbGVtZW50ZWQoKVxuICAgICAgICAgICAgICA6IG5ldyBodHRwRXJyb3JzLk5vdEltcGxlbWVudGVkKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN0eC5yZXNwb25zZS5zdGF0dXMgPSBTdGF0dXMuTm90SW1wbGVtZW50ZWQ7XG4gICAgICAgICAgICBjdHgucmVzcG9uc2UuaGVhZGVycy5zZXQoXCJBbGxvd2VkXCIsIGFsbG93ZWRTdHIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhbGxvd2VkLnNpemUpIHtcbiAgICAgICAgICBpZiAoY3R4LnJlcXVlc3QubWV0aG9kID09PSBcIk9QVElPTlNcIikge1xuICAgICAgICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IFN0YXR1cy5PSztcbiAgICAgICAgICAgIGN0eC5yZXNwb25zZS5oZWFkZXJzLnNldChcIkFsbG93ZWRcIiwgYWxsb3dlZFN0cik7XG4gICAgICAgICAgfSBlbHNlIGlmICghYWxsb3dlZC5oYXMoY3R4LnJlcXVlc3QubWV0aG9kKSkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMudGhyb3cpIHtcbiAgICAgICAgICAgICAgdGhyb3cgb3B0aW9ucy5tZXRob2ROb3RBbGxvd2VkXG4gICAgICAgICAgICAgICAgPyBvcHRpb25zLm1ldGhvZE5vdEFsbG93ZWQoKVxuICAgICAgICAgICAgICAgIDogbmV3IGh0dHBFcnJvcnMuTWV0aG9kTm90QWxsb3dlZCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IFN0YXR1cy5NZXRob2ROb3RBbGxvd2VkO1xuICAgICAgICAgICAgICBjdHgucmVzcG9uc2UuaGVhZGVycy5zZXQoXCJBbGxvd2VkXCIsIGFsbG93ZWRTdHIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gYWxsb3dlZE1ldGhvZHM7XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgbmFtZWQgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYERFTEVURWAsXG4gICAqICBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBkZWxldGU8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgREVMRVRFYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgZGVsZXRlPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIGRlbGV0ZTxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgdGhpcy4jdXNlVmVyYihcbiAgICAgIG5hbWVPclBhdGgsXG4gICAgICBwYXRoT3JNaWRkbGV3YXJlIGFzIChzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz4pLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIFtcIkRFTEVURVwiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIEl0ZXJhdGUgb3ZlciB0aGUgcm91dGVzIGN1cnJlbnRseSBhZGRlZCB0byB0aGUgcm91dGVyLiAgVG8gYmUgY29tcGF0aWJsZVxuICAgKiB3aXRoIHRoZSBpdGVyYWJsZSBpbnRlcmZhY2VzLCBib3RoIHRoZSBrZXkgYW5kIHZhbHVlIGFyZSBzZXQgdG8gdGhlIHZhbHVlXG4gICAqIG9mIHRoZSByb3V0ZS4gKi9cbiAgKmVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbUm91dGU8c3RyaW5nPiwgUm91dGU8c3RyaW5nPl0+IHtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMuI3N0YWNrKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IHJvdXRlLnRvSlNPTigpO1xuICAgICAgeWllbGQgW3ZhbHVlLCB2YWx1ZV07XG4gICAgfVxuICB9XG5cbiAgLyoqIEl0ZXJhdGUgb3ZlciB0aGUgcm91dGVzIGN1cnJlbnRseSBhZGRlZCB0byB0aGUgcm91dGVyLCBjYWxsaW5nIHRoZVxuICAgKiBgY2FsbGJhY2tgIGZ1bmN0aW9uIGZvciBlYWNoIHZhbHVlLiAqL1xuICBmb3JFYWNoKFxuICAgIGNhbGxiYWNrOiAoXG4gICAgICB2YWx1ZTE6IFJvdXRlPHN0cmluZz4sXG4gICAgICB2YWx1ZTI6IFJvdXRlPHN0cmluZz4sXG4gICAgICByb3V0ZXI6IHRoaXMsXG4gICAgKSA9PiB2b2lkLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgdGhpc0FyZzogYW55ID0gbnVsbCxcbiAgKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgY29uc3QgdmFsdWUgPSByb3V0ZS50b0pTT04oKTtcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdmFsdWUsIHZhbHVlLCB0aGlzKTtcbiAgICB9XG4gIH1cblxuICAvKiogUmVnaXN0ZXIgbmFtZWQgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYEdFVGAsXG4gICAqICBtZXRob2QgaXMgcmVxdWVzdGVkLiAqL1xuICBnZXQ8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgR0VUYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgZ2V0PFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIGdldDxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgdGhpcy4jdXNlVmVyYihcbiAgICAgIG5hbWVPclBhdGgsXG4gICAgICBwYXRoT3JNaWRkbGV3YXJlIGFzIChzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz4pLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIFtcIkdFVFwiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBIRUFEYCxcbiAgICogIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGhlYWQ8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcGF0aDogUixcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmVzOiBSb3V0ZXJNaWRkbGV3YXJlPFIsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT47XG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIGZvciB0aGUgc3BlY2lmaWVkIHJvdXRlcyB3aGVuIHRoZSBgSEVBRGAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIGhlYWQ8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgaGVhZDxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8c3RyaW5nPiA9IFJvdXRlUGFyYW1zPHN0cmluZz4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZU9yUGF0aDogc3RyaW5nLFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPiB7XG4gICAgdGhpcy4jdXNlVmVyYihcbiAgICAgIG5hbWVPclBhdGgsXG4gICAgICBwYXRoT3JNaWRkbGV3YXJlIGFzIChzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz4pLFxuICAgICAgbWlkZGxld2FyZSBhcyBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZz5bXSxcbiAgICAgIFtcIkhFQURcIl0sXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJvdXRlcyBjdXJyZW50bHkgYWRkZWQgdG8gdGhlIHJvdXRlci4gIFRvIGJlIGNvbXBhdGlibGVcbiAgICogd2l0aCB0aGUgaXRlcmFibGUgaW50ZXJmYWNlcywgdGhlIGtleSBpcyBzZXQgdG8gdGhlIHZhbHVlIG9mIHRoZSByb3V0ZS4gKi9cbiAgKmtleXMoKTogSXRlcmFibGVJdGVyYXRvcjxSb3V0ZTxzdHJpbmc+PiB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgeWllbGQgcm91dGUudG9KU09OKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBPUFRJT05TYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgb3B0aW9uczxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBPUFRJT05TYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgb3B0aW9uczxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBvcHRpb25zPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+IHtcbiAgICB0aGlzLiN1c2VWZXJiKFxuICAgICAgbmFtZU9yUGF0aCxcbiAgICAgIHBhdGhPck1pZGRsZXdhcmUgYXMgKHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPiksXG4gICAgICBtaWRkbGV3YXJlIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgW1wiT1BUSU9OU1wiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIHBhcmFtIG1pZGRsZXdhcmUsIHdoaWNoIHdpbGwgYmUgY2FsbGVkIHdoZW4gdGhlIHBhcnRpY3VsYXIgcGFyYW1cbiAgICogaXMgcGFyc2VkIGZyb20gdGhlIHJvdXRlLiAqL1xuICBwYXJhbTxSIGV4dGVuZHMgc3RyaW5nLCBTIGV4dGVuZHMgU3RhdGUgPSBSUz4oXG4gICAgcGFyYW06IGtleW9mIFJvdXRlUGFyYW1zPFI+LFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlclBhcmFtTWlkZGxld2FyZTxSLCBSb3V0ZVBhcmFtczxSPiwgUz4sXG4gICk6IFJvdXRlcjxTPiB7XG4gICAgdGhpcy4jcGFyYW1zW3BhcmFtIGFzIHN0cmluZ10gPSBtaWRkbGV3YXJlO1xuICAgIGZvciAoY29uc3Qgcm91dGUgb2YgdGhpcy4jc3RhY2spIHtcbiAgICAgIHJvdXRlLnBhcmFtKHBhcmFtIGFzIHN0cmluZywgbWlkZGxld2FyZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQQVRDSGAsXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIHBhdGNoPFxuICAgIFIgZXh0ZW5kcyBzdHJpbmcsXG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPFI+ID0gUm91dGVQYXJhbXM8Uj4sXG4gICAgUyBleHRlbmRzIFN0YXRlID0gUlMsXG4gID4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSBmb3IgdGhlIHNwZWNpZmllZCByb3V0ZXMgd2hlbiB0aGUgYFBBVENIYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcGF0Y2g8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgcGF0Y2g8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJQQVRDSFwiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQT1NUYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcG9zdDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQT1NUYCxcbiAgICogbWV0aG9kIGlzIHJlcXVlc3RlZC4gKi9cbiAgcG9zdDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBwb3N0PFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBuYW1lT3JQYXRoOiBzdHJpbmcsXG4gICAgcGF0aE9yTWlkZGxld2FyZTogc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+IHtcbiAgICB0aGlzLiN1c2VWZXJiKFxuICAgICAgbmFtZU9yUGF0aCxcbiAgICAgIHBhdGhPck1pZGRsZXdhcmUgYXMgKHN0cmluZyB8IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPiksXG4gICAgICBtaWRkbGV3YXJlIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgW1wiUE9TVFwiXSxcbiAgICApO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFNldCB0aGUgcm91dGVyIHByZWZpeCBmb3IgdGhpcyByb3V0ZXIuICovXG4gIHByZWZpeChwcmVmaXg6IHN0cmluZyk6IHRoaXMge1xuICAgIHByZWZpeCA9IHByZWZpeC5yZXBsYWNlKC9cXC8kLywgXCJcIik7XG4gICAgdGhpcy4jb3B0cy5wcmVmaXggPSBwcmVmaXg7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgcm91dGUuc2V0UHJlZml4KHByZWZpeCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFJlZ2lzdGVyIG5hbWVkIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQVVRgXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIHB1dDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWU6IHN0cmluZyxcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgLyoqIFJlZ2lzdGVyIG1pZGRsZXdhcmUgZm9yIHRoZSBzcGVjaWZpZWQgcm91dGVzIHdoZW4gdGhlIGBQVVRgXG4gICAqIG1ldGhvZCBpcyByZXF1ZXN0ZWQuICovXG4gIHB1dDxcbiAgICBSIGV4dGVuZHMgc3RyaW5nLFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxSPiA9IFJvdXRlUGFyYW1zPFI+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGg6IFIsXG4gICAgbWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPixcbiAgICAuLi5taWRkbGV3YXJlczogUm91dGVyTWlkZGxld2FyZTxSLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICBwdXQ8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIG5hbWVPclBhdGg6IHN0cmluZyxcbiAgICBwYXRoT3JNaWRkbGV3YXJlOiBzdHJpbmcgfCBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZTogUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+W11cbiAgKTogUm91dGVyPFMgZXh0ZW5kcyBSUyA/IFMgOiAoUyAmIFJTKT4ge1xuICAgIHRoaXMuI3VzZVZlcmIoXG4gICAgICBuYW1lT3JQYXRoLFxuICAgICAgcGF0aE9yTWlkZGxld2FyZSBhcyAoc3RyaW5nIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+KSxcbiAgICAgIG1pZGRsZXdhcmUgYXMgUm91dGVyTWlkZGxld2FyZTxzdHJpbmc+W10sXG4gICAgICBbXCJQVVRcIl0sXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBSZWdpc3RlciBhIGRpcmVjdGlvbiBtaWRkbGV3YXJlLCB3aGVyZSB3aGVuIHRoZSBgc291cmNlYCBwYXRoIGlzIG1hdGNoZWRcbiAgICogdGhlIHJvdXRlciB3aWxsIHJlZGlyZWN0IHRoZSByZXF1ZXN0IHRvIHRoZSBgZGVzdGluYXRpb25gIHBhdGguICBBIGBzdGF0dXNgXG4gICAqIG9mIGAzMDIgRm91bmRgIHdpbGwgYmUgc2V0IGJ5IGRlZmF1bHQuXG4gICAqXG4gICAqIFRoZSBgc291cmNlYCBhbmQgYGRlc3RpbmF0aW9uYCBjYW4gYmUgbmFtZWQgcm91dGVzLiAqL1xuICByZWRpcmVjdChcbiAgICBzb3VyY2U6IHN0cmluZyxcbiAgICBkZXN0aW5hdGlvbjogc3RyaW5nIHwgVVJMLFxuICAgIHN0YXR1czogUmVkaXJlY3RTdGF0dXMgPSBTdGF0dXMuRm91bmQsXG4gICk6IHRoaXMge1xuICAgIGlmIChzb3VyY2VbMF0gIT09IFwiL1wiKSB7XG4gICAgICBjb25zdCBzID0gdGhpcy51cmwoc291cmNlKTtcbiAgICAgIGlmICghcykge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgQ291bGQgbm90IHJlc29sdmUgbmFtZWQgcm91dGU6IFwiJHtzb3VyY2V9XCJgKTtcbiAgICAgIH1cbiAgICAgIHNvdXJjZSA9IHM7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZGVzdGluYXRpb24gPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGlmIChkZXN0aW5hdGlvblswXSAhPT0gXCIvXCIpIHtcbiAgICAgICAgY29uc3QgZCA9IHRoaXMudXJsKGRlc3RpbmF0aW9uKTtcbiAgICAgICAgaWYgKCFkKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoZGVzdGluYXRpb24pO1xuICAgICAgICAgICAgZGVzdGluYXRpb24gPSB1cmw7XG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgQ291bGQgbm90IHJlc29sdmUgbmFtZWQgcm91dGU6IFwiJHtzb3VyY2V9XCJgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVzdGluYXRpb24gPSBkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5hbGwoc291cmNlLCBhc3luYyAoY3R4LCBuZXh0KSA9PiB7XG4gICAgICBhd2FpdCBuZXh0KCk7XG4gICAgICBjdHgucmVzcG9uc2UucmVkaXJlY3QoZGVzdGluYXRpb24pO1xuICAgICAgY3R4LnJlc3BvbnNlLnN0YXR1cyA9IHN0YXR1cztcbiAgICB9KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gbWlkZGxld2FyZSB0aGF0IHdpbGwgZG8gYWxsIHRoZSByb3V0ZSBwcm9jZXNzaW5nIHRoYXQgdGhlIHJvdXRlclxuICAgKiBoYXMgYmVlbiBjb25maWd1cmVkIHRvIGhhbmRsZS4gIFR5cGljYWwgdXNhZ2Ugd291bGQgYmUgc29tZXRoaW5nIGxpa2UgdGhpczpcbiAgICpcbiAgICogYGBgdHNcbiAgICogaW1wb3J0IHsgQXBwbGljYXRpb24sIFJvdXRlciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC94L29hay9tb2QudHNcIjtcbiAgICpcbiAgICogY29uc3QgYXBwID0gbmV3IEFwcGxpY2F0aW9uKCk7XG4gICAqIGNvbnN0IHJvdXRlciA9IG5ldyBSb3V0ZXIoKTtcbiAgICpcbiAgICogLy8gcmVnaXN0ZXIgcm91dGVzXG4gICAqXG4gICAqIGFwcC51c2Uocm91dGVyLnJvdXRlcygpKTtcbiAgICogYXBwLnVzZShyb3V0ZXIuYWxsb3dlZE1ldGhvZHMoKSk7XG4gICAqIGF3YWl0IGFwcC5saXN0ZW4oeyBwb3J0OiA4MCB9KTtcbiAgICogYGBgXG4gICAqL1xuICByb3V0ZXMoKTogTWlkZGxld2FyZSB7XG4gICAgY29uc3QgZGlzcGF0Y2ggPSAoXG4gICAgICBjb250ZXh0OiBDb250ZXh0LFxuICAgICAgbmV4dDogKCkgPT4gUHJvbWlzZTx1bmtub3duPixcbiAgICApOiBQcm9taXNlPHVua25vd24+ID0+IHtcbiAgICAgIGNvbnN0IGN0eCA9IGNvbnRleHQgYXMgUm91dGVyQ29udGV4dDxzdHJpbmc+O1xuICAgICAgbGV0IHBhdGhuYW1lOiBzdHJpbmc7XG4gICAgICBsZXQgbWV0aG9kOiBIVFRQTWV0aG9kcztcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgdXJsOiB7IHBhdGhuYW1lOiBwIH0sIG1ldGhvZDogbSB9ID0gY3R4LnJlcXVlc3Q7XG4gICAgICAgIHBhdGhuYW1lID0gcDtcbiAgICAgICAgbWV0aG9kID0gbTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgY29uc3QgcGF0aCA9IHRoaXMuI29wdHMucm91dGVyUGF0aCA/PyBjdHgucm91dGVyUGF0aCA/P1xuICAgICAgICBkZWNvZGVVUkkocGF0aG5hbWUpO1xuICAgICAgY29uc3QgbWF0Y2hlcyA9IHRoaXMuI21hdGNoKHBhdGgsIG1ldGhvZCk7XG5cbiAgICAgIGlmIChjdHgubWF0Y2hlZCkge1xuICAgICAgICBjdHgubWF0Y2hlZC5wdXNoKC4uLm1hdGNoZXMucGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdHgubWF0Y2hlZCA9IFsuLi5tYXRjaGVzLnBhdGhdO1xuICAgICAgfVxuXG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgY3R4LnJvdXRlciA9IHRoaXMgYXMgUm91dGVyPGFueT47XG5cbiAgICAgIGlmICghbWF0Y2hlcy5yb3V0ZSkgcmV0dXJuIG5leHQoKTtcblxuICAgICAgY29uc3QgeyBwYXRoQW5kTWV0aG9kOiBtYXRjaGVkUm91dGVzIH0gPSBtYXRjaGVzO1xuXG4gICAgICBjb25zdCBjaGFpbiA9IG1hdGNoZWRSb3V0ZXMucmVkdWNlKFxuICAgICAgICAocHJldiwgcm91dGUpID0+IFtcbiAgICAgICAgICAuLi5wcmV2LFxuICAgICAgICAgIChjdHgsIG5leHQpID0+IHtcbiAgICAgICAgICAgIGN0eC5jYXB0dXJlcyA9IHJvdXRlLmNhcHR1cmVzKHBhdGgpO1xuICAgICAgICAgICAgY3R4LnBhcmFtcyA9IHJvdXRlLnBhcmFtcyhjdHguY2FwdHVyZXMsIGN0eC5wYXJhbXMpO1xuICAgICAgICAgICAgY3R4LnJvdXRlTmFtZSA9IHJvdXRlLm5hbWU7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgLi4ucm91dGUuc3RhY2ssXG4gICAgICAgIF0sXG4gICAgICAgIFtdIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgKTtcbiAgICAgIHJldHVybiBjb21wb3NlKGNoYWluKShjdHgsIG5leHQpO1xuICAgIH07XG4gICAgZGlzcGF0Y2gucm91dGVyID0gdGhpcztcbiAgICByZXR1cm4gZGlzcGF0Y2g7XG4gIH1cblxuICAvKiogR2VuZXJhdGUgYSBVUkwgcGF0aG5hbWUgZm9yIGEgbmFtZWQgcm91dGUsIGludGVycG9sYXRpbmcgdGhlIG9wdGlvbmFsXG4gICAqIHBhcmFtcyBwcm92aWRlZC4gIEFsc28gYWNjZXB0cyBhbiBvcHRpb25hbCBzZXQgb2Ygb3B0aW9ucy4gKi9cbiAgdXJsPFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPj4oXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHBhcmFtcz86IFAsXG4gICAgb3B0aW9ucz86IFVybE9wdGlvbnMsXG4gICk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3Qgcm91dGUgPSB0aGlzLiNyb3V0ZShuYW1lKTtcblxuICAgIGlmIChyb3V0ZSkge1xuICAgICAgcmV0dXJuIHJvdXRlLnVybChwYXJhbXMsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKiBSZWdpc3RlciBtaWRkbGV3YXJlIHRvIGJlIHVzZWQgb24gZXZlcnkgbWF0Y2hlZCByb3V0ZS4gKi9cbiAgdXNlPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICAvKiogUmVnaXN0ZXIgbWlkZGxld2FyZSB0byBiZSB1c2VkIG9uIGV2ZXJ5IHJvdXRlIHRoYXQgbWF0Y2hlcyB0aGUgc3VwcGxpZWRcbiAgICogYHBhdGhgLiAqL1xuICB1c2U8XG4gICAgUiBleHRlbmRzIHN0cmluZyxcbiAgICBQIGV4dGVuZHMgUm91dGVQYXJhbXM8Uj4gPSBSb3V0ZVBhcmFtczxSPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoOiBSLFxuICAgIG1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8UiwgUCwgUz5bXVxuICApOiBSb3V0ZXI8UyBleHRlbmRzIFJTID8gUyA6IChTICYgUlMpPjtcbiAgdXNlPFxuICAgIFAgZXh0ZW5kcyBSb3V0ZVBhcmFtczxzdHJpbmc+ID0gUm91dGVQYXJhbXM8c3RyaW5nPixcbiAgICBTIGV4dGVuZHMgU3RhdGUgPSBSUyxcbiAgPihcbiAgICBwYXRoOiBzdHJpbmdbXSxcbiAgICBtaWRkbGV3YXJlOiBSb3V0ZXJNaWRkbGV3YXJlPHN0cmluZywgUCwgUz4sXG4gICAgLi4ubWlkZGxld2FyZXM6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+O1xuICB1c2U8XG4gICAgUCBleHRlbmRzIFJvdXRlUGFyYW1zPHN0cmluZz4gPSBSb3V0ZVBhcmFtczxzdHJpbmc+LFxuICAgIFMgZXh0ZW5kcyBTdGF0ZSA9IFJTLFxuICA+KFxuICAgIHBhdGhPck1pZGRsZXdhcmU6IHN0cmluZyB8IHN0cmluZ1tdIHwgUm91dGVyTWlkZGxld2FyZTxzdHJpbmcsIFAsIFM+LFxuICAgIC4uLm1pZGRsZXdhcmU6IFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nLCBQLCBTPltdXG4gICk6IFJvdXRlcjxTIGV4dGVuZHMgUlMgPyBTIDogKFMgJiBSUyk+IHtcbiAgICBsZXQgcGF0aDogc3RyaW5nIHwgc3RyaW5nW10gfCB1bmRlZmluZWQ7XG4gICAgaWYgKFxuICAgICAgdHlwZW9mIHBhdGhPck1pZGRsZXdhcmUgPT09IFwic3RyaW5nXCIgfHwgQXJyYXkuaXNBcnJheShwYXRoT3JNaWRkbGV3YXJlKVxuICAgICkge1xuICAgICAgcGF0aCA9IHBhdGhPck1pZGRsZXdhcmU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1pZGRsZXdhcmUudW5zaGlmdChwYXRoT3JNaWRkbGV3YXJlKTtcbiAgICB9XG5cbiAgICB0aGlzLiNyZWdpc3RlcihcbiAgICAgIHBhdGggPz8gXCIoLiopXCIsXG4gICAgICBtaWRkbGV3YXJlIGFzIFJvdXRlck1pZGRsZXdhcmU8c3RyaW5nPltdLFxuICAgICAgW10sXG4gICAgICB7IGVuZDogZmFsc2UsIGlnbm9yZUNhcHR1cmVzOiAhcGF0aCwgaWdub3JlUHJlZml4OiAhcGF0aCB9LFxuICAgICk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBJdGVyYXRlIG92ZXIgdGhlIHJvdXRlcyBjdXJyZW50bHkgYWRkZWQgdG8gdGhlIHJvdXRlci4gKi9cbiAgKnZhbHVlcygpOiBJdGVyYWJsZUl0ZXJhdG9yPFJvdXRlPHN0cmluZywgUm91dGVQYXJhbXM8c3RyaW5nPiwgUlM+PiB7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiB0aGlzLiNzdGFjaykge1xuICAgICAgeWllbGQgcm91dGUudG9KU09OKCk7XG4gICAgfVxuICB9XG5cbiAgLyoqIFByb3ZpZGUgYW4gaXRlcmF0b3IgaW50ZXJmYWNlIHRoYXQgaXRlcmF0ZXMgb3ZlciB0aGUgcm91dGVzIHJlZ2lzdGVyZWRcbiAgICogd2l0aCB0aGUgcm91dGVyLiAqL1xuICAqW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxcbiAgICBSb3V0ZTxzdHJpbmcsIFJvdXRlUGFyYW1zPHN0cmluZz4sIFJTPlxuICA+IHtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMuI3N0YWNrKSB7XG4gICAgICB5aWVsZCByb3V0ZS50b0pTT04oKTtcbiAgICB9XG4gIH1cblxuICAvKiogR2VuZXJhdGUgYSBVUkwgcGF0aG5hbWUgYmFzZWQgb24gdGhlIHByb3ZpZGVkIHBhdGgsIGludGVycG9sYXRpbmcgdGhlXG4gICAqIG9wdGlvbmFsIHBhcmFtcyBwcm92aWRlZC4gIEFsc28gYWNjZXB0cyBhbiBvcHRpb25hbCBzZXQgb2Ygb3B0aW9ucy4gKi9cbiAgc3RhdGljIHVybDxSIGV4dGVuZHMgc3RyaW5nPihcbiAgICBwYXRoOiBSLFxuICAgIHBhcmFtcz86IFJvdXRlUGFyYW1zPFI+LFxuICAgIG9wdGlvbnM/OiBVcmxPcHRpb25zLFxuICApOiBzdHJpbmcge1xuICAgIHJldHVybiB0b1VybChwYXRoLCBwYXJhbXMsIG9wdGlvbnMpO1xuICB9XG5cbiAgW1N5bWJvbC5mb3IoXCJEZW5vLmN1c3RvbUluc3BlY3RcIildKGluc3BlY3Q6ICh2YWx1ZTogdW5rbm93bikgPT4gc3RyaW5nKSB7XG4gICAgcmV0dXJuIGAke3RoaXMuY29uc3RydWN0b3IubmFtZX0gJHtcbiAgICAgIGluc3BlY3QoeyBcIiNwYXJhbXNcIjogdGhpcy4jcGFyYW1zLCBcIiNzdGFja1wiOiB0aGlzLiNzdGFjayB9KVxuICAgIH1gO1xuICB9XG59XG4iXX0=