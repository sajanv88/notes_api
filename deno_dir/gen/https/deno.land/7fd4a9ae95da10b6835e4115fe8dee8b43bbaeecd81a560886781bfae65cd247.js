import { Binary, BinarySizes } from "../binary.ts";
import { BSONRegExp, BSONSymbol, Code, DBRef, Decimal128, Double, Long, MaxKey, MinKey, ObjectId, Timestamp, } from "../bson.ts";
import * as constants from "../constants.ts";
import { normalizedFunctionString } from "./utils.ts";
const utf8Encoder = new TextEncoder();
export function calculateObjectSize(object, serializeFunctions, ignoreUndefined) {
    let totalLength = 4 + 1;
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            totalLength += calculateElement(i.toString(), object[i], serializeFunctions, true, ignoreUndefined);
        }
    }
    else {
        if (object.toBSON) {
            object = object.toBSON();
        }
        for (const key in object) {
            totalLength += calculateElement(key, object[key], serializeFunctions, false, ignoreUndefined);
        }
    }
    return totalLength;
}
function calculateElement(name, value, serializeFunctions = false, isArray = false, ignoreUndefined = false) {
    if (value?.toBSON) {
        value = value.toBSON();
    }
    switch (typeof value) {
        case "string":
            return 1 + utf8Encoder.encode(name).length + 1 + 4 +
                utf8Encoder.encode(value).length + 1;
        case "number":
            if (Math.floor(value) === value &&
                value >= constants.JS_INT_MIN &&
                value <= constants.JS_INT_MAX) {
                return value >= constants.BSON_INT32_MIN &&
                    value <= constants.BSON_INT32_MAX
                    ? (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        (4 + 1)
                    : (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        (8 + 1);
            }
            else {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (8 + 1);
            }
        case "undefined":
            if (isArray || !ignoreUndefined) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) + 1;
            }
            return 0;
        case "boolean":
            return (name != null ? utf8Encoder.encode(name).length + 1 : 0) + (1 + 1);
        case "object":
            if (value == null || value instanceof MinKey || value instanceof MaxKey) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) + 1;
            }
            else if (value instanceof ObjectId) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (12 + 1);
            }
            else if (value instanceof Date) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (8 + 1);
            }
            else if (ArrayBuffer.isView(value) ||
                value instanceof ArrayBuffer) {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (1 + 4 + 1) + value.byteLength);
            }
            else if (value instanceof Long || value instanceof Double ||
                value instanceof Timestamp) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (8 + 1);
            }
            else if (value instanceof Decimal128) {
                return (name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    (16 + 1);
            }
            else if (value instanceof Code) {
                if (value.scope != null && Object.keys(value.scope).length > 0) {
                    return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        1 +
                        4 +
                        4 +
                        utf8Encoder.encode(value.code.toString()).length +
                        1 +
                        calculateObjectSize(value.scope, serializeFunctions, ignoreUndefined));
                }
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    1 +
                    4 +
                    utf8Encoder.encode(value.code.toString()).length +
                    1);
            }
            else if (value instanceof Binary) {
                return value.subType === BinarySizes.SUBTYPE_BYTE_ARRAY
                    ? ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        (value.buffer.length + 1 + 4 + 1 + 4))
                    : ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        (value.buffer.length + 1 + 4 + 1));
            }
            else if (value instanceof BSONSymbol) {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    utf8Encoder.encode(value.value).length +
                    4 +
                    1 +
                    1);
            }
            else if (value instanceof DBRef) {
                const orderedValues = Object.assign({
                    $ref: value.collection,
                    $id: value.oid,
                }, value.fields);
                if (value.db != null) {
                    orderedValues.$db = value.db;
                }
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    1 +
                    calculateObjectSize(orderedValues, serializeFunctions, ignoreUndefined));
            }
            else if (value instanceof RegExp) {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    1 +
                    utf8Encoder.encode(value.source).length +
                    1 +
                    (value.global ? 1 : 0) +
                    (value.ignoreCase ? 1 : 0) +
                    (value.multiline ? 1 : 0) +
                    1);
            }
            else if (value instanceof BSONRegExp) {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    1 +
                    utf8Encoder.encode(value.pattern).length +
                    1 +
                    utf8Encoder.encode(value.options).length +
                    1);
            }
            else {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    calculateObjectSize(value, serializeFunctions, ignoreUndefined) +
                    1);
            }
        case "function":
            if (value instanceof RegExp ||
                String.call(value) === "[object RegExp]") {
                return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                    1 +
                    utf8Encoder.encode(value.source).length +
                    1 +
                    (value.global ? 1 : 0) +
                    (value.ignoreCase ? 1 : 0) +
                    (value.multiline ? 1 : 0) +
                    1);
            }
            else {
                if (serializeFunctions && value.scope != null &&
                    Object.keys(value.scope).length > 0) {
                    return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        1 +
                        4 +
                        4 +
                        utf8Encoder.encode(normalizedFunctionString(value)).length +
                        1 +
                        calculateObjectSize(value.scope, serializeFunctions, ignoreUndefined));
                }
                if (serializeFunctions) {
                    return ((name != null ? utf8Encoder.encode(name).length + 1 : 0) +
                        1 +
                        4 +
                        utf8Encoder.encode(normalizedFunctionString(value)).length +
                        1);
                }
            }
    }
    return 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsY3VsYXRlX3NpemUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjYWxjdWxhdGVfc2l6ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNuRCxPQUFPLEVBQ0wsVUFBVSxFQUNWLFVBQVUsRUFDVixJQUFJLEVBQ0osS0FBSyxFQUNMLFVBQVUsRUFFVixNQUFNLEVBQ04sSUFBSSxFQUNKLE1BQU0sRUFDTixNQUFNLEVBQ04sUUFBUSxFQUNSLFNBQVMsR0FDVixNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLEtBQUssU0FBUyxNQUFNLGlCQUFpQixDQUFDO0FBQzdDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUV0RCxNQUFNLFdBQVcsR0FBRyxJQUFJLFdBQVcsRUFBRSxDQUFDO0FBRXRDLE1BQU0sVUFBVSxtQkFBbUIsQ0FDakMsTUFBZ0IsRUFDaEIsa0JBQTRCLEVBQzVCLGVBQXlCO0lBRXpCLElBQUksV0FBVyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFFeEIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1FBQ3pCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3RDLFdBQVcsSUFBSSxnQkFBZ0IsQ0FDN0IsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUNaLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFDVCxrQkFBa0IsRUFDbEIsSUFBSSxFQUNKLGVBQWUsQ0FDaEIsQ0FBQztTQUNIO0tBQ0Y7U0FBTTtRQUdMLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRTtZQUNqQixNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1NBQzFCO1FBR0QsS0FBSyxNQUFNLEdBQUcsSUFBSSxNQUFNLEVBQUU7WUFD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by1saW50LWlnbm9yZS1maWxlIG5vLWV4cGxpY2l0LWFueVxuaW1wb3J0IHsgQmluYXJ5LCBCaW5hcnlTaXplcyB9IGZyb20gXCIuLi9iaW5hcnkudHNcIjtcbmltcG9ydCB7XG4gIEJTT05SZWdFeHAsXG4gIEJTT05TeW1ib2wsXG4gIENvZGUsXG4gIERCUmVmLFxuICBEZWNpbWFsMTI4LFxuICBEb2N1bWVudCxcbiAgRG91YmxlLFxuICBMb25nLFxuICBNYXhLZXksXG4gIE1pbktleSxcbiAgT2JqZWN0SWQsXG4gIFRpbWVzdGFtcCxcbn0gZnJvbSBcIi4uL2Jzb24udHNcIjtcbmltcG9ydCAqIGFzIGNvbnN0YW50cyBmcm9tIFwiLi4vY29uc3RhbnRzLnRzXCI7XG5pbXBvcnQgeyBub3JtYWxpemVkRnVuY3Rpb25TdHJpbmcgfSBmcm9tIFwiLi91dGlscy50c1wiO1xuXG5jb25zdCB1dGY4RW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlT2JqZWN0U2l6ZShcbiAgb2JqZWN0OiBEb2N1bWVudCxcbiAgc2VyaWFsaXplRnVuY3Rpb25zPzogYm9vbGVhbixcbiAgaWdub3JlVW5kZWZpbmVkPzogYm9vbGVhbixcbik6IG51bWJlciB7XG4gIGxldCB0b3RhbExlbmd0aCA9IDQgKyAxO1xuXG4gIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgdG90YWxMZW5ndGggKz0gY2FsY3VsYXRlRWxlbWVudChcbiAgICAgICAgaS50b1N0cmluZygpLFxuICAgICAgICBvYmplY3RbaV0sXG4gICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gSWYgd2UgaGF2ZSB0b0JTT04gZGVmaW5lZCwgb3ZlcnJpZGUgdGhlIGN1cnJlbnQgb2JqZWN0XG5cbiAgICBpZiAob2JqZWN0LnRvQlNPTikge1xuICAgICAgb2JqZWN0ID0gb2JqZWN0LnRvQlNPTigpO1xuICAgIH1cblxuICAgIC8vIENhbGN1bGF0ZSBzaXplXG4gICAgZm9yIChjb25zdCBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICB0b3RhbExlbmd0aCArPSBjYWxjdWxhdGVFbGVtZW50KFxuICAgICAgICBrZXksXG4gICAgICAgIG9iamVjdFtrZXldLFxuICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0b3RhbExlbmd0aDtcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlRWxlbWVudChcbiAgbmFtZTogc3RyaW5nLFxuICB2YWx1ZTogYW55LFxuICBzZXJpYWxpemVGdW5jdGlvbnMgPSBmYWxzZSxcbiAgaXNBcnJheSA9IGZhbHNlLFxuICBpZ25vcmVVbmRlZmluZWQgPSBmYWxzZSxcbikge1xuICAvLyBJZiB3ZSBoYXZlIHRvQlNPTiBkZWZpbmVkLCBvdmVycmlkZSB0aGUgY3VycmVudCBvYmplY3RcbiAgaWYgKHZhbHVlPy50b0JTT04pIHtcbiAgICB2YWx1ZSA9IHZhbHVlLnRvQlNPTigpO1xuICB9XG5cbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICByZXR1cm4gMSArIHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxICsgNCArXG4gICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZSkubGVuZ3RoICsgMTtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICBpZiAoXG4gICAgICAgIE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZSAmJlxuICAgICAgICB2YWx1ZSA+PSBjb25zdGFudHMuSlNfSU5UX01JTiAmJlxuICAgICAgICB2YWx1ZSA8PSBjb25zdGFudHMuSlNfSU5UX01BWFxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSA+PSBjb25zdGFudHMuQlNPTl9JTlQzMl9NSU4gJiZcbiAgICAgICAgICAgIHZhbHVlIDw9IGNvbnN0YW50cy5CU09OX0lOVDMyX01BWFxuICAgICAgICAgID8gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICAgKDQgKyAxKVxuICAgICAgICAgIDogKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICAgKDggKyAxKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIDY0IGJpdFxuICAgICAgICByZXR1cm4gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICg4ICsgMSk7XG4gICAgICB9XG4gICAgY2FzZSBcInVuZGVmaW5lZFwiOlxuICAgICAgaWYgKGlzQXJyYXkgfHwgIWlnbm9yZVVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgKyAxO1xuICAgICAgfVxuICAgICAgcmV0dXJuIDA7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHJldHVybiAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArICgxICsgMSk7XG4gICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgaWYgKHZhbHVlID09IG51bGwgfHwgdmFsdWUgaW5zdGFuY2VvZiBNaW5LZXkgfHwgdmFsdWUgaW5zdGFuY2VvZiBNYXhLZXkpIHtcbiAgICAgICAgcmV0dXJuIChuYW1lICE9IG51bGwgPyB1dGY4RW5jb2Rlci5lbmNvZGUobmFtZSkubGVuZ3RoICsgMSA6IDApICsgMTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3RJZCkge1xuICAgICAgICByZXR1cm4gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICgxMiArIDEpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgcmV0dXJuIChuYW1lICE9IG51bGwgPyB1dGY4RW5jb2Rlci5lbmNvZGUobmFtZSkubGVuZ3RoICsgMSA6IDApICtcbiAgICAgICAgICAoOCArIDEpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgQXJyYXlCdWZmZXIuaXNWaWV3KHZhbHVlKSB8fFxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArXG4gICAgICAgICAgKDEgKyA0ICsgMSkgKyB2YWx1ZS5ieXRlTGVuZ3RoXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIExvbmcgfHwgdmFsdWUgaW5zdGFuY2VvZiBEb3VibGUgfHxcbiAgICAgICAgdmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXBcbiAgICAgICkge1xuICAgICAgICByZXR1cm4gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICg4ICsgMSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGVjaW1hbDEyOCkge1xuICAgICAgICByZXR1cm4gKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICgxNiArIDEpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIENvZGUpIHtcbiAgICAgICAgLy8gQ2FsY3VsYXRlIHNpemUgZGVwZW5kaW5nIG9uIHRoZSBhdmFpbGFiaWxpdHkgb2YgYSBzY29wZVxuICAgICAgICBpZiAodmFsdWUuc2NvcGUgIT0gbnVsbCAmJiBPYmplY3Qua2V5cyh2YWx1ZS5zY29wZSkubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArXG4gICAgICAgICAgICAxICtcbiAgICAgICAgICAgIDQgK1xuICAgICAgICAgICAgNCArXG4gICAgICAgICAgICB1dGY4RW5jb2Rlci5lbmNvZGUodmFsdWUuY29kZS50b1N0cmluZygpKS5sZW5ndGggK1xuICAgICAgICAgICAgMSArXG4gICAgICAgICAgICBjYWxjdWxhdGVPYmplY3RTaXplKFxuICAgICAgICAgICAgICB2YWx1ZS5zY29wZSxcbiAgICAgICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICAgICApXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIChuYW1lICE9IG51bGwgPyB1dGY4RW5jb2Rlci5lbmNvZGUobmFtZSkubGVuZ3RoICsgMSA6IDApICtcbiAgICAgICAgICAxICtcbiAgICAgICAgICA0ICtcbiAgICAgICAgICB1dGY4RW5jb2Rlci5lbmNvZGUodmFsdWUuY29kZS50b1N0cmluZygpKS5sZW5ndGggK1xuICAgICAgICAgIDFcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCaW5hcnkpIHtcbiAgICAgICAgLy8gQ2hlY2sgd2hhdCBraW5kIG9mIHN1YnR5cGUgd2UgaGF2ZVxuICAgICAgICByZXR1cm4gdmFsdWUuc3ViVHlwZSA9PT0gQmluYXJ5U2l6ZXMuU1VCVFlQRV9CWVRFX0FSUkFZXG4gICAgICAgICAgPyAoXG4gICAgICAgICAgICAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArXG4gICAgICAgICAgICAodmFsdWUuYnVmZmVyLmxlbmd0aCArIDEgKyA0ICsgMSArIDQpXG4gICAgICAgICAgKVxuICAgICAgICAgIDogKFxuICAgICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgICAgKHZhbHVlLmJ1ZmZlci5sZW5ndGggKyAxICsgNCArIDEpXG4gICAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCU09OU3ltYm9sKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZS52YWx1ZSkubGVuZ3RoICtcbiAgICAgICAgICA0ICtcbiAgICAgICAgICAxICtcbiAgICAgICAgICAxXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgREJSZWYpIHtcbiAgICAgICAgLy8gU2V0IHVwIGNvcnJlY3Qgb2JqZWN0IGZvciBzZXJpYWxpemF0aW9uXG4gICAgICAgIGNvbnN0IG9yZGVyZWRWYWx1ZXMgPSBPYmplY3QuYXNzaWduKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgICRyZWY6IHZhbHVlLmNvbGxlY3Rpb24sXG4gICAgICAgICAgICAkaWQ6IHZhbHVlLm9pZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHZhbHVlLmZpZWxkcyxcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBBZGQgZGIgcmVmZXJlbmNlIGlmIGl0IGV4aXN0c1xuICAgICAgICBpZiAodmFsdWUuZGIgIT0gbnVsbCkge1xuICAgICAgICAgIG9yZGVyZWRWYWx1ZXMuJGRiID0gdmFsdWUuZGI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIChuYW1lICE9IG51bGwgPyB1dGY4RW5jb2Rlci5lbmNvZGUobmFtZSkubGVuZ3RoICsgMSA6IDApICtcbiAgICAgICAgICAxICtcbiAgICAgICAgICBjYWxjdWxhdGVPYmplY3RTaXplKFxuICAgICAgICAgICAgb3JkZXJlZFZhbHVlcyxcbiAgICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgIDEgK1xuICAgICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZS5zb3VyY2UpLmxlbmd0aCArXG4gICAgICAgICAgMSArXG4gICAgICAgICAgKHZhbHVlLmdsb2JhbCA/IDEgOiAwKSArXG4gICAgICAgICAgKHZhbHVlLmlnbm9yZUNhc2UgPyAxIDogMCkgK1xuICAgICAgICAgICh2YWx1ZS5tdWx0aWxpbmUgPyAxIDogMCkgK1xuICAgICAgICAgIDFcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCU09OUmVnRXhwKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgIDEgK1xuICAgICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZS5wYXR0ZXJuKS5sZW5ndGggK1xuICAgICAgICAgIDEgK1xuICAgICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZS5vcHRpb25zKS5sZW5ndGggK1xuICAgICAgICAgIDFcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgIGNhbGN1bGF0ZU9iamVjdFNpemUodmFsdWUsIHNlcmlhbGl6ZUZ1bmN0aW9ucywgaWdub3JlVW5kZWZpbmVkKSArXG4gICAgICAgICAgMVxuICAgICAgICApO1xuICAgICAgfVxuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgLy8gV1RGIGZvciAwLjQuWCB3aGVyZSB0eXBlb2YgL3NvbWVyZWdleHAvID09PSAnZnVuY3Rpb24nXG4gICAgICBpZiAoXG4gICAgICAgIHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwIHx8XG4gICAgICAgIFN0cmluZy5jYWxsKHZhbHVlKSA9PT0gXCJbb2JqZWN0IFJlZ0V4cF1cIlxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgKG5hbWUgIT0gbnVsbCA/IHV0ZjhFbmNvZGVyLmVuY29kZShuYW1lKS5sZW5ndGggKyAxIDogMCkgK1xuICAgICAgICAgIDEgK1xuICAgICAgICAgIHV0ZjhFbmNvZGVyLmVuY29kZSh2YWx1ZS5zb3VyY2UpLmxlbmd0aCArXG4gICAgICAgICAgMSArXG4gICAgICAgICAgKHZhbHVlLmdsb2JhbCA/IDEgOiAwKSArXG4gICAgICAgICAgKHZhbHVlLmlnbm9yZUNhc2UgPyAxIDogMCkgK1xuICAgICAgICAgICh2YWx1ZS5tdWx0aWxpbmUgPyAxIDogMCkgK1xuICAgICAgICAgIDFcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMgJiYgdmFsdWUuc2NvcGUgIT0gbnVsbCAmJlxuICAgICAgICAgIE9iamVjdC5rZXlzKHZhbHVlLnNjb3BlKS5sZW5ndGggPiAwXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArXG4gICAgICAgICAgICAxICtcbiAgICAgICAgICAgIDQgK1xuICAgICAgICAgICAgNCArXG4gICAgICAgICAgICB1dGY4RW5jb2Rlci5lbmNvZGUobm9ybWFsaXplZEZ1bmN0aW9uU3RyaW5nKHZhbHVlKSkubGVuZ3RoICtcbiAgICAgICAgICAgIDEgK1xuICAgICAgICAgICAgY2FsY3VsYXRlT2JqZWN0U2l6ZShcbiAgICAgICAgICAgICAgdmFsdWUuc2NvcGUsXG4gICAgICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgICAgICAgKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNlcmlhbGl6ZUZ1bmN0aW9ucykge1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAobmFtZSAhPSBudWxsID8gdXRmOEVuY29kZXIuZW5jb2RlKG5hbWUpLmxlbmd0aCArIDEgOiAwKSArXG4gICAgICAgICAgICAxICtcbiAgICAgICAgICAgIDQgK1xuICAgICAgICAgICAgdXRmOEVuY29kZXIuZW5jb2RlKG5vcm1hbGl6ZWRGdW5jdGlvblN0cmluZyh2YWx1ZSkpLmxlbmd0aCArXG4gICAgICAgICAgICAxXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICB9XG5cbiAgcmV0dXJuIDA7XG59XG4iXX0=