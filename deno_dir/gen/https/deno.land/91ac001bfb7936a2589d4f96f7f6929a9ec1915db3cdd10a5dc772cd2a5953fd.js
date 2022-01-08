import { Code } from "../code.ts";
import { BSON_BINARY_SUBTYPE_DEFAULT, BSON_INT32_MAX, BSON_INT32_MIN, BSONData, } from "../constants.ts";
import { DBRef } from "../db_ref.ts";
import { Decimal128 } from "../decimal128.ts";
import { Double } from "../double.ts";
import { BSONError, BSONTypeError } from "../error.ts";
import { writeIEEE754 } from "../float_parser.ts";
import { Int32 } from "../int_32.ts";
import { Long } from "../long.ts";
import { MaxKey, MinKey } from "../key.ts";
import { ObjectId } from "../objectid.ts";
import { Timestamp } from "../timestamp.ts";
import { BSONRegExp } from "../regexp.ts";
import { Encoding, normalizedFunctionString, writeToBytes } from "./utils.ts";
import { Binary, BinarySizes, BSONSymbol } from "../bson.ts";
const regexp = /\x00/;
const ignoreKeys = new Set(["$db", "$ref", "$id", "$clusterTime"]);
function serializeString(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.STRING;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index = index + numberOfWrittenBytes + 1;
    buffer[index - 1] = 0;
    const size = writeToBytes(buffer, value, index + 4, Encoding.Utf8);
    buffer[index + 3] = ((size + 1) >> 24) & 0xff;
    buffer[index + 2] = ((size + 1) >> 16) & 0xff;
    buffer[index + 1] = ((size + 1) >> 8) & 0xff;
    buffer[index] = (size + 1) & 0xff;
    index = index + 4 + size;
    buffer[index++] = 0;
    return index;
}
function serializeNumber(buffer, key, value, index, isArray) {
    if (Number.isInteger(value) &&
        value >= BSON_INT32_MIN &&
        value <= BSON_INT32_MAX) {
        buffer[index++] = BSONData.INT;
        const numberOfWrittenBytes = !isArray
            ? writeToBytes(buffer, key, index, Encoding.Utf8)
            : writeToBytes(buffer, key, index, Encoding.Ascii);
        index += numberOfWrittenBytes;
        buffer[index++] = 0;
        buffer[index++] = value & 0xff;
        buffer[index++] = (value >> 8) & 0xff;
        buffer[index++] = (value >> 16) & 0xff;
        buffer[index++] = (value >> 24) & 0xff;
    }
    else {
        buffer[index++] = BSONData.NUMBER;
        const numberOfWrittenBytes = !isArray
            ? writeToBytes(buffer, key, index, Encoding.Utf8)
            : writeToBytes(buffer, key, index, Encoding.Ascii);
        index += numberOfWrittenBytes;
        buffer[index++] = 0;
        writeIEEE754(buffer, value, index, "little", 52, 8);
        index += 8;
    }
    return index;
}
function serializeNull(buffer, key, _, index, isArray) {
    buffer[index++] = BSONData.NULL;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    return index;
}
function serializeBoolean(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.BOOLEAN;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    buffer[index++] = value ? 1 : 0;
    return index;
}
function serializeDate(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.DATE;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const dateInMilis = Long.fromNumber(value.getTime());
    const lowBits = dateInMilis.getLowBits();
    const highBits = dateInMilis.getHighBits();
    buffer[index++] = lowBits & 0xff;
    buffer[index++] = (lowBits >> 8) & 0xff;
    buffer[index++] = (lowBits >> 16) & 0xff;
    buffer[index++] = (lowBits >> 24) & 0xff;
    buffer[index++] = highBits & 0xff;
    buffer[index++] = (highBits >> 8) & 0xff;
    buffer[index++] = (highBits >> 16) & 0xff;
    buffer[index++] = (highBits >> 24) & 0xff;
    return index;
}
function serializeRegExp(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.REGEXP;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    if (value.source && value.source.match(regexp) != null) {
        throw Error(`value ${value.source} must not contain null bytes`);
    }
    index += writeToBytes(buffer, value.source, index, Encoding.Utf8);
    buffer[index++] = 0x00;
    if (value.ignoreCase)
        buffer[index++] = 0x69;
    if (value.global)
        buffer[index++] = 0x73;
    if (value.multiline)
        buffer[index++] = 0x6d;
    buffer[index++] = 0x00;
    return index;
}
function serializeBSONRegExp(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.REGEXP;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    if (value.pattern.match(regexp) != null) {
        throw Error(`pattern ${value.pattern} must not contain null bytes`);
    }
    index += writeToBytes(buffer, value.pattern, index, Encoding.Utf8);
    buffer[index++] = 0x00;
    index += writeToBytes(buffer, value.options.split("").sort().join(""), index, Encoding.Utf8);
    buffer[index++] = 0x00;
    return index;
}
function serializeMinMax(buffer, key, value, index, isArray) {
    if (value === null) {
        buffer[index++] = BSONData.NULL;
    }
    else if (value instanceof MinKey) {
        buffer[index++] = BSONData.MIN_KEY;
    }
    else {
        buffer[index++] = BSONData.MAX_KEY;
    }
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    return index;
}
function serializeObjectId(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.OID;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    if (typeof value.id === "string") {
        writeToBytes(buffer, value.id, index, Encoding.Ascii);
    }
    else if (value.id instanceof Uint8Array) {
        buffer.set(value.id.subarray(0, 12), index);
    }
    else {
        throw new BSONTypeError(`object [${JSON.stringify(value)}] is not a valid ObjectId`);
    }
    return index + 12;
}
function serializeBuffer(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.BINARY;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const size = value.length;
    buffer[index++] = size & 0xff;
    buffer[index++] = (size >> 8) & 0xff;
    buffer[index++] = (size >> 16) & 0xff;
    buffer[index++] = (size >> 24) & 0xff;
    buffer[index++] = BSON_BINARY_SUBTYPE_DEFAULT;
    buffer.set(value, index);
    index += size;
    return index;
}
function serializeObject(buffer, key, value, index, checkKeys = false, depth = 0, serializeFunctions = false, ignoreUndefined = true, isArray = false, path = []) {
    for (let i = 0; i < path.length; i++) {
        if (path[i] === value)
            throw new BSONError("cyclic dependency detected");
    }
    path.push(value);
    buffer[index++] = Array.isArray(value) ? BSONData.ARRAY : BSONData.OBJECT;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const endIndex = serializeInto(buffer, value, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined, path);
    path.pop();
    return endIndex;
}
function serializeDecimal128(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.DECIMAL128;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    buffer.set(value.bytes.subarray(0, 16), index);
    return index + 16;
}
function serializeLong(buffer, key, value, index, isArray) {
    buffer[index++] = value instanceof Timestamp
        ? BSONData.TIMESTAMP
        : BSONData.LONG;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const lowBits = value.getLowBits();
    const highBits = value.getHighBits();
    buffer[index++] = lowBits & 0xff;
    buffer[index++] = (lowBits >> 8) & 0xff;
    buffer[index++] = (lowBits >> 16) & 0xff;
    buffer[index++] = (lowBits >> 24) & 0xff;
    buffer[index++] = highBits & 0xff;
    buffer[index++] = (highBits >> 8) & 0xff;
    buffer[index++] = (highBits >> 16) & 0xff;
    buffer[index++] = (highBits >> 24) & 0xff;
    return index;
}
function serializeInt32(buffer, key, value, index, isArray) {
    value = value.valueOf();
    buffer[index++] = BSONData.INT;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    buffer[index++] = value & 0xff;
    buffer[index++] = (value >> 8) & 0xff;
    buffer[index++] = (value >> 16) & 0xff;
    buffer[index++] = (value >> 24) & 0xff;
    return index;
}
function serializeDouble(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.NUMBER;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    writeIEEE754(buffer, value.value, index, "little", 52, 8);
    index += 8;
    return index;
}
function serializeFunction(buffer, key, value, index, _checkKeys = false, _depth = 0, isArray) {
    buffer[index++] = BSONData.CODE;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const functionString = normalizedFunctionString(value);
    const size = writeToBytes(buffer, functionString, index + 4, Encoding.Utf8) +
        1;
    buffer[index] = size & 0xff;
    buffer[index + 1] = (size >> 8) & 0xff;
    buffer[index + 2] = (size >> 16) & 0xff;
    buffer[index + 3] = (size >> 24) & 0xff;
    index = index + 4 + size - 1;
    buffer[index++] = 0;
    return index;
}
function serializeCode(buffer, key, value, index, checkKeys = false, depth = 0, serializeFunctions = false, ignoreUndefined = true, isArray = false) {
    if (value.scope && typeof value.scope === "object") {
        buffer[index++] = BSONData.CODE_W_SCOPE;
        const numberOfWrittenBytes = !isArray
            ? writeToBytes(buffer, key, index, Encoding.Utf8)
            : writeToBytes(buffer, key, index, Encoding.Ascii);
        index += numberOfWrittenBytes;
        buffer[index++] = 0;
        let startIndex = index;
        const functionString = typeof value.code === "string"
            ? value.code
            : value.code.toString();
        index += 4;
        const codeSize = writeToBytes(buffer, functionString, index + 4, Encoding.Utf8) +
            1;
        buffer[index] = codeSize & 0xff;
        buffer[index + 1] = (codeSize >> 8) & 0xff;
        buffer[index + 2] = (codeSize >> 16) & 0xff;
        buffer[index + 3] = (codeSize >> 24) & 0xff;
        buffer[index + 4 + codeSize - 1] = 0;
        index = index + codeSize + 4;
        const endIndex = serializeInto(buffer, value.scope, checkKeys, index, depth + 1, serializeFunctions, ignoreUndefined);
        index = endIndex - 1;
        const totalSize = endIndex - startIndex;
        buffer[startIndex++] = totalSize & 0xff;
        buffer[startIndex++] = (totalSize >> 8) & 0xff;
        buffer[startIndex++] = (totalSize >> 16) & 0xff;
        buffer[startIndex++] = (totalSize >> 24) & 0xff;
    }
    else {
        buffer[index++] = BSONData.CODE;
        const numberOfWrittenBytes = !isArray
            ? writeToBytes(buffer, key, index, Encoding.Utf8)
            : writeToBytes(buffer, key, index, Encoding.Ascii);
        index += numberOfWrittenBytes;
        buffer[index++] = 0;
        const functionString = value.code.toString();
        const size = writeToBytes(buffer, functionString, index + 4, Encoding.Utf8) + 1;
        buffer[index] = size & 0xff;
        buffer[index + 1] = (size >> 8) & 0xff;
        buffer[index + 2] = (size >> 16) & 0xff;
        buffer[index + 3] = (size >> 24) & 0xff;
        index = index + 4 + size - 1;
    }
    buffer[index++] = 0;
    return index;
}
function serializeBinary(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.BINARY;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const data = value.buffer;
    let size = value.buffer.length;
    if (value.subType === BinarySizes.SUBTYPE_BYTE_ARRAY)
        size += 4;
    buffer[index++] = size & 0xff;
    buffer[index++] = (size >> 8) & 0xff;
    buffer[index++] = (size >> 16) & 0xff;
    buffer[index++] = (size >> 24) & 0xff;
    buffer[index++] = value.subType;
    if (value.subType === BinarySizes.SUBTYPE_BYTE_ARRAY) {
        size -= 4;
        buffer[index++] = size & 0xff;
        buffer[index++] = (size >> 8) & 0xff;
        buffer[index++] = (size >> 16) & 0xff;
        buffer[index++] = (size >> 24) & 0xff;
    }
    buffer.set(data, index);
    index += size;
    return index;
}
function serializeSymbol(buffer, key, value, index, isArray) {
    buffer[index++] = BSONData.SYMBOL;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    const size = writeToBytes(buffer, value.value, index + 4, Encoding.Utf8) + 1;
    buffer[index] = size & 0xff;
    buffer[index + 1] = (size >> 8) & 0xff;
    buffer[index + 2] = (size >> 16) & 0xff;
    buffer[index + 3] = (size >> 24) & 0xff;
    index = index + 4 + size - 1;
    buffer[index++] = 0x00;
    return index;
}
function serializeDBRef(buffer, key, value, index, depth, serializeFunctions, isArray) {
    buffer[index++] = BSONData.OBJECT;
    const numberOfWrittenBytes = !isArray
        ? writeToBytes(buffer, key, index, Encoding.Utf8)
        : writeToBytes(buffer, key, index, Encoding.Ascii);
    index += numberOfWrittenBytes;
    buffer[index++] = 0;
    let startIndex = index;
    let output = {
        $ref: value.collection,
        $id: value.oid,
    };
    if (value.db != null) {
        output.$db = value.db;
    }
    output = Object.assign(output, value.fields);
    const endIndex = serializeInto(buffer, output, false, index, depth + 1, serializeFunctions);
    const size = endIndex - startIndex;
    buffer[startIndex++] = size & 0xff;
    buffer[startIndex++] = (size >> 8) & 0xff;
    buffer[startIndex++] = (size >> 16) & 0xff;
    buffer[startIndex++] = (size >> 24) & 0xff;
    return endIndex;
}
export function serializeInto(buffer, object, checkKeys = false, startingIndex = 0, depth = 0, serializeFunctions = false, ignoreUndefined = true, path = []) {
    startingIndex = startingIndex || 0;
    path = path || [];
    path.push(object);
    let index = startingIndex + 4;
    if (Array.isArray(object)) {
        for (let i = 0; i < object.length; i++) {
            const key = i.toString();
            let value = object[i];
            if (value?.toBSON) {
                if (typeof value.toBSON !== "function") {
                    throw new BSONTypeError("toBSON is not a function");
                }
                value = value.toBSON();
            }
            if (typeof value === "string") {
                index = serializeString(buffer, key, value, index, true);
            }
            else if (typeof value === "number") {
                index = serializeNumber(buffer, key, value, index, true);
            }
            else if (typeof value === "bigint") {
                throw new BSONTypeError("Unsupported type BigInt, please use Decimal128");
            }
            else if (typeof value === "boolean") {
                index = serializeBoolean(buffer, key, value, index, true);
            }
            else if (value instanceof Date) {
                index = serializeDate(buffer, key, value, index, true);
            }
            else if (value === undefined) {
                index = serializeNull(buffer, key, value, index, true);
            }
            else if (value === null) {
                index = serializeNull(buffer, key, value, index, true);
            }
            else if (value instanceof ObjectId) {
                index = serializeObjectId(buffer, key, value, index, true);
            }
            else if (value instanceof Uint8Array) {
                index = serializeBuffer(buffer, key, value, index, true);
            }
            else if (value instanceof RegExp) {
                index = serializeRegExp(buffer, key, value, index, true);
            }
            else if (value instanceof Decimal128) {
                index = serializeDecimal128(buffer, key, value, index, true);
            }
            else if (value instanceof Long || value instanceof Timestamp) {
                index = serializeLong(buffer, key, value, index, true);
            }
            else if (value instanceof Double) {
                index = serializeDouble(buffer, key, value, index, true);
            }
            else if (typeof value === "function" && serializeFunctions) {
                index = serializeFunction(buffer, key, value, index, checkKeys, depth, true);
            }
            else if (value instanceof Code) {
                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, true);
            }
            else if (value instanceof Binary) {
                index = serializeBinary(buffer, key, value, index, true);
            }
            else if (value instanceof BSONSymbol) {
                index = serializeSymbol(buffer, key, value, index, true);
            }
            else if (value instanceof DBRef) {
                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions, true);
            }
            else if (value instanceof BSONRegExp) {
                index = serializeBSONRegExp(buffer, key, value, index, true);
            }
            else if (value instanceof Int32) {
                index = serializeInt32(buffer, key, value, index, true);
            }
            else if (value instanceof MinKey || value instanceof MaxKey) {
                index = serializeMinMax(buffer, key, value, index, true);
            }
            else if (value instanceof Object) {
                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, true, path);
            }
            else {
                throw new BSONTypeError(`Unrecognized or invalid BSON Type: ${value}`);
            }
        }
    }
    else if (object instanceof Map) {
        const iterator = object.entries();
        let done = false;
        while (!done) {
            const entry = iterator.next();
            done = !!entry.done;
            if (done)
                continue;
            const key = entry.value[0];
            const value = entry.value[1];
            const type = typeof value;
            if (typeof key === "string" && !ignoreKeys.has(key)) {
                if (key.match(regexp) != null) {
                    throw Error(`key ${key} must not contain null bytes`);
                }
                if (checkKeys) {
                    if (key.startsWith("$")) {
                        throw Error(`key ${key} must not start with '$'`);
                    }
                    else if (~key.indexOf(".")) {
                        throw Error(`key ${key} must not contain '.'`);
                    }
                }
            }
            if (type === "string") {
                index = serializeString(buffer, key, value, index);
            }
            else if (type === "number") {
                index = serializeNumber(buffer, key, value, index);
            }
            else if (type === "bigint" || value instanceof BigInt64Array ||
                value instanceof BigUint64Array) {
                throw new BSONTypeError("Unsupported type BigInt, please use Decimal128");
            }
            else if (type === "boolean") {
                index = serializeBoolean(buffer, key, value, index);
            }
            else if (value instanceof Date) {
                index = serializeDate(buffer, key, value, index);
            }
            else if (value === null || (value === undefined && ignoreUndefined === false)) {
                index = serializeNull(buffer, key, value, index);
            }
            else if (value instanceof ObjectId) {
                index = serializeObjectId(buffer, key, value, index);
            }
            else if (value instanceof Uint8Array) {
                index = serializeBuffer(buffer, key, value, index);
            }
            else if (value instanceof RegExp) {
                index = serializeRegExp(buffer, key, value, index);
            }
            else if (type === "object" && value instanceof Object) {
                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, false, path);
            }
            else if (type === "object" && value instanceof Decimal128) {
                index = serializeDecimal128(buffer, key, value, index);
            }
            else if (value instanceof Long) {
                index = serializeLong(buffer, key, value, index);
            }
            else if (value instanceof Double) {
                index = serializeDouble(buffer, key, value, index);
            }
            else if (value instanceof Code) {
                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined);
            }
            else if (typeof value === "function" && serializeFunctions) {
                index = serializeFunction(buffer, key, value, index, checkKeys, depth, serializeFunctions);
            }
            else if (value instanceof Binary) {
                index = serializeBinary(buffer, key, value, index);
            }
            else if (value instanceof BSONSymbol) {
                index = serializeSymbol(buffer, key, value, index);
            }
            else if (value instanceof DBRef) {
                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions);
            }
            else if (value instanceof BSONRegExp) {
                index = serializeBSONRegExp(buffer, key, value, index);
            }
            else if (value instanceof Int32) {
                index = serializeInt32(buffer, key, value, index);
            }
            else if (value instanceof MinKey || value instanceof MaxKey) {
                index = serializeMinMax(buffer, key, value, index);
            }
            else {
                throw new BSONTypeError(`Unrecognized or invalid BSON TYPE: ${value}`);
            }
        }
    }
    else {
        if (object.toBSON) {
            if (typeof object.toBSON !== "function") {
                throw new BSONTypeError("toBSON is not a function");
            }
            object = object.toBSON();
            if (object != null && typeof object !== "object") {
                throw new BSONTypeError("toBSON function did not return an object");
            }
        }
        for (const key in object) {
            let value = object[key];
            if (value?.toBSON) {
                if (typeof value.toBSON !== "function") {
                    throw new BSONTypeError("toBSON is not a function");
                }
                value = value.toBSON();
            }
            const type = typeof value;
            if (typeof key === "string" && !ignoreKeys.has(key)) {
                if (key.match(regexp) != null) {
                    throw Error(`key ${key} must not contain null bytes`);
                }
                if (checkKeys) {
                    if (key.startsWith("$")) {
                        throw Error(`key ${key} must not start with '$'`);
                    }
                    else if (~key.indexOf(".")) {
                        throw Error(`key ${key} must not contain '.'`);
                    }
                }
            }
            if (type === "string") {
                index = serializeString(buffer, key, value, index);
            }
            else if (type === "number") {
                index = serializeNumber(buffer, key, value, index);
            }
            else if (type === "bigint") {
                throw new BSONTypeError("Unsupported type BigInt, please use Decimal128");
            }
            else if (type === "boolean") {
                index = serializeBoolean(buffer, key, value, index);
            }
            else if (value instanceof Date) {
                index = serializeDate(buffer, key, value, index);
            }
            else if (value === undefined) {
                if (ignoreUndefined === false) {
                    index = serializeNull(buffer, key, value, index);
                }
            }
            else if (value === null) {
                index = serializeNull(buffer, key, value, index);
            }
            else if (value instanceof ObjectId) {
                index = serializeObjectId(buffer, key, value, index);
            }
            else if (value instanceof Uint8Array) {
                index = serializeBuffer(buffer, key, value, index);
            }
            else if (value instanceof RegExp) {
                index = serializeRegExp(buffer, key, value, index);
            }
            else if (type === "object" && value instanceof Decimal128) {
                index = serializeDecimal128(buffer, key, value, index);
            }
            else if (value instanceof Long || value instanceof Timestamp) {
                index = serializeLong(buffer, key, value, index);
            }
            else if (value instanceof Double) {
                index = serializeDouble(buffer, key, value, index);
            }
            else if (value instanceof Code) {
                index = serializeCode(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined);
            }
            else if (typeof value === "function" && serializeFunctions) {
                index = serializeFunction(buffer, key, value, index, checkKeys, depth, serializeFunctions);
            }
            else if (value instanceof Binary) {
                index = serializeBinary(buffer, key, value, index);
            }
            else if (value instanceof BSONSymbol) {
                index = serializeSymbol(buffer, key, value, index);
            }
            else if (value instanceof DBRef) {
                index = serializeDBRef(buffer, key, value, index, depth, serializeFunctions);
            }
            else if (value instanceof BSONRegExp) {
                index = serializeBSONRegExp(buffer, key, value, index);
            }
            else if (value instanceof Int32) {
                index = serializeInt32(buffer, key, value, index);
            }
            else if (value instanceof MinKey || value instanceof MaxKey) {
                index = serializeMinMax(buffer, key, value, index);
            }
            else if (value instanceof Object) {
                index = serializeObject(buffer, key, value, index, checkKeys, depth, serializeFunctions, ignoreUndefined, false, path);
            }
            else {
                throw new BSONTypeError(`Unrecognized or invalid BSON Type: ${value}`);
            }
        }
    }
    path.pop();
    buffer[index++] = 0x00;
    const size = index - startingIndex;
    buffer[startingIndex++] = size & 0xff;
    buffer[startingIndex++] = (size >> 8) & 0xff;
    buffer[startingIndex++] = (size >> 16) & 0xff;
    buffer[startingIndex++] = (size >> 24) & 0xff;
    return index;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcmlhbGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNsQyxPQUFPLEVBQ0wsMkJBQTJCLEVBQzNCLGNBQWMsRUFDZCxjQUFjLEVBQ2QsUUFBUSxHQUNULE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLEtBQUssRUFBYSxNQUFNLGNBQWMsQ0FBQztBQUNoRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDOUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN0QyxPQUFPLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN2RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDbEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNyQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQzNDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDNUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMxQyxPQUFPLEVBQUUsUUFBUSxFQUFFLHdCQUF3QixFQUFFLFlBQVksRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM5RSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQVksTUFBTSxZQUFZLENBQUM7QUFjdkUsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3RCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxF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QyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDN0MsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO0lBQzlDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUM5QyxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb2RlIH0gZnJvbSBcIi4uL2NvZGUudHNcIjtcbmltcG9ydCB7XG4gIEJTT05fQklOQVJZX1NVQlRZUEVfREVGQVVMVCxcbiAgQlNPTl9JTlQzMl9NQVgsXG4gIEJTT05fSU5UMzJfTUlOLFxuICBCU09ORGF0YSxcbn0gZnJvbSBcIi4uL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0IHsgREJSZWYsIERCUmVmTGlrZSB9IGZyb20gXCIuLi9kYl9yZWYudHNcIjtcbmltcG9ydCB7IERlY2ltYWwxMjggfSBmcm9tIFwiLi4vZGVjaW1hbDEyOC50c1wiO1xuaW1wb3J0IHsgRG91YmxlIH0gZnJvbSBcIi4uL2RvdWJsZS50c1wiO1xuaW1wb3J0IHsgQlNPTkVycm9yLCBCU09OVHlwZUVycm9yIH0gZnJvbSBcIi4uL2Vycm9yLnRzXCI7XG5pbXBvcnQgeyB3cml0ZUlFRUU3NTQgfSBmcm9tIFwiLi4vZmxvYXRfcGFyc2VyLnRzXCI7XG5pbXBvcnQgeyBJbnQzMiB9IGZyb20gXCIuLi9pbnRfMzIudHNcIjtcbmltcG9ydCB7IExvbmcgfSBmcm9tIFwiLi4vbG9uZy50c1wiO1xuaW1wb3J0IHsgTWF4S2V5LCBNaW5LZXkgfSBmcm9tIFwiLi4va2V5LnRzXCI7XG5pbXBvcnQgeyBPYmplY3RJZCB9IGZyb20gXCIuLi9vYmplY3RpZC50c1wiO1xuaW1wb3J0IHsgVGltZXN0YW1wIH0gZnJvbSBcIi4uL3RpbWVzdGFtcC50c1wiO1xuaW1wb3J0IHsgQlNPTlJlZ0V4cCB9IGZyb20gXCIuLi9yZWdleHAudHNcIjtcbmltcG9ydCB7IEVuY29kaW5nLCBub3JtYWxpemVkRnVuY3Rpb25TdHJpbmcsIHdyaXRlVG9CeXRlcyB9IGZyb20gXCIuL3V0aWxzLnRzXCI7XG5pbXBvcnQgeyBCaW5hcnksIEJpbmFyeVNpemVzLCBCU09OU3ltYm9sLCBEb2N1bWVudCB9IGZyb20gXCIuLi9ic29uLnRzXCI7XG4vKiogQHB1YmxpYyAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJpYWxpemVPcHRpb25zIHtcbiAgLyoqIHRoZSBzZXJpYWxpemVyIHdpbGwgY2hlY2sgaWYga2V5cyBhcmUgdmFsaWQuICovXG4gIGNoZWNrS2V5cz86IGJvb2xlYW47XG4gIC8qKiBzZXJpYWxpemUgdGhlIGphdmFzY3JpcHQgZnVuY3Rpb25zICoqKGRlZmF1bHQ6ZmFsc2UpKiouICovXG4gIHNlcmlhbGl6ZUZ1bmN0aW9ucz86IGJvb2xlYW47XG4gIC8qKiBzZXJpYWxpemUgd2lsbCBub3QgZW1pdCB1bmRlZmluZWQgZmllbGRzICoqKGRlZmF1bHQ6dHJ1ZSkqKiAqL1xuICBpZ25vcmVVbmRlZmluZWQ/OiBib29sZWFuO1xuICAvKiogdGhlIGluZGV4IGluIHRoZSBidWZmZXIgd2hlcmUgd2Ugd2lzaCB0byBzdGFydCBzZXJpYWxpemluZyBpbnRvICovXG4gIGluZGV4PzogbnVtYmVyO1xufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWNvbnRyb2wtcmVnZXhcbmNvbnN0IHJlZ2V4cCA9IC9cXHgwMC87XG5jb25zdCBpZ25vcmVLZXlzID0gbmV3IFNldChbXCIkZGJcIiwgXCIkcmVmXCIsIFwiJGlkXCIsIFwiJGNsdXN0ZXJUaW1lXCJdKTtcblxuLypcbiAqIGlzQXJyYXkgaW5kaWNhdGVzIGlmIHdlIGFyZSB3cml0aW5nIHRvIGEgQlNPTiBhcnJheSAodHlwZSAweDA0KVxuICogd2hpY2ggZm9yY2VzIHRoZSBcImtleVwiIHdoaWNoIHJlYWxseSBhbiBhcnJheSBpbmRleCBhcyBhIHN0cmluZyB0byBiZSB3cml0dGVuIGFzIGFzY2lpXG4gKiBUaGlzIHdpbGwgY2F0Y2ggYW55IGVycm9ycyBpbiBpbmRleCBhcyBhIHN0cmluZyBnZW5lcmF0aW9uXG4gKi9cblxuZnVuY3Rpb24gc2VyaWFsaXplU3RyaW5nKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogc3RyaW5nLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBFbmNvZGUgU3RyaW5nIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuU1RSSU5HO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggPSBpbmRleCArIG51bWJlck9mV3JpdHRlbkJ5dGVzICsgMTtcbiAgYnVmZmVyW2luZGV4IC0gMV0gPSAwO1xuICAvLyBXcml0ZSB0aGUgc3RyaW5nXG4gIGNvbnN0IHNpemUgPSB3cml0ZVRvQnl0ZXMoYnVmZmVyLCB2YWx1ZSwgaW5kZXggKyA0LCBFbmNvZGluZy5VdGY4KTtcbiAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgYnVmZmVyW2luZGV4ICsgM10gPSAoKHNpemUgKyAxKSA+PiAyNCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXggKyAyXSA9ICgoc2l6ZSArIDEpID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCArIDFdID0gKChzaXplICsgMSkgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXhdID0gKHNpemUgKyAxKSAmIDB4ZmY7XG4gIC8vIFVwZGF0ZSBpbmRleFxuICBpbmRleCA9IGluZGV4ICsgNCArIHNpemU7XG4gIC8vIFdyaXRlIHplcm9cbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVOdW1iZXIoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBudW1iZXIsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdlIGhhdmUgYW4gaW50ZWdlciB2YWx1ZVxuICAvLyBUT0RPKE5PREUtMjUyOSk6IEFkZCBzdXBwb3J0IGZvciBiaWcgaW50XG4gIGlmIChcbiAgICBOdW1iZXIuaXNJbnRlZ2VyKHZhbHVlKSAmJlxuICAgIHZhbHVlID49IEJTT05fSU5UMzJfTUlOICYmXG4gICAgdmFsdWUgPD0gQlNPTl9JTlQzMl9NQVhcbiAgKSB7XG4gICAgLy8gSWYgdGhlIHZhbHVlIGZpdHMgaW4gMzIgYml0cyBlbmNvZGUgYXMgaW50MzJcbiAgICAvLyBTZXQgaW50IHR5cGUgMzIgYml0cyBvciBsZXNzXG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuSU5UO1xuICAgIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gICAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gICAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gICAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gICAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgICAvLyBXcml0ZSB0aGUgaW50IHZhbHVlXG4gICAgYnVmZmVyW2luZGV4KytdID0gdmFsdWUgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9ICh2YWx1ZSA+PiA4KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDI0KSAmIDB4ZmY7XG4gIH0gZWxzZSB7XG4gICAgLy8gRW5jb2RlIGFzIGRvdWJsZVxuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk5VTUJFUjtcbiAgICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICAgIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAgIC8vIEVuY29kZSB0aGUgbmFtZVxuICAgIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gICAgLy8gV3JpdGUgZmxvYXRcbiAgICB3cml0ZUlFRUU3NTQoYnVmZmVyLCB2YWx1ZSwgaW5kZXgsIFwibGl0dGxlXCIsIDUyLCA4KTtcbiAgICAvLyBBZGp1c3QgaW5kZXhcbiAgICBpbmRleCArPSA4O1xuICB9XG5cbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVOdWxsKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICBfOiB1bmtub3duLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBTZXQgbG9uZyB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk5VTEw7XG5cbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcblxuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplQm9vbGVhbihcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IGJvb2xlYW4sXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkJPT0xFQU47XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgLy8gRW5jb2RlIHRoZSBib29sZWFuIHZhbHVlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IHZhbHVlID8gMSA6IDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplRGF0ZShcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IERhdGUsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkRBVEU7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICAvLyBXcml0ZSB0aGUgZGF0ZVxuICBjb25zdCBkYXRlSW5NaWxpcyA9IExvbmcuZnJvbU51bWJlcih2YWx1ZS5nZXRUaW1lKCkpO1xuICBjb25zdCBsb3dCaXRzID0gZGF0ZUluTWlsaXMuZ2V0TG93Qml0cygpO1xuICBjb25zdCBoaWdoQml0cyA9IGRhdGVJbk1pbGlzLmdldEhpZ2hCaXRzKCk7XG4gIC8vIEVuY29kZSBsb3cgYml0c1xuICBidWZmZXJbaW5kZXgrK10gPSBsb3dCaXRzICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGxvd0JpdHMgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiAyNCkgJiAweGZmO1xuICAvLyBFbmNvZGUgaGlnaCBiaXRzXG4gIGJ1ZmZlcltpbmRleCsrXSA9IGhpZ2hCaXRzICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChoaWdoQml0cyA+PiAyNCkgJiAweGZmO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVJlZ0V4cChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IFJlZ0V4cCxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuUkVHRVhQO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuXG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgaWYgKHZhbHVlLnNvdXJjZSAmJiB2YWx1ZS5zb3VyY2UubWF0Y2gocmVnZXhwKSAhPSBudWxsKSB7XG4gICAgdGhyb3cgRXJyb3IoYHZhbHVlICR7dmFsdWUuc291cmNlfSBtdXN0IG5vdCBjb250YWluIG51bGwgYnl0ZXNgKTtcbiAgfVxuICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gIGluZGV4ICs9IHdyaXRlVG9CeXRlcyhidWZmZXIsIHZhbHVlLnNvdXJjZSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpO1xuICAvLyBXcml0ZSB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDB4MDA7XG4gIC8vIFdyaXRlIHRoZSBwYXJhbWV0ZXJzXG4gIGlmICh2YWx1ZS5pZ25vcmVDYXNlKSBidWZmZXJbaW5kZXgrK10gPSAweDY5OyAvLyBpXG4gIGlmICh2YWx1ZS5nbG9iYWwpIGJ1ZmZlcltpbmRleCsrXSA9IDB4NzM7IC8vIHNcbiAgaWYgKHZhbHVlLm11bHRpbGluZSkgYnVmZmVyW2luZGV4KytdID0gMHg2ZDsgLy8gbVxuXG4gIC8vIEFkZCBlbmRpbmcgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAweDAwO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUJTT05SZWdFeHAoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBCU09OUmVnRXhwLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5SRUdFWFA7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICAvLyBDaGVjayB0aGUgcGF0dGVybiBmb3IgMCBieXRlc1xuICBpZiAodmFsdWUucGF0dGVybi5tYXRjaChyZWdleHApICE9IG51bGwpIHtcbiAgICAvLyBUaGUgQlNPTiBzcGVjIGRvZXNuJ3QgYWxsb3cga2V5cyB3aXRoIG51bGwgYnl0ZXMgYmVjYXVzZSBrZXlzIGFyZVxuICAgIC8vIG51bGwtdGVybWluYXRlZC5cbiAgICB0aHJvdyBFcnJvcihgcGF0dGVybiAke3ZhbHVlLnBhdHRlcm59IG11c3Qgbm90IGNvbnRhaW4gbnVsbCBieXRlc2ApO1xuICB9XG5cbiAgLy8gQWRqdXN0IHRoZSBpbmRleFxuICBpbmRleCArPSB3cml0ZVRvQnl0ZXMoYnVmZmVyLCB2YWx1ZS5wYXR0ZXJuLCBpbmRleCwgRW5jb2RpbmcuVXRmOCk7XG4gIC8vIFdyaXRlIHplcm9cbiAgYnVmZmVyW2luZGV4KytdID0gMHgwMDtcbiAgLy8gV3JpdGUgdGhlIG9wdGlvbnNcbiAgaW5kZXggKz0gd3JpdGVUb0J5dGVzKFxuICAgIGJ1ZmZlcixcbiAgICB2YWx1ZS5vcHRpb25zLnNwbGl0KFwiXCIpLnNvcnQoKS5qb2luKFwiXCIpLFxuICAgIGluZGV4LFxuICAgIEVuY29kaW5nLlV0ZjgsXG4gICk7XG4gIC8vIEFkZCBlbmRpbmcgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAweDAwO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZU1pbk1heChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IE1pbktleSB8IE1heEtleSxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGUgb2YgZWl0aGVyIG1pbiBvciBtYXgga2V5XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk5VTEw7XG4gIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBNaW5LZXkpIHtcbiAgICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5NSU5fS0VZO1xuICB9IGVsc2Uge1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk1BWF9LRVk7XG4gIH1cblxuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplT2JqZWN0SWQoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBPYmplY3RJZCxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuT0lEO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuXG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICAvLyBXcml0ZSB0aGUgb2JqZWN0SWQgaW50byB0aGUgc2hhcmVkIGJ1ZmZlclxuICBpZiAodHlwZW9mIHZhbHVlLmlkID09PSBcInN0cmluZ1wiKSB7XG4gICAgd3JpdGVUb0J5dGVzKGJ1ZmZlciwgdmFsdWUuaWQsIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIH0gZWxzZSBpZiAodmFsdWUuaWQgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgLy8gVXNlIHRoZSBzdGFuZGFyZCBKUyBtZXRob2RzIGhlcmUgYmVjYXVzZSBidWZmZXIuY29weSgpIGlzIGJ1Z2d5IHdpdGggdGhlXG4gICAgLy8gYnJvd3NlciBwb2x5ZmlsbFxuICAgIGJ1ZmZlci5zZXQodmFsdWUuaWQuc3ViYXJyYXkoMCwgMTIpLCBpbmRleCk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICBgb2JqZWN0IFske0pTT04uc3RyaW5naWZ5KHZhbHVlKX1dIGlzIG5vdCBhIHZhbGlkIE9iamVjdElkYCxcbiAgICApO1xuICB9XG5cbiAgLy8gQWRqdXN0IGluZGV4XG4gIHJldHVybiBpbmRleCArIDEyO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVCdWZmZXIoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBVaW50OEFycmF5LFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5CSU5BUlk7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgLy8gR2V0IHNpemUgb2YgdGhlIGJ1ZmZlciAoY3VycmVudCB3cml0ZSBwb2ludClcbiAgY29uc3Qgc2l6ZSA9IHZhbHVlLmxlbmd0aDtcbiAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgYnVmZmVyW2luZGV4KytdID0gc2l6ZSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgLy8gV3JpdGUgdGhlIGRlZmF1bHQgc3VidHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09OX0JJTkFSWV9TVUJUWVBFX0RFRkFVTFQ7XG4gIC8vIENvcHkgdGhlIGNvbnRlbnQgZm9ybSB0aGUgYmluYXJ5IGZpZWxkIHRvIHRoZSBidWZmZXJcbiAgYnVmZmVyLnNldCh2YWx1ZSwgaW5kZXgpO1xuICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gIGluZGV4ICs9IHNpemU7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplT2JqZWN0KFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogRG9jdW1lbnQsXG4gIGluZGV4OiBudW1iZXIsXG4gIGNoZWNrS2V5cyA9IGZhbHNlLFxuICBkZXB0aCA9IDAsXG4gIHNlcmlhbGl6ZUZ1bmN0aW9ucyA9IGZhbHNlLFxuICBpZ25vcmVVbmRlZmluZWQgPSB0cnVlLFxuICBpc0FycmF5ID0gZmFsc2UsXG4gIHBhdGg6IERvY3VtZW50W10gPSBbXSxcbikge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocGF0aFtpXSA9PT0gdmFsdWUpIHRocm93IG5ldyBCU09ORXJyb3IoXCJjeWNsaWMgZGVwZW5kZW5jeSBkZXRlY3RlZFwiKTtcbiAgfVxuXG4gIC8vIFB1c2ggdmFsdWUgdG8gc3RhY2tcbiAgcGF0aC5wdXNoKHZhbHVlKTtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyBCU09ORGF0YS5BUlJBWSA6IEJTT05EYXRhLk9CSkVDVDtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICBjb25zdCBlbmRJbmRleCA9IHNlcmlhbGl6ZUludG8oXG4gICAgYnVmZmVyLFxuICAgIHZhbHVlLFxuICAgIGNoZWNrS2V5cyxcbiAgICBpbmRleCxcbiAgICBkZXB0aCArIDEsXG4gICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICBwYXRoLFxuICApO1xuICAvLyBQb3Agc3RhY2tcbiAgcGF0aC5wb3AoKTtcbiAgcmV0dXJuIGVuZEluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVEZWNpbWFsMTI4KFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogRGVjaW1hbDEyOCxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuREVDSU1BTDEyODtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBXcml0ZSB0aGUgZGF0YSBmcm9tIHRoZSB2YWx1ZVxuICAvLyBQcmVmZXIgdGhlIHN0YW5kYXJkIEpTIG1ldGhvZHMgYmVjYXVzZSB0aGVpciB0eXBlY2hlY2tpbmcgaXMgbm90IGJ1Z2d5LFxuICAvLyB1bmxpa2UgdGhlIGBidWZmZXJgIHBvbHlmaWxsJ3MuXG4gIGJ1ZmZlci5zZXQodmFsdWUuYnl0ZXMuc3ViYXJyYXkoMCwgMTYpLCBpbmRleCk7XG4gIHJldHVybiBpbmRleCArIDE2O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVMb25nKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogTG9uZyxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gdmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXBcbiAgICA/IEJTT05EYXRhLlRJTUVTVEFNUFxuICAgIDogQlNPTkRhdGEuTE9ORztcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBXcml0ZSB0aGUgZGF0ZVxuICBjb25zdCBsb3dCaXRzID0gdmFsdWUuZ2V0TG93Qml0cygpO1xuICBjb25zdCBoaWdoQml0cyA9IHZhbHVlLmdldEhpZ2hCaXRzKCk7XG4gIC8vIEVuY29kZSBsb3cgYml0c1xuICBidWZmZXJbaW5kZXgrK10gPSBsb3dCaXRzICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGxvd0JpdHMgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiAyNCkgJiAweGZmO1xuICAvLyBFbmNvZGUgaGlnaCBiaXRzXG4gIGJ1ZmZlcltpbmRleCsrXSA9IGhpZ2hCaXRzICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChoaWdoQml0cyA+PiAyNCkgJiAweGZmO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUludDMyKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogSW50MzIgfCBudW1iZXIsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIHZhbHVlID0gdmFsdWUudmFsdWVPZigpO1xuICAvLyBTZXQgaW50IHR5cGUgMzIgYml0cyBvciBsZXNzXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLklOVDtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBXcml0ZSB0aGUgaW50IHZhbHVlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IHZhbHVlICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9ICh2YWx1ZSA+PiAyNCkgJiAweGZmO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZURvdWJsZShcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IERvdWJsZSxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gRW5jb2RlIGFzIGRvdWJsZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5OVU1CRVI7XG5cbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcblxuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG5cbiAgLy8gV3JpdGUgZmxvYXRcbiAgd3JpdGVJRUVFNzU0KGJ1ZmZlciwgdmFsdWUudmFsdWUsIGluZGV4LCBcImxpdHRsZVwiLCA1MiwgOCk7XG5cbiAgLy8gQWRqdXN0IGluZGV4XG4gIGluZGV4ICs9IDg7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplRnVuY3Rpb24oXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgYmFuLXR5cGVzXG4gIHZhbHVlOiBGdW5jdGlvbixcbiAgaW5kZXg6IG51bWJlcixcbiAgX2NoZWNrS2V5cyA9IGZhbHNlLFxuICBfZGVwdGggPSAwLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5DT0RFO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIC8vIEZ1bmN0aW9uIHN0cmluZ1xuICBjb25zdCBmdW5jdGlvblN0cmluZyA9IG5vcm1hbGl6ZWRGdW5jdGlvblN0cmluZyh2YWx1ZSk7XG5cbiAgLy8gV3JpdGUgdGhlIHN0cmluZ1xuICBjb25zdCBzaXplID0gd3JpdGVUb0J5dGVzKGJ1ZmZlciwgZnVuY3Rpb25TdHJpbmcsIGluZGV4ICsgNCwgRW5jb2RpbmcuVXRmOCkgK1xuICAgIDE7XG4gIC8vIFdyaXRlIHRoZSBzaXplIG9mIHRoZSBzdHJpbmcgdG8gYnVmZmVyXG4gIGJ1ZmZlcltpbmRleF0gPSBzaXplICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgMV0gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCArIDJdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgM10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAvLyBVcGRhdGUgaW5kZXhcbiAgaW5kZXggPSBpbmRleCArIDQgKyBzaXplIC0gMTtcbiAgLy8gV3JpdGUgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUNvZGUoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBDb2RlLFxuICBpbmRleDogbnVtYmVyLFxuICBjaGVja0tleXMgPSBmYWxzZSxcbiAgZGVwdGggPSAwLFxuICBzZXJpYWxpemVGdW5jdGlvbnMgPSBmYWxzZSxcbiAgaWdub3JlVW5kZWZpbmVkID0gdHJ1ZSxcbiAgaXNBcnJheSA9IGZhbHNlLFxuKSB7XG4gIGlmICh2YWx1ZS5zY29wZSAmJiB0eXBlb2YgdmFsdWUuc2NvcGUgPT09IFwib2JqZWN0XCIpIHtcbiAgICAvLyBXcml0ZSB0aGUgdHlwZVxuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkNPREVfV19TQ09QRTtcbiAgICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICAgIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAgIC8vIEVuY29kZSB0aGUgbmFtZVxuICAgIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG5cbiAgICAvLyBTdGFydGluZyBpbmRleFxuICAgIGxldCBzdGFydEluZGV4ID0gaW5kZXg7XG5cbiAgICAvLyBTZXJpYWxpemUgdGhlIGZ1bmN0aW9uXG4gICAgLy8gR2V0IHRoZSBmdW5jdGlvbiBzdHJpbmdcbiAgICBjb25zdCBmdW5jdGlvblN0cmluZyA9IHR5cGVvZiB2YWx1ZS5jb2RlID09PSBcInN0cmluZ1wiXG4gICAgICA/IHZhbHVlLmNvZGVcbiAgICAgIDogdmFsdWUuY29kZS50b1N0cmluZygpO1xuICAgIC8vIEluZGV4IGFkanVzdG1lbnRcbiAgICBpbmRleCArPSA0O1xuICAgIC8vIFdyaXRlIHN0cmluZyBpbnRvIGJ1ZmZlclxuICAgIGNvbnN0IGNvZGVTaXplID1cbiAgICAgIHdyaXRlVG9CeXRlcyhidWZmZXIsIGZ1bmN0aW9uU3RyaW5nLCBpbmRleCArIDQsIEVuY29kaW5nLlV0ZjgpICtcbiAgICAgIDE7XG4gICAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgICBidWZmZXJbaW5kZXhdID0gY29kZVNpemUgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCArIDFdID0gKGNvZGVTaXplID4+IDgpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXggKyAyXSA9IChjb2RlU2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCArIDNdID0gKGNvZGVTaXplID4+IDI0KSAmIDB4ZmY7XG4gICAgLy8gV3JpdGUgZW5kIDBcbiAgICBidWZmZXJbaW5kZXggKyA0ICsgY29kZVNpemUgLSAxXSA9IDA7XG4gICAgLy8gV3JpdGUgdGhlXG4gICAgaW5kZXggPSBpbmRleCArIGNvZGVTaXplICsgNDtcblxuICAgIC8vXG4gICAgLy8gU2VyaWFsaXplIHRoZSBzY29wZSB2YWx1ZVxuICAgIGNvbnN0IGVuZEluZGV4ID0gc2VyaWFsaXplSW50byhcbiAgICAgIGJ1ZmZlcixcbiAgICAgIHZhbHVlLnNjb3BlLFxuICAgICAgY2hlY2tLZXlzLFxuICAgICAgaW5kZXgsXG4gICAgICBkZXB0aCArIDEsXG4gICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgKTtcbiAgICBpbmRleCA9IGVuZEluZGV4IC0gMTtcblxuICAgIC8vIFdyaXQgdGhlIHRvdGFsXG4gICAgY29uc3QgdG90YWxTaXplID0gZW5kSW5kZXggLSBzdGFydEluZGV4O1xuXG4gICAgLy8gV3JpdGUgdGhlIHRvdGFsIHNpemUgb2YgdGhlIG9iamVjdFxuICAgIGJ1ZmZlcltzdGFydEluZGV4KytdID0gdG90YWxTaXplICYgMHhmZjtcbiAgICBidWZmZXJbc3RhcnRJbmRleCsrXSA9ICh0b3RhbFNpemUgPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltzdGFydEluZGV4KytdID0gKHRvdGFsU2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltzdGFydEluZGV4KytdID0gKHRvdGFsU2l6ZSA+PiAyNCkgJiAweGZmO1xuICB9IGVsc2Uge1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkNPREU7XG4gICAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAgIC8vIEZ1bmN0aW9uIHN0cmluZ1xuICAgIGNvbnN0IGZ1bmN0aW9uU3RyaW5nID0gdmFsdWUuY29kZS50b1N0cmluZygpO1xuICAgIC8vIFdyaXRlIHRoZSBzdHJpbmdcbiAgICBjb25zdCBzaXplID1cbiAgICAgIHdyaXRlVG9CeXRlcyhidWZmZXIsIGZ1bmN0aW9uU3RyaW5nLCBpbmRleCArIDQsIEVuY29kaW5nLlV0ZjgpICsgMTtcbiAgICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgc3RyaW5nIHRvIGJ1ZmZlclxuICAgIGJ1ZmZlcltpbmRleF0gPSBzaXplICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXggKyAxXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXggKyAyXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4ICsgM10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAgIC8vIFVwZGF0ZSBpbmRleFxuICAgIGluZGV4ID0gaW5kZXggKyA0ICsgc2l6ZSAtIDE7XG4gIH1cbiAgLy8gV3JpdGUgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuXG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplQmluYXJ5KFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogQmluYXJ5LFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5CSU5BUlk7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgLy8gRXh0cmFjdCB0aGUgYnVmZmVyXG4gIGNvbnN0IGRhdGEgPSB2YWx1ZS5idWZmZXI7XG4gIC8vIENhbGN1bGF0ZSBzaXplXG4gIGxldCBzaXplID0gdmFsdWUuYnVmZmVyLmxlbmd0aDtcbiAgLy8gQWRkIHRoZSBkZXByZWNhdGVkIDAyIHR5cGUgNCBieXRlcyBvZiBzaXplIHRvIHRvdGFsXG4gIGlmICh2YWx1ZS5zdWJUeXBlID09PSBCaW5hcnlTaXplcy5TVUJUWVBFX0JZVEVfQVJSQVkpIHNpemUgKz0gNDtcbiAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgYnVmZmVyW2luZGV4KytdID0gc2l6ZSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgLy8gV3JpdGUgdGhlIHN1YnR5cGUgdG8gdGhlIGJ1ZmZlclxuICBidWZmZXJbaW5kZXgrK10gPSB2YWx1ZS5zdWJUeXBlO1xuXG4gIC8vIElmIHdlIGhhdmUgYmluYXJ5IHR5cGUgMiB0aGUgNCBmaXJzdCBieXRlcyBhcmUgdGhlIHNpemVcbiAgaWYgKHZhbHVlLnN1YlR5cGUgPT09IEJpbmFyeVNpemVzLlNVQlRZUEVfQllURV9BUlJBWSkge1xuICAgIHNpemUgLT0gNDtcbiAgICBidWZmZXJbaW5kZXgrK10gPSBzaXplICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICB9XG5cbiAgLy8gV3JpdGUgdGhlIGRhdGEgdG8gdGhlIG9iamVjdFxuICBidWZmZXIuc2V0KGRhdGEsIGluZGV4KTtcbiAgLy8gQWRqdXN0IHRoZSBpbmRleFxuICBpbmRleCArPSBzaXplO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZVN5bWJvbChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IEJTT05TeW1ib2wsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLlNZTUJPTDtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBXcml0ZSB0aGUgc3RyaW5nXG4gIGNvbnN0IHNpemUgPSB3cml0ZVRvQnl0ZXMoYnVmZmVyLCB2YWx1ZS52YWx1ZSwgaW5kZXggKyA0LCBFbmNvZGluZy5VdGY4KSArIDE7XG4gIC8vIFdyaXRlIHRoZSBzaXplIG9mIHRoZSBzdHJpbmcgdG8gYnVmZmVyXG4gIGJ1ZmZlcltpbmRleF0gPSBzaXplICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgMV0gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCArIDJdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgM10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAvLyBVcGRhdGUgaW5kZXhcbiAgaW5kZXggPSBpbmRleCArIDQgKyBzaXplIC0gMTtcbiAgLy8gV3JpdGUgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAweDAwO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZURCUmVmKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogREJSZWYsXG4gIGluZGV4OiBudW1iZXIsXG4gIGRlcHRoOiBudW1iZXIsXG4gIHNlcmlhbGl6ZUZ1bmN0aW9uczogYm9vbGVhbixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuT0JKRUNUO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuXG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICBsZXQgc3RhcnRJbmRleCA9IGluZGV4O1xuICBsZXQgb3V0cHV0OiBEQlJlZkxpa2UgPSB7XG4gICAgJHJlZjogdmFsdWUuY29sbGVjdGlvbixcbiAgICAkaWQ6IHZhbHVlLm9pZCxcbiAgfTtcblxuICBpZiAodmFsdWUuZGIgIT0gbnVsbCkge1xuICAgIG91dHB1dC4kZGIgPSB2YWx1ZS5kYjtcbiAgfVxuXG4gIG91dHB1dCA9IE9iamVjdC5hc3NpZ24ob3V0cHV0LCB2YWx1ZS5maWVsZHMpO1xuICBjb25zdCBlbmRJbmRleCA9IHNlcmlhbGl6ZUludG8oXG4gICAgYnVmZmVyLFxuICAgIG91dHB1dCxcbiAgICBmYWxzZSxcbiAgICBpbmRleCxcbiAgICBkZXB0aCArIDEsXG4gICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICApO1xuXG4gIC8vIENhbGN1bGF0ZSBvYmplY3Qgc2l6ZVxuICBjb25zdCBzaXplID0gZW5kSW5kZXggLSBzdGFydEluZGV4O1xuICAvLyBXcml0ZSB0aGUgc2l6ZVxuICBidWZmZXJbc3RhcnRJbmRleCsrXSA9IHNpemUgJiAweGZmO1xuICBidWZmZXJbc3RhcnRJbmRleCsrXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW3N0YXJ0SW5kZXgrK10gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbc3RhcnRJbmRleCsrXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gIC8vIFNldCBpbmRleFxuICByZXR1cm4gZW5kSW5kZXg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVJbnRvKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIG9iamVjdDogRG9jdW1lbnQsXG4gIGNoZWNrS2V5cyA9IGZhbHNlLFxuICBzdGFydGluZ0luZGV4ID0gMCxcbiAgZGVwdGggPSAwLFxuICBzZXJpYWxpemVGdW5jdGlvbnMgPSBmYWxzZSxcbiAgaWdub3JlVW5kZWZpbmVkID0gdHJ1ZSxcbiAgcGF0aDogRG9jdW1lbnRbXSA9IFtdLFxuKTogbnVtYmVyIHtcbiAgc3RhcnRpbmdJbmRleCA9IHN0YXJ0aW5nSW5kZXggfHwgMDtcbiAgcGF0aCA9IHBhdGggfHwgW107XG5cbiAgLy8gUHVzaCB0aGUgb2JqZWN0IHRvIHRoZSBwYXRoXG4gIHBhdGgucHVzaChvYmplY3QpO1xuXG4gIC8vIFN0YXJ0IHBsYWNlIHRvIHNlcmlhbGl6ZSBpbnRvXG4gIGxldCBpbmRleCA9IHN0YXJ0aW5nSW5kZXggKyA0O1xuXG4gIC8vIFNwZWNpYWwgY2FzZSBpc0FycmF5XG4gIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpIHtcbiAgICAvLyBHZXQgb2JqZWN0IGtleXNcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3Qga2V5ID0gaS50b1N0cmluZygpO1xuICAgICAgbGV0IHZhbHVlID0gb2JqZWN0W2ldO1xuXG4gICAgICAvLyBJcyB0aGVyZSBhbiBvdmVycmlkZSB2YWx1ZVxuICAgICAgaWYgKHZhbHVlPy50b0JTT04pIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS50b0JTT04gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFwidG9CU09OIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhbHVlID0gdmFsdWUudG9CU09OKCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVTdHJpbmcoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bWJlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcImJpZ2ludFwiKSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICAgIFwiVW5zdXBwb3J0ZWQgdHlwZSBCaWdJbnQsIHBsZWFzZSB1c2UgRGVjaW1hbDEyOFwiLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplQm9vbGVhbihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRGF0ZShidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bGwoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTnVsbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3RJZCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU9iamVjdElkKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCdWZmZXIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplUmVnRXhwKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERlY2ltYWwxMjgpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEZWNpbWFsMTI4KGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIExvbmcgfHwgdmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVMb25nKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERvdWJsZSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURvdWJsZShidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgJiYgc2VyaWFsaXplRnVuY3Rpb25zKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRnVuY3Rpb24oXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBDb2RlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplQ29kZShcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNoZWNrS2V5cyxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQmluYXJ5KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplQmluYXJ5KGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJTT05TeW1ib2wpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVTeW1ib2woYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgREJSZWYpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEQlJlZihcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJTT05SZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCU09OUmVnRXhwKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludDMyKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplSW50MzIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTWluS2V5IHx8IHZhbHVlIGluc3RhbmNlb2YgTWF4S2V5KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTWluTWF4KGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU9iamVjdChcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNoZWNrS2V5cyxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICAgcGF0aCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKGBVbnJlY29nbml6ZWQgb3IgaW52YWxpZCBCU09OIFR5cGU6ICR7dmFsdWV9YCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKG9iamVjdCBpbnN0YW5jZW9mIE1hcCkge1xuICAgIGNvbnN0IGl0ZXJhdG9yID0gb2JqZWN0LmVudHJpZXMoKTtcbiAgICBsZXQgZG9uZSA9IGZhbHNlO1xuXG4gICAgd2hpbGUgKCFkb25lKSB7XG4gICAgICAvLyBVbnBhY2sgdGhlIG5leHQgZW50cnlcbiAgICAgIGNvbnN0IGVudHJ5ID0gaXRlcmF0b3IubmV4dCgpO1xuICAgICAgZG9uZSA9ICEhZW50cnkuZG9uZTtcbiAgICAgIC8vIEFyZSB3ZSBkb25lLCB0aGVuIHNraXAgYW5kIHRlcm1pbmF0ZVxuICAgICAgaWYgKGRvbmUpIGNvbnRpbnVlO1xuXG4gICAgICAvLyBHZXQgdGhlIGVudHJ5IHZhbHVlc1xuICAgICAgY29uc3Qga2V5ID0gZW50cnkudmFsdWVbMF07XG4gICAgICBjb25zdCB2YWx1ZSA9IGVudHJ5LnZhbHVlWzFdO1xuXG4gICAgICAvLyBDaGVjayB0aGUgdHlwZSBvZiB0aGUgdmFsdWVcbiAgICAgIGNvbnN0IHR5cGUgPSB0eXBlb2YgdmFsdWU7XG5cbiAgICAgIC8vIENoZWNrIHRoZSBrZXkgYW5kIHRocm93IGVycm9yIGlmIGl0J3MgaWxsZWdhbFxuICAgICAgaWYgKHR5cGVvZiBrZXkgPT09IFwic3RyaW5nXCIgJiYgIWlnbm9yZUtleXMuaGFzKGtleSkpIHtcbiAgICAgICAgaWYgKGtleS5tYXRjaChyZWdleHApICE9IG51bGwpIHtcbiAgICAgICAgICAvLyBUaGUgQlNPTiBzcGVjIGRvZXNuJ3QgYWxsb3cga2V5cyB3aXRoIG51bGwgYnl0ZXMgYmVjYXVzZSBrZXlzIGFyZVxuICAgICAgICAgIC8vIG51bGwtdGVybWluYXRlZC5cbiAgICAgICAgICB0aHJvdyBFcnJvcihga2V5ICR7a2V5fSBtdXN0IG5vdCBjb250YWluIG51bGwgYnl0ZXNgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGVja0tleXMpIHtcbiAgICAgICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoXCIkXCIpKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihga2V5ICR7a2V5fSBtdXN0IG5vdCBzdGFydCB3aXRoICckJ2ApO1xuICAgICAgICAgIH0gZWxzZSBpZiAofmtleS5pbmRleE9mKFwiLlwiKSkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoYGtleSAke2tleX0gbXVzdCBub3QgY29udGFpbiAnLidgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVTdHJpbmcoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVOdW1iZXIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKFxuICAgICAgICB0eXBlID09PSBcImJpZ2ludFwiIHx8IHZhbHVlIGluc3RhbmNlb2YgQmlnSW50NjRBcnJheSB8fFxuICAgICAgICB2YWx1ZSBpbnN0YW5jZW9mIEJpZ1VpbnQ2NEFycmF5XG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgXCJVbnN1cHBvcnRlZCB0eXBlIEJpZ0ludCwgcGxlYXNlIHVzZSBEZWNpbWFsMTI4XCIsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplQm9vbGVhbihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRGF0ZShidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHZhbHVlID09PSBudWxsIHx8ICh2YWx1ZSA9PT0gdW5kZWZpbmVkICYmIGlnbm9yZVVuZGVmaW5lZCA9PT0gZmFsc2UpXG4gICAgICApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVOdWxsKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdElkKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplT2JqZWN0SWQoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJ1ZmZlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVSZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgaW5zdGFuY2VvZiBPYmplY3QpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVPYmplY3QoXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICBwYXRoLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIm9iamVjdFwiICYmIHZhbHVlIGluc3RhbmNlb2YgRGVjaW1hbDEyOCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURlY2ltYWwxMjgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTG9uZykge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUxvbmcoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRG91YmxlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRG91YmxlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIENvZGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVDb2RlKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiICYmIHNlcmlhbGl6ZUZ1bmN0aW9ucykge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUZ1bmN0aW9uKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCaW5hcnkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCaW5hcnkoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlN5bWJvbCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN5bWJvbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEQlJlZikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURCUmVmKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJTT05SZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCU09OUmVnRXhwKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludDMyKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplSW50MzIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTWluS2V5IHx8IHZhbHVlIGluc3RhbmNlb2YgTWF4S2V5KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTWluTWF4KGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoYFVucmVjb2duaXplZCBvciBpbnZhbGlkIEJTT04gVFlQRTogJHt2YWx1ZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gRGlkIHdlIHByb3ZpZGUgYSBjdXN0b20gc2VyaWFsaXphdGlvbiBtZXRob2RcbiAgICBpZiAob2JqZWN0LnRvQlNPTikge1xuICAgICAgaWYgKHR5cGVvZiBvYmplY3QudG9CU09OICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXCJ0b0JTT04gaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgICB9XG4gICAgICBvYmplY3QgPSBvYmplY3QudG9CU09OKCk7XG4gICAgICBpZiAob2JqZWN0ICE9IG51bGwgJiYgdHlwZW9mIG9iamVjdCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcInRvQlNPTiBmdW5jdGlvbiBkaWQgbm90IHJldHVybiBhbiBvYmplY3RcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFsbCB0aGUga2V5c1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9iamVjdCkge1xuICAgICAgbGV0IHZhbHVlID0gb2JqZWN0W2tleV07XG4gICAgICAvLyBJcyB0aGVyZSBhbiBvdmVycmlkZSB2YWx1ZVxuICAgICAgaWYgKHZhbHVlPy50b0JTT04pIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS50b0JTT04gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFwidG9CU09OIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhbHVlID0gdmFsdWUudG9CU09OKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIHRoZSB0eXBlIG9mIHRoZSB2YWx1ZVxuICAgICAgY29uc3QgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcblxuICAgICAgLy8gQ2hlY2sgdGhlIGtleSBhbmQgdGhyb3cgZXJyb3IgaWYgaXQncyBpbGxlZ2FsXG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gXCJzdHJpbmdcIiAmJiAhaWdub3JlS2V5cy5oYXMoa2V5KSkge1xuICAgICAgICBpZiAoa2V5Lm1hdGNoKHJlZ2V4cCkgIT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRoZSBCU09OIHNwZWMgZG9lc24ndCBhbGxvdyBrZXlzIHdpdGggbnVsbCBieXRlcyBiZWNhdXNlIGtleXMgYXJlXG4gICAgICAgICAgLy8gbnVsbC10ZXJtaW5hdGVkLlxuICAgICAgICAgIHRocm93IEVycm9yKGBrZXkgJHtrZXl9IG11c3Qgbm90IGNvbnRhaW4gbnVsbCBieXRlc2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoZWNrS2V5cykge1xuICAgICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aChcIiRcIikpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKGBrZXkgJHtrZXl9IG11c3Qgbm90IHN0YXJ0IHdpdGggJyQnYCk7XG4gICAgICAgICAgfSBlbHNlIGlmICh+a2V5LmluZGV4T2YoXCIuXCIpKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihga2V5ICR7a2V5fSBtdXN0IG5vdCBjb250YWluICcuJ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN0cmluZyhidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bWJlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJiaWdpbnRcIikge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgICAgICBcIlVuc3VwcG9ydGVkIHR5cGUgQmlnSW50LCBwbGVhc2UgdXNlIERlY2ltYWwxMjhcIixcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCb29sZWFuKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEYXRlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChpZ25vcmVVbmRlZmluZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgaW5kZXggPSBzZXJpYWxpemVOdWxsKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTnVsbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBPYmplY3RJZCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU9iamVjdElkKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCdWZmZXIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplUmVnRXhwKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIm9iamVjdFwiICYmIHZhbHVlIGluc3RhbmNlb2YgRGVjaW1hbDEyOCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURlY2ltYWwxMjgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTG9uZyB8fCB2YWx1ZSBpbnN0YW5jZW9mIFRpbWVzdGFtcCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUxvbmcoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRG91YmxlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRG91YmxlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIENvZGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVDb2RlKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiICYmIHNlcmlhbGl6ZUZ1bmN0aW9ucykge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUZ1bmN0aW9uKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCaW5hcnkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCaW5hcnkoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlN5bWJvbCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN5bWJvbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEQlJlZikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURCUmVmKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJTT05SZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCU09OUmVnRXhwKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEludDMyKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplSW50MzIoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTWluS2V5IHx8IHZhbHVlIGluc3RhbmNlb2YgTWF4S2V5KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTWluTWF4KGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU9iamVjdChcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNoZWNrS2V5cyxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihgVW5yZWNvZ25pemVkIG9yIGludmFsaWQgQlNPTiBUeXBlOiAke3ZhbHVlfWApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIFJlbW92ZSB0aGUgcGF0aFxuICBwYXRoLnBvcCgpO1xuXG4gIC8vIEZpbmFsIHBhZGRpbmcgYnl0ZSBmb3Igb2JqZWN0XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDB4MDA7XG5cbiAgLy8gRmluYWwgc2l6ZVxuICBjb25zdCBzaXplID0gaW5kZXggLSBzdGFydGluZ0luZGV4O1xuICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgb2JqZWN0XG4gIGJ1ZmZlcltzdGFydGluZ0luZGV4KytdID0gc2l6ZSAmIDB4ZmY7XG4gIGJ1ZmZlcltzdGFydGluZ0luZGV4KytdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbc3RhcnRpbmdJbmRleCsrXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltzdGFydGluZ0luZGV4KytdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgcmV0dXJuIGluZGV4O1xufVxuIl19