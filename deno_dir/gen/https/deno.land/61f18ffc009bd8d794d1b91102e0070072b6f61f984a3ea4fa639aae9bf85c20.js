import { base64 } from "./deps.ts";
import { BODY_TYPES, isAsyncIterable, isReader } from "./util.ts";
function isFileInfo(value) {
    return Boolean(value && typeof value === "object" && "mtime" in value && "size" in value);
}
function calcStatTag(entity) {
    const mtime = entity.mtime?.getTime().toString(16) ?? "0";
    const size = entity.size.toString(16);
    return `"${size}-${mtime}"`;
}
const encoder = new TextEncoder();
async function calcEntityTag(entity) {
    if (entity.length === 0) {
        return `"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk="`;
    }
    if (typeof entity === "string") {
        entity = encoder.encode(entity);
    }
    const hash = base64.encode(await crypto.subtle.digest("SHA-1", entity))
        .substring(0, 27);
    return `"${entity.length.toString(16)}-${hash}"`;
}
function fstat(file) {
    if ("fstat" in Deno) {
        return Deno.fstat(file.rid);
    }
    return Promise.resolve(undefined);
}
export function getEntity(context) {
    const { body } = context.response;
    if (body instanceof Deno.File) {
        return fstat(body);
    }
    if (body instanceof Uint8Array) {
        return Promise.resolve(body);
    }
    if (BODY_TYPES.includes(typeof body)) {
        return Promise.resolve(String(body));
    }
    if (isAsyncIterable(body) || isReader(body)) {
        return Promise.resolve(undefined);
    }
    if (typeof body === "object" && body !== null) {
        try {
            const bodyText = JSON.stringify(body);
            return Promise.resolve(bodyText);
        }
        catch {
        }
    }
    return Promise.resolve(undefined);
}
export async function calculate(entity, options = {}) {
    const weak = options.weak ?? isFileInfo(entity);
    const tag = isFileInfo(entity)
        ? calcStatTag(entity)
        : await calcEntityTag(entity);
    return weak ? `W/${tag}` : tag;
}
export function factory(options) {
    return async function etag(context, next) {
        await next();
        if (!context.response.headers.has("ETag")) {
            const entity = await getEntity(context);
            if (entity) {
                context.response.headers.set("ETag", await calculate(entity, options));
            }
        }
    };
}
export async function ifMatch(value, entity, options = {}) {
    const etag = await calculate(entity, options);
    if (etag.startsWith("W/")) {
        return false;
    }
    if (value.trim() === "*") {
        return true;
    }
    const tags = value.split(/\s*,\s*/);
    return tags.includes(etag);
}
export async function ifNoneMatch(value, entity, options = {}) {
    if (value.trim() === "*") {
        return false;
    }
    const etag = await calculate(entity, options);
    const tags = value.split(/\s*,\s*/);
    return !tags.includes(etag);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXRhZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImV0YWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBSUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVuQyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFpQmxFLFNBQVMsVUFBVSxDQUFDLEtBQWM7SUFDaEMsT0FBTyxPQUFPLENBQ1osS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSSxLQUFLLENBQzFFLENBQUM7QUFDSixDQUFDO0FBRUQsU0FBUyxXQUFXLENBQUMsTUFBZ0I7SUFDbkMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDO0lBQzFELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRXRDLE9BQU8sSUFBSSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUM7QUFDOUIsQ0FBQztBQUVELE1BQU0sT0FBTyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFFbEMsS0FBSyxVQUFVLGFBQWEsQ0FBQyxNQUEyQjtJQUN0RCxJQUFJLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ3ZCLE9BQU8sa0NBQWtDLENBQUM7S0FDM0M7SUFFRCxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUM5QixNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNqQztJQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7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VUFBdUIsRUFBRTtJQUV6QixNQUFNLElBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFOUMsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFO1FBQ3pCLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxHQUFHLEVBQUU7UUFDeEIsT0FBTyxJQUFJLENBQUM7S0FDYjtJQUNELE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDcEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzdCLENBQUM7QUFVRCxNQUFNLENBQUMsS0FBSyxVQUFVLFdBQVcsQ0FDL0IsS0FBYSxFQUNiLE1BQXNDLEVBQ3RDLFVBQXVCLEVBQUU7SUFFekIsSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssR0FBRyxFQUFFO1FBQ3hCLE9BQU8sS0FBSyxDQUFDO0tBQ2Q7SUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDOUMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNwQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgb2FrIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuXG5pbXBvcnQgdHlwZSB7IFN0YXRlIH0gZnJvbSBcIi4vYXBwbGljYXRpb24udHNcIjtcbmltcG9ydCB0eXBlIHsgQ29udGV4dCB9IGZyb20gXCIuL2NvbnRleHQudHNcIjtcbmltcG9ydCB7IGJhc2U2NCB9IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB0eXBlIHsgTWlkZGxld2FyZSB9IGZyb20gXCIuL21pZGRsZXdhcmUudHNcIjtcbmltcG9ydCB7IEJPRFlfVFlQRVMsIGlzQXN5bmNJdGVyYWJsZSwgaXNSZWFkZXIgfSBmcm9tIFwiLi91dGlsLnRzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRVRhZ09wdGlvbnMge1xuICAvKiogT3ZlcnJpZGUgdGhlIGRlZmF1bHQgYmVoYXZpb3Igb2YgY2FsY3VsYXRpbmcgdGhlIGBFVGFnYCwgZWl0aGVyIGZvcmNpbmdcbiAgICogYSB0YWcgdG8gYmUgbGFiZWxsZWQgd2VhayBvciBub3QuICovXG4gIHdlYWs/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEp1c3QgdGhlIHBhcnQgb2YgYERlbm8uRmlsZUluZm9gIHRoYXQgaXMgcmVxdWlyZWQgdG8gY2FsY3VsYXRlIGFuIGBFVGFnYCxcbiAqIHNvIHBhcnRpYWwgb3IgdXNlciBnZW5lcmF0ZWQgZmlsZSBpbmZvcm1hdGlvbiBjYW4gYmUgcGFzc2VkLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVJbmZvIHtcbiAgbXRpbWU6IERhdGUgfCBudWxsO1xuICBzaXplOiBudW1iZXI7XG59XG5cbmZ1bmN0aW9uIGlzRmlsZUluZm8odmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBGaWxlSW5mbyB7XG4gIHJldHVybiBCb29sZWFuKFxuICAgIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIiAmJiBcIm10aW1lXCIgaW4gdmFsdWUgJiYgXCJzaXplXCIgaW4gdmFsdWUsXG4gICk7XG59XG5cbmZ1bmN0aW9uIGNhbGNTdGF0VGFnKGVudGl0eTogRmlsZUluZm8pOiBzdHJpbmcge1xuICBjb25zdCBtdGltZSA9IGVudGl0eS5tdGltZT8uZ2V0VGltZSgpLnRvU3RyaW5nKDE2KSA/PyBcIjBcIjtcbiAgY29uc3Qgc2l6ZSA9IGVudGl0eS5zaXplLnRvU3RyaW5nKDE2KTtcblxuICByZXR1cm4gYFwiJHtzaXplfS0ke210aW1lfVwiYDtcbn1cblxuY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXG5hc3luYyBmdW5jdGlvbiBjYWxjRW50aXR5VGFnKGVudGl0eTogc3RyaW5nIHwgVWludDhBcnJheSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGlmIChlbnRpdHkubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGBcIjAtMmptajdsNXJTdzB5VmIvdmxXQVlrSy9ZQndrPVwiYDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgZW50aXR5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgZW50aXR5ID0gZW5jb2Rlci5lbmNvZGUoZW50aXR5KTtcbiAgfVxuXG4gIGNvbnN0IGhhc2ggPSBiYXNlNjQuZW5jb2RlKGF3YWl0IGNyeXB0by5zdWJ0bGUuZGlnZXN0KFwiU0hBLTFcIiwgZW50aXR5KSlcbiAgICAuc3Vic3RyaW5nKDAsIDI3KTtcblxuICByZXR1cm4gYFwiJHtlbnRpdHkubGVuZ3RoLnRvU3RyaW5nKDE2KX0tJHtoYXNofVwiYDtcbn1cblxuZnVuY3Rpb24gZnN0YXQoZmlsZTogRGVuby5GaWxlKTogUHJvbWlzZTxEZW5vLkZpbGVJbmZvIHwgdW5kZWZpbmVkPiB7XG4gIGlmIChcImZzdGF0XCIgaW4gRGVubykge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgcmV0dXJuIChEZW5vIGFzIGFueSkuZnN0YXQoZmlsZS5yaWQpO1xuICB9XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcbn1cblxuLyoqIEZvciBhIGdpdmVuIENvbnRleHQsIHRyeSB0byBkZXRlcm1pbmUgdGhlIHJlc3BvbnNlIGJvZHkgZW50aXR5IHRoYXQgYW4gRVRhZ1xuICogY2FuIGJlIGNhbGN1bGF0ZWQgZnJvbS4gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gZ2V0RW50aXR5PFMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4+KFxuICBjb250ZXh0OiBDb250ZXh0PFM+LFxuKTogUHJvbWlzZTxzdHJpbmcgfCBVaW50OEFycmF5IHwgRGVuby5GaWxlSW5mbyB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCB7IGJvZHkgfSA9IGNvbnRleHQucmVzcG9uc2U7XG4gIGlmIChib2R5IGluc3RhbmNlb2YgRGVuby5GaWxlKSB7XG4gICAgcmV0dXJuIGZzdGF0KGJvZHkpO1xuICB9XG4gIGlmIChib2R5IGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYm9keSk7XG4gIH1cbiAgaWYgKEJPRFlfVFlQRVMuaW5jbHVkZXModHlwZW9mIGJvZHkpKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShTdHJpbmcoYm9keSkpO1xuICB9XG4gIGlmIChpc0FzeW5jSXRlcmFibGUoYm9keSkgfHwgaXNSZWFkZXIoYm9keSkpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gIH1cbiAgaWYgKHR5cGVvZiBib2R5ID09PSBcIm9iamVjdFwiICYmIGJvZHkgIT09IG51bGwpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgYm9keVRleHQgPSBKU09OLnN0cmluZ2lmeShib2R5KTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoYm9keVRleHQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgLy8gV2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQgZXJyb3JzIGhlcmVcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSBhbiBFVGFnIHZhbHVlIGZvciBhbiBlbnRpdHkuIElmIHRoZSBlbnRpdHkgaXMgYEZpbGVJbmZvYCwgdGhlbiB0aGVcbiAqIHRhZyB3aWxsIGRlZmF1bHQgdG8gYSBfd2Vha18gRVRhZy4gIGBvcHRpb25zLndlYWtgIG92ZXJyaWRlcyBhbnkgZGVmYXVsdFxuICogYmVoYXZpb3IgaW4gZ2VuZXJhdGluZyB0aGUgdGFnLlxuICpcbiAqIEBwYXJhbSBlbnRpdHkgQSBzdHJpbmcsIFVpbnQ4QXJyYXksIG9yIGZpbGUgaW5mbyB0byB1c2UgdG8gZ2VuZXJhdGUgdGhlIEVUYWdcbiAqIEBwYXJhbSBvcHRpb25zXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjYWxjdWxhdGUoXG4gIGVudGl0eTogc3RyaW5nIHwgVWludDhBcnJheSB8IEZpbGVJbmZvLFxuICBvcHRpb25zOiBFVGFnT3B0aW9ucyA9IHt9LFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3Qgd2VhayA9IG9wdGlvbnMud2VhayA/PyBpc0ZpbGVJbmZvKGVudGl0eSk7XG4gIGNvbnN0IHRhZyA9IGlzRmlsZUluZm8oZW50aXR5KVxuICAgID8gY2FsY1N0YXRUYWcoZW50aXR5KVxuICAgIDogYXdhaXQgY2FsY0VudGl0eVRhZyhlbnRpdHkpO1xuXG4gIHJldHVybiB3ZWFrID8gYFcvJHt0YWd9YCA6IHRhZztcbn1cblxuLyoqXG4gKiBDcmVhdGUgbWlkZGxld2FyZSB0aGF0IHdpbGwgYXR0ZW1wdCB0byBkZWNvZGUgdGhlIHJlc3BvbnNlLmJvZHkgaW50b1xuICogc29tZXRoaW5nIHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2VuZXJhdGUgYW4gYEVUYWdgIGFuZCBhZGQgdGhlIGBFVGFnYCBoZWFkZXIgdG9cbiAqIHRoZSByZXNwb25zZS5cbiAqL1xuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBmYWN0b3J5PFMgZXh0ZW5kcyBTdGF0ZSA9IFJlY29yZDxzdHJpbmcsIGFueT4+KFxuICBvcHRpb25zPzogRVRhZ09wdGlvbnMsXG4pOiBNaWRkbGV3YXJlPFM+IHtcbiAgcmV0dXJuIGFzeW5jIGZ1bmN0aW9uIGV0YWcoY29udGV4dDogQ29udGV4dDxTPiwgbmV4dCkge1xuICAgIGF3YWl0IG5leHQoKTtcbiAgICBpZiAoIWNvbnRleHQucmVzcG9uc2UuaGVhZGVycy5oYXMoXCJFVGFnXCIpKSB7XG4gICAgICBjb25zdCBlbnRpdHkgPSBhd2FpdCBnZXRFbnRpdHkoY29udGV4dCk7XG4gICAgICBpZiAoZW50aXR5KSB7XG4gICAgICAgIGNvbnRleHQucmVzcG9uc2UuaGVhZGVycy5zZXQoXCJFVGFnXCIsIGF3YWl0IGNhbGN1bGF0ZShlbnRpdHksIG9wdGlvbnMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQSBoZWxwZXIgZnVuY3Rpb24gdGhhdCB0YWtlcyB0aGUgdmFsdWUgZnJvbSB0aGUgYElmLU1hdGNoYCBoZWFkZXIgYW5kIGFuXG4gKiBlbnRpdHkgYW5kIHJldHVybnMgYHRydWVgIGlmIHRoZSBgRVRhZ2AgZm9yIHRoZSBlbnRpdHkgbWF0Y2hlcyB0aGUgc3VwcGxpZWRcbiAqIHZhbHVlLCBvdGhlcndpc2UgYGZhbHNlYC5cbiAqXG4gKiBTZWUgTUROJ3MgW2BJZi1NYXRjaGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUVFAvSGVhZGVycy9JZi1NYXRjaClcbiAqIGFydGljbGUgZm9yIG1vcmUgaW5mb3JtYXRpb24gb24gaG93IHRvIHVzZSB0aGlzIGZ1bmN0aW9uLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaWZNYXRjaChcbiAgdmFsdWU6IHN0cmluZyxcbiAgZW50aXR5OiBzdHJpbmcgfCBVaW50OEFycmF5IHwgRmlsZUluZm8sXG4gIG9wdGlvbnM6IEVUYWdPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgY29uc3QgZXRhZyA9IGF3YWl0IGNhbGN1bGF0ZShlbnRpdHksIG9wdGlvbnMpO1xuICAvLyBXZWFrIHRhZ3MgY2Fubm90IGJlIG1hdGNoZWQgYW5kIHJldHVybiBmYWxzZS5cbiAgaWYgKGV0YWcuc3RhcnRzV2l0aChcIlcvXCIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZS50cmltKCkgPT09IFwiKlwiKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgY29uc3QgdGFncyA9IHZhbHVlLnNwbGl0KC9cXHMqLFxccyovKTtcbiAgcmV0dXJuIHRhZ3MuaW5jbHVkZXMoZXRhZyk7XG59XG5cbi8qKlxuICogQSBoZWxwZXIgZnVuY3Rpb24gdGhhdCB0YWtlcyB0aGUgdmFsdWUgZnJvbSB0aGUgYElmLU5vLU1hdGNoYCBoZWFkZXIgYW5kXG4gKiBhbiBlbnRpdHkgYW5kIHJldHVybnMgYGZhbHNlYCBpZiB0aGUgYEVUYWdgIGZvciB0aGUgZW50aXR5IG1hdGNoZXMgdGhlXG4gKiBzdXBwbGllZCB2YWx1ZSwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKlxuICogU2VlIE1ETidzIFtgSWYtTm9uZS1NYXRjaGBdKGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0hUVFAvSGVhZGVycy9JZi1Ob25lLU1hdGNoKVxuICogYXJ0aWNsZSBmb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiBob3cgdG8gdXNlIHRoaXMgZnVuY3Rpb24uXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpZk5vbmVNYXRjaChcbiAgdmFsdWU6IHN0cmluZyxcbiAgZW50aXR5OiBzdHJpbmcgfCBVaW50OEFycmF5IHwgRmlsZUluZm8sXG4gIG9wdGlvbnM6IEVUYWdPcHRpb25zID0ge30sXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgaWYgKHZhbHVlLnRyaW0oKSA9PT0gXCIqXCIpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgZXRhZyA9IGF3YWl0IGNhbGN1bGF0ZShlbnRpdHksIG9wdGlvbnMpO1xuICBjb25zdCB0YWdzID0gdmFsdWUuc3BsaXQoL1xccyosXFxzKi8pO1xuICByZXR1cm4gIXRhZ3MuaW5jbHVkZXMoZXRhZyk7XG59XG4iXX0=