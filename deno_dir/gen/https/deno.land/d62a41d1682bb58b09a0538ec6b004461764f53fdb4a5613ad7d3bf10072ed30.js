const objectCloneMemo = new WeakMap();
function cloneArrayBuffer(srcBuffer, srcByteOffset, srcLength, _cloneConstructor) {
    return srcBuffer.slice(srcByteOffset, srcByteOffset + srcLength);
}
function cloneValue(value) {
    switch (typeof value) {
        case "number":
        case "string":
        case "boolean":
        case "undefined":
        case "bigint":
            return value;
        case "object": {
            if (objectCloneMemo.has(value)) {
                return objectCloneMemo.get(value);
            }
            if (value === null) {
                return value;
            }
            if (value instanceof Date) {
                return new Date(value.valueOf());
            }
            if (value instanceof RegExp) {
                return new RegExp(value);
            }
            if (value instanceof SharedArrayBuffer) {
                return value;
            }
            if (value instanceof ArrayBuffer) {
                const cloned = cloneArrayBuffer(value, 0, value.byteLength, ArrayBuffer);
                objectCloneMemo.set(value, cloned);
                return cloned;
            }
            if (ArrayBuffer.isView(value)) {
                const clonedBuffer = cloneValue(value.buffer);
                let length;
                if (value instanceof DataView) {
                    length = value.byteLength;
                }
                else {
                    length = value.length;
                }
                return new value.constructor(clonedBuffer, value.byteOffset, length);
            }
            if (value instanceof Map) {
                const clonedMap = new Map();
                objectCloneMemo.set(value, clonedMap);
                value.forEach((v, k) => {
                    clonedMap.set(cloneValue(k), cloneValue(v));
                });
                return clonedMap;
            }
            if (value instanceof Set) {
                const clonedSet = new Set([...value].map(cloneValue));
                objectCloneMemo.set(value, clonedSet);
                return clonedSet;
            }
            const clonedObj = {};
            objectCloneMemo.set(value, clonedObj);
            const sourceKeys = Object.getOwnPropertyNames(value);
            for (const key of sourceKeys) {
                clonedObj[key] = cloneValue(value[key]);
            }
            Reflect.setPrototypeOf(clonedObj, Reflect.getPrototypeOf(value));
            return clonedObj;
        }
        case "symbol":
        case "function":
        default:
            throw new DOMException("Uncloneable value in stream", "DataCloneError");
    }
}
const core = Deno?.core;
const structuredClone = globalThis.structuredClone;
function sc(value) {
    return structuredClone
        ? structuredClone(value)
        : core
            ? core.deserialize(core.serialize(value))
            : cloneValue(value);
}
export function cloneState(state) {
    const clone = {};
    for (const [key, value] of Object.entries(state)) {
        try {
            const clonedValue = sc(value);
            clone[key] = clonedValue;
        }
        catch {
        }
    }
    return clone;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RydWN0dXJlZF9jbG9uZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0cnVjdHVyZWRfY2xvbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBeUNBLE1BQU0sZUFBZSxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7QUFFdEMsU0FBUyxnQkFBZ0IsQ0FDdkIsU0FBc0IsRUFDdEIsYUFBcUIsRUFDckIsU0FBaUIsRUFFakIsaUJBQXNCO0lBR3RCLE9BQU8sU0FBUyxDQUFDLEtBQUssQ0FDcEIsYUFBYSxFQUNiLGFBQWEsR0FBRyxTQUFTLENBQzFCLENBQUM7QUFDSixDQUFDO0FBS0QsU0FBUyxVQUFVLENBQUMsS0FBVTtJQUM1QixRQUFRLE9BQU8sS0FBSyxFQUFFO1FBQ3BCLEtBQUssUUFBUSxDQUFDO1FBQ2QsS0FBSyxRQUFRLENBQUM7UUFDZCxLQUFLLFNBQVMsQ0FBQztRQUNmLEtBQUssV0FBVyxDQUFDO1FBQ2pCLEtBQUssUUFBUTtZQUNYLE9BQU8sS0FBSyxDQUFDO1FBQ2YsS0FBSyxRQUFRLENBQUMsQ0FBQztZQUNiLElBQUksZUFBZSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDOUIsT0FBTyxlQUFlLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ25DO1lBQ0QsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO2dCQUNsQixPQUFPLEtBQUssQ0FBQzthQUNkO1lBQ0QsSUFBSSxLQUFLLFlBQVksSUFBSSxFQUFFO2dCQUN6QixPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2FBQ2xDO1lBQ0QsSUFBSSxLQUFLLFlBQVksTUFBTSxFQUFFO2dCQUMzQixPQUFPLElBQUksTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQzFCO1lBQ0QsSUFBSSxLQUFLLFlBQVksaUJBQWlCLEVBQUU7Z0JBQ3RDLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFDRCxJQUFJLEtBQUssWUFBWSxX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LENBQUM7QUFJRCxNQUFNLFVBQVUsVUFBVSxDQUFnQyxLQUFRO0lBQ2hFLE1BQU0sS0FBSyxHQUFHLEVBQU8sQ0FBQztJQUN0QixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtRQUNoRCxJQUFJO1lBQ0YsTUFBTSxXQUFXLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlCLEtBQUssQ0FBQyxHQUFjLENBQUMsR0FBRyxXQUFXLENBQUM7U0FDckM7UUFBQyxNQUFNO1NBRVA7S0FDRjtJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIG9hayBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuZXhwb3J0IHR5cGUgU3RydWN0dXJlZENsb25hYmxlID1cbiAgfCB7IFtrZXk6IHN0cmluZ106IFN0cnVjdHVyZWRDbG9uYWJsZSB9XG4gIHwgQXJyYXk8U3RydWN0dXJlZENsb25hYmxlPlxuICB8IEFycmF5QnVmZmVyXG4gIHwgQXJyYXlCdWZmZXJWaWV3XG4gIHwgQmlnSW50XG4gIHwgYmlnaW50XG4gIHwgQmxvYlxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICB8IEJvb2xlYW5cbiAgfCBib29sZWFuXG4gIHwgRGF0ZVxuICB8IEVycm9yXG4gIHwgRXZhbEVycm9yXG4gIHwgTWFwPFN0cnVjdHVyZWRDbG9uYWJsZSwgU3RydWN0dXJlZENsb25hYmxlPlxuICAvLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuICB8IE51bWJlclxuICB8IG51bWJlclxuICB8IFJhbmdlRXJyb3JcbiAgfCBSZWZlcmVuY2VFcnJvclxuICB8IFJlZ0V4cFxuICB8IFNldDxTdHJ1Y3R1cmVkQ2xvbmFibGU+XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gIHwgU3RyaW5nXG4gIHwgc3RyaW5nXG4gIHwgU3ludGF4RXJyb3JcbiAgfCBUeXBlRXJyb3JcbiAgfCBVUklFcnJvcjtcblxuZGVjbGFyZSBnbG9iYWwge1xuICBuYW1lc3BhY2UgRGVubyB7XG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby12YXJcbiAgICB2YXIgY29yZToge1xuICAgICAgZGVzZXJpYWxpemUodmFsdWU6IHVua25vd24pOiBTdHJ1Y3R1cmVkQ2xvbmFibGU7XG4gICAgICBzZXJpYWxpemUodmFsdWU6IFN0cnVjdHVyZWRDbG9uYWJsZSk6IHVua25vd247XG4gICAgfTtcbiAgfVxufVxuXG5jb25zdCBvYmplY3RDbG9uZU1lbW8gPSBuZXcgV2Vha01hcCgpO1xuXG5mdW5jdGlvbiBjbG9uZUFycmF5QnVmZmVyKFxuICBzcmNCdWZmZXI6IEFycmF5QnVmZmVyLFxuICBzcmNCeXRlT2Zmc2V0OiBudW1iZXIsXG4gIHNyY0xlbmd0aDogbnVtYmVyLFxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBfY2xvbmVDb25zdHJ1Y3RvcjogYW55LFxuKSB7XG4gIC8vIHRoaXMgZnVuY3Rpb24gZnVkZ2VzIHRoZSByZXR1cm4gdHlwZSBidXQgU2hhcmVkQXJyYXlCdWZmZXIgaXMgZGlzYWJsZWQgZm9yIGEgd2hpbGUgYW55d2F5XG4gIHJldHVybiBzcmNCdWZmZXIuc2xpY2UoXG4gICAgc3JjQnl0ZU9mZnNldCxcbiAgICBzcmNCeXRlT2Zmc2V0ICsgc3JjTGVuZ3RoLFxuICApO1xufVxuXG4vKiogQSBsb29zZSBhcHByb3hpbWF0aW9uIGZvciBzdHJ1Y3R1cmVkIGNsb25pbmcsIHVzZWQgd2hlbiB0aGUgYERlbm8uY29yZWBcbiAqIEFQSXMgYXJlIG5vdCBhdmFpbGFibGUuICovXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gY2xvbmVWYWx1ZSh2YWx1ZTogYW55KTogYW55IHtcbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgY2FzZSBcInVuZGVmaW5lZFwiOlxuICAgIGNhc2UgXCJiaWdpbnRcIjpcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICBjYXNlIFwib2JqZWN0XCI6IHtcbiAgICAgIGlmIChvYmplY3RDbG9uZU1lbW8uaGFzKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gb2JqZWN0Q2xvbmVNZW1vLmdldCh2YWx1ZSk7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICByZXR1cm4gbmV3IERhdGUodmFsdWUudmFsdWVPZigpKTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICByZXR1cm4gbmV3IFJlZ0V4cCh2YWx1ZSk7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBTaGFyZWRBcnJheUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgICBjb25zdCBjbG9uZWQgPSBjbG9uZUFycmF5QnVmZmVyKFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIDAsXG4gICAgICAgICAgdmFsdWUuYnl0ZUxlbmd0aCxcbiAgICAgICAgICBBcnJheUJ1ZmZlcixcbiAgICAgICAgKTtcbiAgICAgICAgb2JqZWN0Q2xvbmVNZW1vLnNldCh2YWx1ZSwgY2xvbmVkKTtcbiAgICAgICAgcmV0dXJuIGNsb25lZDtcbiAgICAgIH1cbiAgICAgIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGNsb25lZEJ1ZmZlciA9IGNsb25lVmFsdWUodmFsdWUuYnVmZmVyKTtcbiAgICAgICAgLy8gVXNlIERhdGFWaWV3Q29uc3RydWN0b3IgdHlwZSBwdXJlbHkgZm9yIHR5cGUtY2hlY2tpbmcsIGNhbiBiZSBhXG4gICAgICAgIC8vIERhdGFWaWV3IG9yIFR5cGVkQXJyYXkuICBUaGV5IHVzZSB0aGUgc2FtZSBjb25zdHJ1Y3RvciBzaWduYXR1cmUsXG4gICAgICAgIC8vIG9ubHkgRGF0YVZpZXcgaGFzIGEgbGVuZ3RoIGluIGJ5dGVzIGFuZCBUeXBlZEFycmF5cyB1c2UgYSBsZW5ndGggaW5cbiAgICAgICAgLy8gdGVybXMgb2YgZWxlbWVudHMsIHNvIHdlIGFkanVzdCBmb3IgdGhhdC5cbiAgICAgICAgbGV0IGxlbmd0aDtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0YVZpZXcpIHtcbiAgICAgICAgICBsZW5ndGggPSB2YWx1ZS5ieXRlTGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICAgICAgbGVuZ3RoID0gKHZhbHVlIGFzIGFueSkubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICAgIHJldHVybiBuZXcgKHZhbHVlLmNvbnN0cnVjdG9yIGFzIGFueSkoXG4gICAgICAgICAgY2xvbmVkQnVmZmVyLFxuICAgICAgICAgIHZhbHVlLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgbGVuZ3RoLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgTWFwKSB7XG4gICAgICAgIGNvbnN0IGNsb25lZE1hcCA9IG5ldyBNYXAoKTtcbiAgICAgICAgb2JqZWN0Q2xvbmVNZW1vLnNldCh2YWx1ZSwgY2xvbmVkTWFwKTtcbiAgICAgICAgdmFsdWUuZm9yRWFjaCgodiwgaykgPT4ge1xuICAgICAgICAgIGNsb25lZE1hcC5zZXQoY2xvbmVWYWx1ZShrKSwgY2xvbmVWYWx1ZSh2KSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY2xvbmVkTWFwO1xuICAgICAgfVxuICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgU2V0KSB7XG4gICAgICAgIC8vIGFzc3VtZXMgdGhhdCBjbG9uZVZhbHVlIHN0aWxsIHRha2VzIG9ubHkgb25lIGFyZ3VtZW50XG4gICAgICAgIGNvbnN0IGNsb25lZFNldCA9IG5ldyBTZXQoWy4uLnZhbHVlXS5tYXAoY2xvbmVWYWx1ZSkpO1xuICAgICAgICBvYmplY3RDbG9uZU1lbW8uc2V0KHZhbHVlLCBjbG9uZWRTZXQpO1xuICAgICAgICByZXR1cm4gY2xvbmVkU2V0O1xuICAgICAgfVxuXG4gICAgICAvLyBkZWZhdWx0IGZvciBvYmplY3RzXG4gICAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgICAgY29uc3QgY2xvbmVkT2JqOiBSZWNvcmQ8YW55LCBhbnk+ID0ge307XG4gICAgICBvYmplY3RDbG9uZU1lbW8uc2V0KHZhbHVlLCBjbG9uZWRPYmopO1xuICAgICAgY29uc3Qgc291cmNlS2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHZhbHVlKTtcbiAgICAgIGZvciAoY29uc3Qga2V5IG9mIHNvdXJjZUtleXMpIHtcbiAgICAgICAgY2xvbmVkT2JqW2tleV0gPSBjbG9uZVZhbHVlKHZhbHVlW2tleV0pO1xuICAgICAgfVxuICAgICAgUmVmbGVjdC5zZXRQcm90b3R5cGVPZihjbG9uZWRPYmosIFJlZmxlY3QuZ2V0UHJvdG90eXBlT2YodmFsdWUpKTtcbiAgICAgIHJldHVybiBjbG9uZWRPYmo7XG4gICAgfVxuICAgIGNhc2UgXCJzeW1ib2xcIjpcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IERPTUV4Y2VwdGlvbihcIlVuY2xvbmVhYmxlIHZhbHVlIGluIHN0cmVhbVwiLCBcIkRhdGFDbG9uZUVycm9yXCIpO1xuICB9XG59XG5cbmNvbnN0IGNvcmUgPSBEZW5vPy5jb3JlO1xuY29uc3Qgc3RydWN0dXJlZENsb25lOiAoKHZhbHVlOiB1bmtub3duKSA9PiB1bmtub3duKSB8IHVuZGVmaW5lZCA9XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIChnbG9iYWxUaGlzIGFzIGFueSkuc3RydWN0dXJlZENsb25lO1xuXG4vKipcbiAqIFByb3ZpZGVzIHN0cnVjdHVyZWQgY2xvbmluZ1xuICogQHBhcmFtIHZhbHVlXG4gKiBAcmV0dXJuc1xuICovXG5mdW5jdGlvbiBzYzxUIGV4dGVuZHMgU3RydWN0dXJlZENsb25hYmxlPih2YWx1ZTogVCk6IFQge1xuICByZXR1cm4gc3RydWN0dXJlZENsb25lXG4gICAgPyBzdHJ1Y3R1cmVkQ2xvbmUodmFsdWUpXG4gICAgOiBjb3JlXG4gICAgPyBjb3JlLmRlc2VyaWFsaXplKGNvcmUuc2VyaWFsaXplKHZhbHVlKSlcbiAgICA6IGNsb25lVmFsdWUodmFsdWUpO1xufVxuXG4vKiogQ2xvbmVzIGEgc3RhdGUgb2JqZWN0LCBza2lwcGluZyBhbnkgdmFsdWVzIHRoYXQgY2Fubm90IGJlIGNsb25lZC4gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gY2xvbmVTdGF0ZTxTIGV4dGVuZHMgUmVjb3JkPHN0cmluZywgYW55Pj4oc3RhdGU6IFMpOiBTIHtcbiAgY29uc3QgY2xvbmUgPSB7fSBhcyBTO1xuICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhzdGF0ZSkpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgY2xvbmVkVmFsdWUgPSBzYyh2YWx1ZSk7XG4gICAgICBjbG9uZVtrZXkgYXMga2V5b2YgU10gPSBjbG9uZWRWYWx1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIHdlIGp1c3Qgbm8tb3AgdmFsdWVzIHRoYXQgY2Fubm90IGJlIGNsb25lZFxuICAgIH1cbiAgfVxuICByZXR1cm4gY2xvbmU7XG59XG4iXX0=