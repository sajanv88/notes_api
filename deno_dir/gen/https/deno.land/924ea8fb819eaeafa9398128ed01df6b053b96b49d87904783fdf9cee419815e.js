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
    if (buffer.length < index) {
        throw new Error("Document exceeds max BSON size");
    }
    buffer[index++] = 0x00;
    const size = index - startingIndex;
    buffer[startingIndex++] = size & 0xff;
    buffer[startingIndex++] = (size >> 8) & 0xff;
    buffer[startingIndex++] = (size >> 16) & 0xff;
    buffer[startingIndex++] = (size >> 24) & 0xff;
    return index;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VyaWFsaXplci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlcmlhbGl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNsQyxPQUFPLEVBQ0wsMkJBQTJCLEVBQzNCLGNBQWMsRUFDZCxjQUFjLEVBQ2QsUUFBUSxHQUNULE1BQU0saUJBQWlCLENBQUM7QUFDekIsT0FBTyxFQUFFLEtBQUssRUFBYSxNQUFNLGNBQWMsQ0FBQztBQUNoRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDOUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN0QyxPQUFPLEVBQUUsU0FBUyxFQUFFLGFBQWEsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN2RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDbEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUNyQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQzNDLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDNUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMxQyxPQUFPLEVBQUUsUUFBUSxFQUFFLHdCQUF3QixFQUFFLFlBQVksRUFBRSxNQUFNLFlBQVksQ0FBQztBQUM5RSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQVksTUFBTSxZQUFZLENBQUM7QUFjdkUsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3RCLE1BQU0sVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxF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QUFJLEdBQUcsS0FBSyxHQUFHLGFBQWEsQ0FBQztJQUVuQyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ3RDLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztJQUM3QyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDOUMsTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO0lBQzlDLE9BQU8sS0FBSyxDQUFDO0FBQ2YsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvZGUgfSBmcm9tIFwiLi4vY29kZS50c1wiO1xuaW1wb3J0IHtcbiAgQlNPTl9CSU5BUllfU1VCVFlQRV9ERUZBVUxULFxuICBCU09OX0lOVDMyX01BWCxcbiAgQlNPTl9JTlQzMl9NSU4sXG4gIEJTT05EYXRhLFxufSBmcm9tIFwiLi4vY29uc3RhbnRzLnRzXCI7XG5pbXBvcnQgeyBEQlJlZiwgREJSZWZMaWtlIH0gZnJvbSBcIi4uL2RiX3JlZi50c1wiO1xuaW1wb3J0IHsgRGVjaW1hbDEyOCB9IGZyb20gXCIuLi9kZWNpbWFsMTI4LnRzXCI7XG5pbXBvcnQgeyBEb3VibGUgfSBmcm9tIFwiLi4vZG91YmxlLnRzXCI7XG5pbXBvcnQgeyBCU09ORXJyb3IsIEJTT05UeXBlRXJyb3IgfSBmcm9tIFwiLi4vZXJyb3IudHNcIjtcbmltcG9ydCB7IHdyaXRlSUVFRTc1NCB9IGZyb20gXCIuLi9mbG9hdF9wYXJzZXIudHNcIjtcbmltcG9ydCB7IEludDMyIH0gZnJvbSBcIi4uL2ludF8zMi50c1wiO1xuaW1wb3J0IHsgTG9uZyB9IGZyb20gXCIuLi9sb25nLnRzXCI7XG5pbXBvcnQgeyBNYXhLZXksIE1pbktleSB9IGZyb20gXCIuLi9rZXkudHNcIjtcbmltcG9ydCB7IE9iamVjdElkIH0gZnJvbSBcIi4uL29iamVjdGlkLnRzXCI7XG5pbXBvcnQgeyBUaW1lc3RhbXAgfSBmcm9tIFwiLi4vdGltZXN0YW1wLnRzXCI7XG5pbXBvcnQgeyBCU09OUmVnRXhwIH0gZnJvbSBcIi4uL3JlZ2V4cC50c1wiO1xuaW1wb3J0IHsgRW5jb2RpbmcsIG5vcm1hbGl6ZWRGdW5jdGlvblN0cmluZywgd3JpdGVUb0J5dGVzIH0gZnJvbSBcIi4vdXRpbHMudHNcIjtcbmltcG9ydCB7IEJpbmFyeSwgQmluYXJ5U2l6ZXMsIEJTT05TeW1ib2wsIERvY3VtZW50IH0gZnJvbSBcIi4uL2Jzb24udHNcIjtcbi8qKiBAcHVibGljICovXG5leHBvcnQgaW50ZXJmYWNlIFNlcmlhbGl6ZU9wdGlvbnMge1xuICAvKiogdGhlIHNlcmlhbGl6ZXIgd2lsbCBjaGVjayBpZiBrZXlzIGFyZSB2YWxpZC4gKi9cbiAgY2hlY2tLZXlzPzogYm9vbGVhbjtcbiAgLyoqIHNlcmlhbGl6ZSB0aGUgamF2YXNjcmlwdCBmdW5jdGlvbnMgKiooZGVmYXVsdDpmYWxzZSkqKi4gKi9cbiAgc2VyaWFsaXplRnVuY3Rpb25zPzogYm9vbGVhbjtcbiAgLyoqIHNlcmlhbGl6ZSB3aWxsIG5vdCBlbWl0IHVuZGVmaW5lZCBmaWVsZHMgKiooZGVmYXVsdDp0cnVlKSoqICovXG4gIGlnbm9yZVVuZGVmaW5lZD86IGJvb2xlYW47XG4gIC8qKiB0aGUgaW5kZXggaW4gdGhlIGJ1ZmZlciB3aGVyZSB3ZSB3aXNoIHRvIHN0YXJ0IHNlcmlhbGl6aW5nIGludG8gKi9cbiAgaW5kZXg/OiBudW1iZXI7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tY29udHJvbC1yZWdleFxuY29uc3QgcmVnZXhwID0gL1xceDAwLztcbmNvbnN0IGlnbm9yZUtleXMgPSBuZXcgU2V0KFtcIiRkYlwiLCBcIiRyZWZcIiwgXCIkaWRcIiwgXCIkY2x1c3RlclRpbWVcIl0pO1xuXG4vKlxuICogaXNBcnJheSBpbmRpY2F0ZXMgaWYgd2UgYXJlIHdyaXRpbmcgdG8gYSBCU09OIGFycmF5ICh0eXBlIDB4MDQpXG4gKiB3aGljaCBmb3JjZXMgdGhlIFwia2V5XCIgd2hpY2ggcmVhbGx5IGFuIGFycmF5IGluZGV4IGFzIGEgc3RyaW5nIHRvIGJlIHdyaXR0ZW4gYXMgYXNjaWlcbiAqIFRoaXMgd2lsbCBjYXRjaCBhbnkgZXJyb3JzIGluIGluZGV4IGFzIGEgc3RyaW5nIGdlbmVyYXRpb25cbiAqL1xuXG5mdW5jdGlvbiBzZXJpYWxpemVTdHJpbmcoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBzdHJpbmcsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIEVuY29kZSBTdHJpbmcgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5TVFJJTkc7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCA9IGluZGV4ICsgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgKyAxO1xuICBidWZmZXJbaW5kZXggLSAxXSA9IDA7XG4gIC8vIFdyaXRlIHRoZSBzdHJpbmdcbiAgY29uc3Qgc2l6ZSA9IHdyaXRlVG9CeXRlcyhidWZmZXIsIHZhbHVlLCBpbmRleCArIDQsIEVuY29kaW5nLlV0ZjgpO1xuICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgc3RyaW5nIHRvIGJ1ZmZlclxuICBidWZmZXJbaW5kZXggKyAzXSA9ICgoc2l6ZSArIDEpID4+IDI0KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCArIDJdID0gKChzaXplICsgMSkgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgMV0gPSAoKHNpemUgKyAxKSA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleF0gPSAoc2l6ZSArIDEpICYgMHhmZjtcbiAgLy8gVXBkYXRlIGluZGV4XG4gIGluZGV4ID0gaW5kZXggKyA0ICsgc2l6ZTtcbiAgLy8gV3JpdGUgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZU51bWJlcihcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IG51bWJlcixcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV2UgaGF2ZSBhbiBpbnRlZ2VyIHZhbHVlXG4gIC8vIFRPRE8oTk9ERS0yNTI5KTogQWRkIHN1cHBvcnQgZm9yIGJpZyBpbnRcbiAgaWYgKFxuICAgIE51bWJlci5pc0ludGVnZXIodmFsdWUpICYmXG4gICAgdmFsdWUgPj0gQlNPTl9JTlQzMl9NSU4gJiZcbiAgICB2YWx1ZSA8PSBCU09OX0lOVDMyX01BWFxuICApIHtcbiAgICAvLyBJZiB0aGUgdmFsdWUgZml0cyBpbiAzMiBiaXRzIGVuY29kZSBhcyBpbnQzMlxuICAgIC8vIFNldCBpbnQgdHlwZSAzMiBiaXRzIG9yIGxlc3NcbiAgICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5JTlQ7XG4gICAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAgIC8vIFdyaXRlIHRoZSBpbnQgdmFsdWVcbiAgICBidWZmZXJbaW5kZXgrK10gPSB2YWx1ZSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDgpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAodmFsdWUgPj4gMTYpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAodmFsdWUgPj4gMjQpICYgMHhmZjtcbiAgfSBlbHNlIHtcbiAgICAvLyBFbmNvZGUgYXMgZG91YmxlXG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuTlVNQkVSO1xuICAgIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gICAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gICAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gICAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gICAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgICAvLyBXcml0ZSBmbG9hdFxuICAgIHdyaXRlSUVFRTc1NChidWZmZXIsIHZhbHVlLCBpbmRleCwgXCJsaXR0bGVcIiwgNTIsIDgpO1xuICAgIC8vIEFkanVzdCBpbmRleFxuICAgIGluZGV4ICs9IDg7XG4gIH1cblxuICByZXR1cm4gaW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZU51bGwoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIF86IHVua25vd24sXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFNldCBsb25nIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuTlVMTDtcblxuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuXG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVCb29sZWFuKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogYm9vbGVhbixcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuQk9PTEVBTjtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBFbmNvZGUgdGhlIGJvb2xlYW4gdmFsdWVcbiAgYnVmZmVyW2luZGV4KytdID0gdmFsdWUgPyAxIDogMDtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVEYXRlKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogRGF0ZSxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuREFURTtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuXG4gIC8vIFdyaXRlIHRoZSBkYXRlXG4gIGNvbnN0IGRhdGVJbk1pbGlzID0gTG9uZy5mcm9tTnVtYmVyKHZhbHVlLmdldFRpbWUoKSk7XG4gIGNvbnN0IGxvd0JpdHMgPSBkYXRlSW5NaWxpcy5nZXRMb3dCaXRzKCk7XG4gIGNvbnN0IGhpZ2hCaXRzID0gZGF0ZUluTWlsaXMuZ2V0SGlnaEJpdHMoKTtcbiAgLy8gRW5jb2RlIGxvdyBiaXRzXG4gIGJ1ZmZlcltpbmRleCsrXSA9IGxvd0JpdHMgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChsb3dCaXRzID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChsb3dCaXRzID4+IDI0KSAmIDB4ZmY7XG4gIC8vIEVuY29kZSBoaWdoIGJpdHNcbiAgYnVmZmVyW2luZGV4KytdID0gaGlnaEJpdHMgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoaGlnaEJpdHMgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoaGlnaEJpdHMgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDI0KSAmIDB4ZmY7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplUmVnRXhwKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogUmVnRXhwLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5SRUdFWFA7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG5cbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICBpZiAodmFsdWUuc291cmNlICYmIHZhbHVlLnNvdXJjZS5tYXRjaChyZWdleHApICE9IG51bGwpIHtcbiAgICB0aHJvdyBFcnJvcihgdmFsdWUgJHt2YWx1ZS5zb3VyY2V9IG11c3Qgbm90IGNvbnRhaW4gbnVsbCBieXRlc2ApO1xuICB9XG4gIC8vIEFkanVzdCB0aGUgaW5kZXhcbiAgaW5kZXggKz0gd3JpdGVUb0J5dGVzKGJ1ZmZlciwgdmFsdWUuc291cmNlLCBpbmRleCwgRW5jb2RpbmcuVXRmOCk7XG4gIC8vIFdyaXRlIHplcm9cbiAgYnVmZmVyW2luZGV4KytdID0gMHgwMDtcbiAgLy8gV3JpdGUgdGhlIHBhcmFtZXRlcnNcbiAgaWYgKHZhbHVlLmlnbm9yZUNhc2UpIGJ1ZmZlcltpbmRleCsrXSA9IDB4Njk7IC8vIGlcbiAgaWYgKHZhbHVlLmdsb2JhbCkgYnVmZmVyW2luZGV4KytdID0gMHg3MzsgLy8gc1xuICBpZiAodmFsdWUubXVsdGlsaW5lKSBidWZmZXJbaW5kZXgrK10gPSAweDZkOyAvLyBtXG5cbiAgLy8gQWRkIGVuZGluZyB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDB4MDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplQlNPTlJlZ0V4cChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IEJTT05SZWdFeHAsXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLlJFR0VYUDtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuXG4gIC8vIENoZWNrIHRoZSBwYXR0ZXJuIGZvciAwIGJ5dGVzXG4gIGlmICh2YWx1ZS5wYXR0ZXJuLm1hdGNoKHJlZ2V4cCkgIT0gbnVsbCkge1xuICAgIC8vIFRoZSBCU09OIHNwZWMgZG9lc24ndCBhbGxvdyBrZXlzIHdpdGggbnVsbCBieXRlcyBiZWNhdXNlIGtleXMgYXJlXG4gICAgLy8gbnVsbC10ZXJtaW5hdGVkLlxuICAgIHRocm93IEVycm9yKGBwYXR0ZXJuICR7dmFsdWUucGF0dGVybn0gbXVzdCBub3QgY29udGFpbiBudWxsIGJ5dGVzYCk7XG4gIH1cblxuICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gIGluZGV4ICs9IHdyaXRlVG9CeXRlcyhidWZmZXIsIHZhbHVlLnBhdHRlcm4sIGluZGV4LCBFbmNvZGluZy5VdGY4KTtcbiAgLy8gV3JpdGUgemVyb1xuICBidWZmZXJbaW5kZXgrK10gPSAweDAwO1xuICAvLyBXcml0ZSB0aGUgb3B0aW9uc1xuICBpbmRleCArPSB3cml0ZVRvQnl0ZXMoXG4gICAgYnVmZmVyLFxuICAgIHZhbHVlLm9wdGlvbnMuc3BsaXQoXCJcIikuc29ydCgpLmpvaW4oXCJcIiksXG4gICAgaW5kZXgsXG4gICAgRW5jb2RpbmcuVXRmOCxcbiAgKTtcbiAgLy8gQWRkIGVuZGluZyB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDB4MDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplTWluTWF4KFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogTWluS2V5IHwgTWF4S2V5LFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZSBvZiBlaXRoZXIgbWluIG9yIG1heCBrZXlcbiAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuTlVMTDtcbiAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE1pbktleSkge1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk1JTl9LRVk7XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuTUFYX0tFWTtcbiAgfVxuXG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVPYmplY3RJZChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IE9iamVjdElkLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5PSUQ7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG5cbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuXG4gIC8vIFdyaXRlIHRoZSBvYmplY3RJZCBpbnRvIHRoZSBzaGFyZWQgYnVmZmVyXG4gIGlmICh0eXBlb2YgdmFsdWUuaWQgPT09IFwic3RyaW5nXCIpIHtcbiAgICB3cml0ZVRvQnl0ZXMoYnVmZmVyLCB2YWx1ZS5pZCwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgfSBlbHNlIGlmICh2YWx1ZS5pZCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAvLyBVc2UgdGhlIHN0YW5kYXJkIEpTIG1ldGhvZHMgaGVyZSBiZWNhdXNlIGJ1ZmZlci5jb3B5KCkgaXMgYnVnZ3kgd2l0aCB0aGVcbiAgICAvLyBicm93c2VyIHBvbHlmaWxsXG4gICAgYnVmZmVyLnNldCh2YWx1ZS5pZC5zdWJhcnJheSgwLCAxMiksIGluZGV4KTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgIGBvYmplY3QgWyR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfV0gaXMgbm90IGEgdmFsaWQgT2JqZWN0SWRgLFxuICAgICk7XG4gIH1cblxuICAvLyBBZGp1c3QgaW5kZXhcbiAgcmV0dXJuIGluZGV4ICsgMTI7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUJ1ZmZlcihcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IFVpbnQ4QXJyYXksXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkJJTkFSWTtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBHZXQgc2l6ZSBvZiB0aGUgYnVmZmVyIChjdXJyZW50IHdyaXRlIHBvaW50KVxuICBjb25zdCBzaXplID0gdmFsdWUubGVuZ3RoO1xuICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgc3RyaW5nIHRvIGJ1ZmZlclxuICBidWZmZXJbaW5kZXgrK10gPSBzaXplICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAvLyBXcml0ZSB0aGUgZGVmYXVsdCBzdWJ0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05fQklOQVJZX1NVQlRZUEVfREVGQVVMVDtcbiAgLy8gQ29weSB0aGUgY29udGVudCBmb3JtIHRoZSBiaW5hcnkgZmllbGQgdG8gdGhlIGJ1ZmZlclxuICBidWZmZXIuc2V0KHZhbHVlLCBpbmRleCk7XG4gIC8vIEFkanVzdCB0aGUgaW5kZXhcbiAgaW5kZXggKz0gc2l6ZTtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVPYmplY3QoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBEb2N1bWVudCxcbiAgaW5kZXg6IG51bWJlcixcbiAgY2hlY2tLZXlzID0gZmFsc2UsXG4gIGRlcHRoID0gMCxcbiAgc2VyaWFsaXplRnVuY3Rpb25zID0gZmFsc2UsXG4gIGlnbm9yZVVuZGVmaW5lZCA9IHRydWUsXG4gIGlzQXJyYXkgPSBmYWxzZSxcbiAgcGF0aDogRG9jdW1lbnRbXSA9IFtdLFxuKSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChwYXRoW2ldID09PSB2YWx1ZSkgdGhyb3cgbmV3IEJTT05FcnJvcihcImN5Y2xpYyBkZXBlbmRlbmN5IGRldGVjdGVkXCIpO1xuICB9XG5cbiAgLy8gUHVzaCB2YWx1ZSB0byBzdGFja1xuICBwYXRoLnB1c2godmFsdWUpO1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBBcnJheS5pc0FycmF5KHZhbHVlKSA/IEJTT05EYXRhLkFSUkFZIDogQlNPTkRhdGEuT0JKRUNUO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIGNvbnN0IGVuZEluZGV4ID0gc2VyaWFsaXplSW50byhcbiAgICBidWZmZXIsXG4gICAgdmFsdWUsXG4gICAgY2hlY2tLZXlzLFxuICAgIGluZGV4LFxuICAgIGRlcHRoICsgMSxcbiAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgaWdub3JlVW5kZWZpbmVkLFxuICAgIHBhdGgsXG4gICk7XG4gIC8vIFBvcCBzdGFja1xuICBwYXRoLnBvcCgpO1xuICByZXR1cm4gZW5kSW5kZXg7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZURlY2ltYWwxMjgoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBEZWNpbWFsMTI4LFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5ERUNJTUFMMTI4O1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIC8vIFdyaXRlIHRoZSBkYXRhIGZyb20gdGhlIHZhbHVlXG4gIC8vIFByZWZlciB0aGUgc3RhbmRhcmQgSlMgbWV0aG9kcyBiZWNhdXNlIHRoZWlyIHR5cGVjaGVja2luZyBpcyBub3QgYnVnZ3ksXG4gIC8vIHVubGlrZSB0aGUgYGJ1ZmZlcmAgcG9seWZpbGwncy5cbiAgYnVmZmVyLnNldCh2YWx1ZS5ieXRlcy5zdWJhcnJheSgwLCAxNiksIGluZGV4KTtcbiAgcmV0dXJuIGluZGV4ICsgMTY7XG59XG5cbmZ1bmN0aW9uIHNlcmlhbGl6ZUxvbmcoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBMb25nLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSB2YWx1ZSBpbnN0YW5jZW9mIFRpbWVzdGFtcFxuICAgID8gQlNPTkRhdGEuVElNRVNUQU1QXG4gICAgOiBCU09ORGF0YS5MT05HO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIC8vIFdyaXRlIHRoZSBkYXRlXG4gIGNvbnN0IGxvd0JpdHMgPSB2YWx1ZS5nZXRMb3dCaXRzKCk7XG4gIGNvbnN0IGhpZ2hCaXRzID0gdmFsdWUuZ2V0SGlnaEJpdHMoKTtcbiAgLy8gRW5jb2RlIGxvdyBiaXRzXG4gIGJ1ZmZlcltpbmRleCsrXSA9IGxvd0JpdHMgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAobG93Qml0cyA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChsb3dCaXRzID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IChsb3dCaXRzID4+IDI0KSAmIDB4ZmY7XG4gIC8vIEVuY29kZSBoaWdoIGJpdHNcbiAgYnVmZmVyW2luZGV4KytdID0gaGlnaEJpdHMgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoaGlnaEJpdHMgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoaGlnaEJpdHMgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKGhpZ2hCaXRzID4+IDI0KSAmIDB4ZmY7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplSW50MzIoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBJbnQzMiB8IG51bWJlcixcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgdmFsdWUgPSB2YWx1ZS52YWx1ZU9mKCk7XG4gIC8vIFNldCBpbnQgdHlwZSAzMiBiaXRzIG9yIGxlc3NcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuSU5UO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIC8vIFdyaXRlIHRoZSBpbnQgdmFsdWVcbiAgYnVmZmVyW2luZGV4KytdID0gdmFsdWUgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAodmFsdWUgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAodmFsdWUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHZhbHVlID4+IDI0KSAmIDB4ZmY7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplRG91YmxlKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogRG91YmxlLFxuICBpbmRleDogbnVtYmVyLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBFbmNvZGUgYXMgZG91YmxlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLk5VTUJFUjtcblxuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuXG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICAvLyBXcml0ZSBmbG9hdFxuICB3cml0ZUlFRUU3NTQoYnVmZmVyLCB2YWx1ZS52YWx1ZSwgaW5kZXgsIFwibGl0dGxlXCIsIDUyLCA4KTtcblxuICAvLyBBZGp1c3QgaW5kZXhcbiAgaW5kZXggKz0gODtcbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVGdW5jdGlvbihcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgdmFsdWU6IEZ1bmN0aW9uLFxuICBpbmRleDogbnVtYmVyLFxuICBfY2hlY2tLZXlzID0gZmFsc2UsXG4gIF9kZXB0aCA9IDAsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkNPREU7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gIC8vIEVuY29kZSB0aGUgbmFtZVxuICBpbmRleCArPSBudW1iZXJPZldyaXR0ZW5CeXRlcztcbiAgYnVmZmVyW2luZGV4KytdID0gMDtcbiAgLy8gRnVuY3Rpb24gc3RyaW5nXG4gIGNvbnN0IGZ1bmN0aW9uU3RyaW5nID0gbm9ybWFsaXplZEZ1bmN0aW9uU3RyaW5nKHZhbHVlKTtcblxuICAvLyBXcml0ZSB0aGUgc3RyaW5nXG4gIGNvbnN0IHNpemUgPSB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBmdW5jdGlvblN0cmluZywgaW5kZXggKyA0LCBFbmNvZGluZy5VdGY4KSArXG4gICAgMTtcbiAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgYnVmZmVyW2luZGV4XSA9IHNpemUgJiAweGZmO1xuICBidWZmZXJbaW5kZXggKyAxXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgMl0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXggKyAzXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gIC8vIFVwZGF0ZSBpbmRleFxuICBpbmRleCA9IGluZGV4ICsgNCArIHNpemUgLSAxO1xuICAvLyBXcml0ZSB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplQ29kZShcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBrZXk6IHN0cmluZyxcbiAgdmFsdWU6IENvZGUsXG4gIGluZGV4OiBudW1iZXIsXG4gIGNoZWNrS2V5cyA9IGZhbHNlLFxuICBkZXB0aCA9IDAsXG4gIHNlcmlhbGl6ZUZ1bmN0aW9ucyA9IGZhbHNlLFxuICBpZ25vcmVVbmRlZmluZWQgPSB0cnVlLFxuICBpc0FycmF5ID0gZmFsc2UsXG4pIHtcbiAgaWYgKHZhbHVlLnNjb3BlICYmIHR5cGVvZiB2YWx1ZS5zY29wZSA9PT0gXCJvYmplY3RcIikge1xuICAgIC8vIFdyaXRlIHRoZSB0eXBlXG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuQ09ERV9XX1NDT1BFO1xuICAgIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gICAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG4gICAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gICAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gICAgYnVmZmVyW2luZGV4KytdID0gMDtcblxuICAgIC8vIFN0YXJ0aW5nIGluZGV4XG4gICAgbGV0IHN0YXJ0SW5kZXggPSBpbmRleDtcblxuICAgIC8vIFNlcmlhbGl6ZSB0aGUgZnVuY3Rpb25cbiAgICAvLyBHZXQgdGhlIGZ1bmN0aW9uIHN0cmluZ1xuICAgIGNvbnN0IGZ1bmN0aW9uU3RyaW5nID0gdHlwZW9mIHZhbHVlLmNvZGUgPT09IFwic3RyaW5nXCJcbiAgICAgID8gdmFsdWUuY29kZVxuICAgICAgOiB2YWx1ZS5jb2RlLnRvU3RyaW5nKCk7XG4gICAgLy8gSW5kZXggYWRqdXN0bWVudFxuICAgIGluZGV4ICs9IDQ7XG4gICAgLy8gV3JpdGUgc3RyaW5nIGludG8gYnVmZmVyXG4gICAgY29uc3QgY29kZVNpemUgPVxuICAgICAgd3JpdGVUb0J5dGVzKGJ1ZmZlciwgZnVuY3Rpb25TdHJpbmcsIGluZGV4ICsgNCwgRW5jb2RpbmcuVXRmOCkgK1xuICAgICAgMTtcbiAgICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgc3RyaW5nIHRvIGJ1ZmZlclxuICAgIGJ1ZmZlcltpbmRleF0gPSBjb2RlU2l6ZSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4ICsgMV0gPSAoY29kZVNpemUgPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCArIDJdID0gKGNvZGVTaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4ICsgM10gPSAoY29kZVNpemUgPj4gMjQpICYgMHhmZjtcbiAgICAvLyBXcml0ZSBlbmQgMFxuICAgIGJ1ZmZlcltpbmRleCArIDQgKyBjb2RlU2l6ZSAtIDFdID0gMDtcbiAgICAvLyBXcml0ZSB0aGVcbiAgICBpbmRleCA9IGluZGV4ICsgY29kZVNpemUgKyA0O1xuXG4gICAgLy9cbiAgICAvLyBTZXJpYWxpemUgdGhlIHNjb3BlIHZhbHVlXG4gICAgY29uc3QgZW5kSW5kZXggPSBzZXJpYWxpemVJbnRvKFxuICAgICAgYnVmZmVyLFxuICAgICAgdmFsdWUuc2NvcGUsXG4gICAgICBjaGVja0tleXMsXG4gICAgICBpbmRleCxcbiAgICAgIGRlcHRoICsgMSxcbiAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICApO1xuICAgIGluZGV4ID0gZW5kSW5kZXggLSAxO1xuXG4gICAgLy8gV3JpdCB0aGUgdG90YWxcbiAgICBjb25zdCB0b3RhbFNpemUgPSBlbmRJbmRleCAtIHN0YXJ0SW5kZXg7XG5cbiAgICAvLyBXcml0ZSB0aGUgdG90YWwgc2l6ZSBvZiB0aGUgb2JqZWN0XG4gICAgYnVmZmVyW3N0YXJ0SW5kZXgrK10gPSB0b3RhbFNpemUgJiAweGZmO1xuICAgIGJ1ZmZlcltzdGFydEluZGV4KytdID0gKHRvdGFsU2l6ZSA+PiA4KSAmIDB4ZmY7XG4gICAgYnVmZmVyW3N0YXJ0SW5kZXgrK10gPSAodG90YWxTaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW3N0YXJ0SW5kZXgrK10gPSAodG90YWxTaXplID4+IDI0KSAmIDB4ZmY7XG4gIH0gZWxzZSB7XG4gICAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuQ09ERTtcbiAgICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICAgIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAgIC8vIEVuY29kZSB0aGUgbmFtZVxuICAgIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gICAgLy8gRnVuY3Rpb24gc3RyaW5nXG4gICAgY29uc3QgZnVuY3Rpb25TdHJpbmcgPSB2YWx1ZS5jb2RlLnRvU3RyaW5nKCk7XG4gICAgLy8gV3JpdGUgdGhlIHN0cmluZ1xuICAgIGNvbnN0IHNpemUgPVxuICAgICAgd3JpdGVUb0J5dGVzKGJ1ZmZlciwgZnVuY3Rpb25TdHJpbmcsIGluZGV4ICsgNCwgRW5jb2RpbmcuVXRmOCkgKyAxO1xuICAgIC8vIFdyaXRlIHRoZSBzaXplIG9mIHRoZSBzdHJpbmcgdG8gYnVmZmVyXG4gICAgYnVmZmVyW2luZGV4XSA9IHNpemUgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCArIDFdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCArIDJdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXggKyAzXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gICAgLy8gVXBkYXRlIGluZGV4XG4gICAgaW5kZXggPSBpbmRleCArIDQgKyBzaXplIC0gMTtcbiAgfVxuICAvLyBXcml0ZSB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG5cbiAgcmV0dXJuIGluZGV4O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpemVCaW5hcnkoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBCaW5hcnksXG4gIGluZGV4OiBudW1iZXIsXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKSB7XG4gIC8vIFdyaXRlIHRoZSB0eXBlXG4gIGJ1ZmZlcltpbmRleCsrXSA9IEJTT05EYXRhLkJJTkFSWTtcbiAgLy8gTnVtYmVyIG9mIHdyaXR0ZW4gYnl0ZXNcbiAgY29uc3QgbnVtYmVyT2ZXcml0dGVuQnl0ZXMgPSAhaXNBcnJheVxuICAgID8gd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuVXRmOClcbiAgICA6IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLkFzY2lpKTtcbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuICAvLyBFeHRyYWN0IHRoZSBidWZmZXJcbiAgY29uc3QgZGF0YSA9IHZhbHVlLmJ1ZmZlcjtcbiAgLy8gQ2FsY3VsYXRlIHNpemVcbiAgbGV0IHNpemUgPSB2YWx1ZS5idWZmZXIubGVuZ3RoO1xuICAvLyBBZGQgdGhlIGRlcHJlY2F0ZWQgMDIgdHlwZSA0IGJ5dGVzIG9mIHNpemUgdG8gdG90YWxcbiAgaWYgKHZhbHVlLnN1YlR5cGUgPT09IEJpbmFyeVNpemVzLlNVQlRZUEVfQllURV9BUlJBWSkgc2l6ZSArPSA0O1xuICAvLyBXcml0ZSB0aGUgc2l6ZSBvZiB0aGUgc3RyaW5nIHRvIGJ1ZmZlclxuICBidWZmZXJbaW5kZXgrK10gPSBzaXplICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4KytdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAvLyBXcml0ZSB0aGUgc3VidHlwZSB0byB0aGUgYnVmZmVyXG4gIGJ1ZmZlcltpbmRleCsrXSA9IHZhbHVlLnN1YlR5cGU7XG5cbiAgLy8gSWYgd2UgaGF2ZSBiaW5hcnkgdHlwZSAyIHRoZSA0IGZpcnN0IGJ5dGVzIGFyZSB0aGUgc2l6ZVxuICBpZiAodmFsdWUuc3ViVHlwZSA9PT0gQmluYXJ5U2l6ZXMuU1VCVFlQRV9CWVRFX0FSUkFZKSB7XG4gICAgc2l6ZSAtPSA0O1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IHNpemUgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gIH1cblxuICAvLyBXcml0ZSB0aGUgZGF0YSB0byB0aGUgb2JqZWN0XG4gIGJ1ZmZlci5zZXQoZGF0YSwgaW5kZXgpO1xuICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gIGluZGV4ICs9IHNpemU7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplU3ltYm9sKFxuICBidWZmZXI6IFVpbnQ4QXJyYXksXG4gIGtleTogc3RyaW5nLFxuICB2YWx1ZTogQlNPTlN5bWJvbCxcbiAgaW5kZXg6IG51bWJlcixcbiAgaXNBcnJheT86IGJvb2xlYW4sXG4pIHtcbiAgLy8gV3JpdGUgdGhlIHR5cGVcbiAgYnVmZmVyW2luZGV4KytdID0gQlNPTkRhdGEuU1lNQk9MO1xuICAvLyBOdW1iZXIgb2Ygd3JpdHRlbiBieXRlc1xuICBjb25zdCBudW1iZXJPZldyaXR0ZW5CeXRlcyA9ICFpc0FycmF5XG4gICAgPyB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5VdGY4KVxuICAgIDogd3JpdGVUb0J5dGVzKGJ1ZmZlciwga2V5LCBpbmRleCwgRW5jb2RpbmcuQXNjaWkpO1xuICAvLyBFbmNvZGUgdGhlIG5hbWVcbiAgaW5kZXggKz0gbnVtYmVyT2ZXcml0dGVuQnl0ZXM7XG4gIGJ1ZmZlcltpbmRleCsrXSA9IDA7XG4gIC8vIFdyaXRlIHRoZSBzdHJpbmdcbiAgY29uc3Qgc2l6ZSA9IHdyaXRlVG9CeXRlcyhidWZmZXIsIHZhbHVlLnZhbHVlLCBpbmRleCArIDQsIEVuY29kaW5nLlV0ZjgpICsgMTtcbiAgLy8gV3JpdGUgdGhlIHNpemUgb2YgdGhlIHN0cmluZyB0byBidWZmZXJcbiAgYnVmZmVyW2luZGV4XSA9IHNpemUgJiAweGZmO1xuICBidWZmZXJbaW5kZXggKyAxXSA9IChzaXplID4+IDgpICYgMHhmZjtcbiAgYnVmZmVyW2luZGV4ICsgMl0gPSAoc2l6ZSA+PiAxNikgJiAweGZmO1xuICBidWZmZXJbaW5kZXggKyAzXSA9IChzaXplID4+IDI0KSAmIDB4ZmY7XG4gIC8vIFVwZGF0ZSBpbmRleFxuICBpbmRleCA9IGluZGV4ICsgNCArIHNpemUgLSAxO1xuICAvLyBXcml0ZSB6ZXJvXG4gIGJ1ZmZlcltpbmRleCsrXSA9IDB4MDA7XG4gIHJldHVybiBpbmRleDtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXplREJSZWYoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAga2V5OiBzdHJpbmcsXG4gIHZhbHVlOiBEQlJlZixcbiAgaW5kZXg6IG51bWJlcixcbiAgZGVwdGg6IG51bWJlcixcbiAgc2VyaWFsaXplRnVuY3Rpb25zOiBib29sZWFuLFxuICBpc0FycmF5PzogYm9vbGVhbixcbikge1xuICAvLyBXcml0ZSB0aGUgdHlwZVxuICBidWZmZXJbaW5kZXgrK10gPSBCU09ORGF0YS5PQkpFQ1Q7XG4gIC8vIE51bWJlciBvZiB3cml0dGVuIGJ5dGVzXG4gIGNvbnN0IG51bWJlck9mV3JpdHRlbkJ5dGVzID0gIWlzQXJyYXlcbiAgICA/IHdyaXRlVG9CeXRlcyhidWZmZXIsIGtleSwgaW5kZXgsIEVuY29kaW5nLlV0ZjgpXG4gICAgOiB3cml0ZVRvQnl0ZXMoYnVmZmVyLCBrZXksIGluZGV4LCBFbmNvZGluZy5Bc2NpaSk7XG5cbiAgLy8gRW5jb2RlIHRoZSBuYW1lXG4gIGluZGV4ICs9IG51bWJlck9mV3JpdHRlbkJ5dGVzO1xuICBidWZmZXJbaW5kZXgrK10gPSAwO1xuXG4gIGxldCBzdGFydEluZGV4ID0gaW5kZXg7XG4gIGxldCBvdXRwdXQ6IERCUmVmTGlrZSA9IHtcbiAgICAkcmVmOiB2YWx1ZS5jb2xsZWN0aW9uLFxuICAgICRpZDogdmFsdWUub2lkLFxuICB9O1xuXG4gIGlmICh2YWx1ZS5kYiAhPSBudWxsKSB7XG4gICAgb3V0cHV0LiRkYiA9IHZhbHVlLmRiO1xuICB9XG5cbiAgb3V0cHV0ID0gT2JqZWN0LmFzc2lnbihvdXRwdXQsIHZhbHVlLmZpZWxkcyk7XG4gIGNvbnN0IGVuZEluZGV4ID0gc2VyaWFsaXplSW50byhcbiAgICBidWZmZXIsXG4gICAgb3V0cHV0LFxuICAgIGZhbHNlLFxuICAgIGluZGV4LFxuICAgIGRlcHRoICsgMSxcbiAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICk7XG5cbiAgLy8gQ2FsY3VsYXRlIG9iamVjdCBzaXplXG4gIGNvbnN0IHNpemUgPSBlbmRJbmRleCAtIHN0YXJ0SW5kZXg7XG4gIC8vIFdyaXRlIHRoZSBzaXplXG4gIGJ1ZmZlcltzdGFydEluZGV4KytdID0gc2l6ZSAmIDB4ZmY7XG4gIGJ1ZmZlcltzdGFydEluZGV4KytdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICBidWZmZXJbc3RhcnRJbmRleCsrXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gIGJ1ZmZlcltzdGFydEluZGV4KytdID0gKHNpemUgPj4gMjQpICYgMHhmZjtcbiAgLy8gU2V0IGluZGV4XG4gIHJldHVybiBlbmRJbmRleDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZUludG8oXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAgb2JqZWN0OiBEb2N1bWVudCxcbiAgY2hlY2tLZXlzID0gZmFsc2UsXG4gIHN0YXJ0aW5nSW5kZXggPSAwLFxuICBkZXB0aCA9IDAsXG4gIHNlcmlhbGl6ZUZ1bmN0aW9ucyA9IGZhbHNlLFxuICBpZ25vcmVVbmRlZmluZWQgPSB0cnVlLFxuICBwYXRoOiBEb2N1bWVudFtdID0gW10sXG4pOiBudW1iZXIge1xuICBzdGFydGluZ0luZGV4ID0gc3RhcnRpbmdJbmRleCB8fCAwO1xuICBwYXRoID0gcGF0aCB8fCBbXTtcblxuICAvLyBQdXNoIHRoZSBvYmplY3QgdG8gdGhlIHBhdGhcbiAgcGF0aC5wdXNoKG9iamVjdCk7XG5cbiAgLy8gU3RhcnQgcGxhY2UgdG8gc2VyaWFsaXplIGludG9cbiAgbGV0IGluZGV4ID0gc3RhcnRpbmdJbmRleCArIDQ7XG5cbiAgLy8gU3BlY2lhbCBjYXNlIGlzQXJyYXlcbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqZWN0KSkge1xuICAgIC8vIEdldCBvYmplY3Qga2V5c1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2JqZWN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBrZXkgPSBpLnRvU3RyaW5nKCk7XG4gICAgICBsZXQgdmFsdWUgPSBvYmplY3RbaV07XG5cbiAgICAgIC8vIElzIHRoZXJlIGFuIG92ZXJyaWRlIHZhbHVlXG4gICAgICBpZiAodmFsdWU/LnRvQlNPTikge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLnRvQlNPTiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXCJ0b0JTT04gaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFsdWUgPSB2YWx1ZS50b0JTT04oKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN0cmluZyhidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTnVtYmVyKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiYmlnaW50XCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgICAgXCJVbnN1cHBvcnRlZCB0eXBlIEJpZ0ludCwgcGxlYXNlIHVzZSBEZWNpbWFsMTI4XCIsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCb29sZWFuKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEYXRlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTnVsbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVOdWxsKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdElkKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplT2JqZWN0SWQoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJ1ZmZlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVSZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGVjaW1hbDEyOCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURlY2ltYWwxMjgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgTG9uZyB8fCB2YWx1ZSBpbnN0YW5jZW9mIFRpbWVzdGFtcCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUxvbmcoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRG91YmxlKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRG91YmxlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgsIHRydWUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIiAmJiBzZXJpYWxpemVGdW5jdGlvbnMpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVGdW5jdGlvbihcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNoZWNrS2V5cyxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICB0cnVlLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIENvZGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVDb2RlKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCaW5hcnkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCaW5hcnkoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlN5bWJvbCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN5bWJvbChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEQlJlZikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURCUmVmKFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICAgIHRydWUsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlJlZ0V4cCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJTT05SZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50MzIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVJbnQzMihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4LCB0cnVlKTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBNaW5LZXkgfHwgdmFsdWUgaW5zdGFuY2VvZiBNYXhLZXkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVNaW5NYXgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCwgdHJ1ZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplT2JqZWN0KFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICBwYXRoLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoYFVucmVjb2duaXplZCBvciBpbnZhbGlkIEJTT04gVHlwZTogJHt2YWx1ZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAob2JqZWN0IGluc3RhbmNlb2YgTWFwKSB7XG4gICAgY29uc3QgaXRlcmF0b3IgPSBvYmplY3QuZW50cmllcygpO1xuICAgIGxldCBkb25lID0gZmFsc2U7XG5cbiAgICB3aGlsZSAoIWRvbmUpIHtcbiAgICAgIC8vIFVucGFjayB0aGUgbmV4dCBlbnRyeVxuICAgICAgY29uc3QgZW50cnkgPSBpdGVyYXRvci5uZXh0KCk7XG4gICAgICBkb25lID0gISFlbnRyeS5kb25lO1xuICAgICAgLy8gQXJlIHdlIGRvbmUsIHRoZW4gc2tpcCBhbmQgdGVybWluYXRlXG4gICAgICBpZiAoZG9uZSkgY29udGludWU7XG5cbiAgICAgIC8vIEdldCB0aGUgZW50cnkgdmFsdWVzXG4gICAgICBjb25zdCBrZXkgPSBlbnRyeS52YWx1ZVswXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gZW50cnkudmFsdWVbMV07XG5cbiAgICAgIC8vIENoZWNrIHRoZSB0eXBlIG9mIHRoZSB2YWx1ZVxuICAgICAgY29uc3QgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcblxuICAgICAgLy8gQ2hlY2sgdGhlIGtleSBhbmQgdGhyb3cgZXJyb3IgaWYgaXQncyBpbGxlZ2FsXG4gICAgICBpZiAodHlwZW9mIGtleSA9PT0gXCJzdHJpbmdcIiAmJiAhaWdub3JlS2V5cy5oYXMoa2V5KSkge1xuICAgICAgICBpZiAoa2V5Lm1hdGNoKHJlZ2V4cCkgIT0gbnVsbCkge1xuICAgICAgICAgIC8vIFRoZSBCU09OIHNwZWMgZG9lc24ndCBhbGxvdyBrZXlzIHdpdGggbnVsbCBieXRlcyBiZWNhdXNlIGtleXMgYXJlXG4gICAgICAgICAgLy8gbnVsbC10ZXJtaW5hdGVkLlxuICAgICAgICAgIHRocm93IEVycm9yKGBrZXkgJHtrZXl9IG11c3Qgbm90IGNvbnRhaW4gbnVsbCBieXRlc2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoZWNrS2V5cykge1xuICAgICAgICAgIGlmIChrZXkuc3RhcnRzV2l0aChcIiRcIikpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKGBrZXkgJHtrZXl9IG11c3Qgbm90IHN0YXJ0IHdpdGggJyQnYCk7XG4gICAgICAgICAgfSBlbHNlIGlmICh+a2V5LmluZGV4T2YoXCIuXCIpKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcihga2V5ICR7a2V5fSBtdXN0IG5vdCBjb250YWluICcuJ2ApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHlwZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVN0cmluZyhidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bWJlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHR5cGUgPT09IFwiYmlnaW50XCIgfHwgdmFsdWUgaW5zdGFuY2VvZiBCaWdJbnQ2NEFycmF5IHx8XG4gICAgICAgIHZhbHVlIGluc3RhbmNlb2YgQmlnVWludDY0QXJyYXlcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgICAgICBcIlVuc3VwcG9ydGVkIHR5cGUgQmlnSW50LCBwbGVhc2UgdXNlIERlY2ltYWwxMjhcIixcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJib29sZWFuXCIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVCb29sZWFuKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEYXRlKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgdmFsdWUgPT09IG51bGwgfHwgKHZhbHVlID09PSB1bmRlZmluZWQgJiYgaWdub3JlVW5kZWZpbmVkID09PSBmYWxzZSlcbiAgICAgICkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bGwoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0SWQpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVPYmplY3RJZChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplQnVmZmVyKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZVJlZ0V4cChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gXCJvYmplY3RcIiAmJiB2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU9iamVjdChcbiAgICAgICAgICBidWZmZXIsXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICAgIGluZGV4LFxuICAgICAgICAgIGNoZWNrS2V5cyxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICAgaWdub3JlVW5kZWZpbmVkLFxuICAgICAgICAgIGZhbHNlLFxuICAgICAgICAgIHBhdGgsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgaW5zdGFuY2VvZiBEZWNpbWFsMTI4KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRGVjaW1hbDEyOChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBMb25nKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTG9uZyhidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEb3VibGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEb3VibGUoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQ29kZSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUNvZGUoXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgJiYgc2VyaWFsaXplRnVuY3Rpb25zKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRnVuY3Rpb24oXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJpbmFyeSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJpbmFyeShidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCU09OU3ltYm9sKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplU3ltYm9sKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERCUmVmKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplREJSZWYoXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlJlZ0V4cCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJTT05SZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50MzIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVJbnQzMihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBNaW5LZXkgfHwgdmFsdWUgaW5zdGFuY2VvZiBNYXhLZXkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVNaW5NYXgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihgVW5yZWNvZ25pemVkIG9yIGludmFsaWQgQlNPTiBUWVBFOiAke3ZhbHVlfWApO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBEaWQgd2UgcHJvdmlkZSBhIGN1c3RvbSBzZXJpYWxpemF0aW9uIG1ldGhvZFxuICAgIGlmIChvYmplY3QudG9CU09OKSB7XG4gICAgICBpZiAodHlwZW9mIG9iamVjdC50b0JTT04gIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcInRvQlNPTiBpcyBub3QgYSBmdW5jdGlvblwiKTtcbiAgICAgIH1cbiAgICAgIG9iamVjdCA9IG9iamVjdC50b0JTT04oKTtcbiAgICAgIGlmIChvYmplY3QgIT0gbnVsbCAmJiB0eXBlb2Ygb2JqZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFwidG9CU09OIGZ1bmN0aW9uIGRpZCBub3QgcmV0dXJuIGFuIG9iamVjdFwiKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJdGVyYXRlIG92ZXIgYWxsIHRoZSBrZXlzXG4gICAgZm9yIChjb25zdCBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICBsZXQgdmFsdWUgPSBvYmplY3Rba2V5XTtcbiAgICAgIC8vIElzIHRoZXJlIGFuIG92ZXJyaWRlIHZhbHVlXG4gICAgICBpZiAodmFsdWU/LnRvQlNPTikge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLnRvQlNPTiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXCJ0b0JTT04gaXMgbm90IGEgZnVuY3Rpb25cIik7XG4gICAgICAgIH1cbiAgICAgICAgdmFsdWUgPSB2YWx1ZS50b0JTT04oKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgdGhlIHR5cGUgb2YgdGhlIHZhbHVlXG4gICAgICBjb25zdCB0eXBlID0gdHlwZW9mIHZhbHVlO1xuXG4gICAgICAvLyBDaGVjayB0aGUga2V5IGFuZCB0aHJvdyBlcnJvciBpZiBpdCdzIGlsbGVnYWxcbiAgICAgIGlmICh0eXBlb2Yga2V5ID09PSBcInN0cmluZ1wiICYmICFpZ25vcmVLZXlzLmhhcyhrZXkpKSB7XG4gICAgICAgIGlmIChrZXkubWF0Y2gocmVnZXhwKSAhPSBudWxsKSB7XG4gICAgICAgICAgLy8gVGhlIEJTT04gc3BlYyBkb2Vzbid0IGFsbG93IGtleXMgd2l0aCBudWxsIGJ5dGVzIGJlY2F1c2Uga2V5cyBhcmVcbiAgICAgICAgICAvLyBudWxsLXRlcm1pbmF0ZWQuXG4gICAgICAgICAgdGhyb3cgRXJyb3IoYGtleSAke2tleX0gbXVzdCBub3QgY29udGFpbiBudWxsIGJ5dGVzYCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2hlY2tLZXlzKSB7XG4gICAgICAgICAgaWYgKGtleS5zdGFydHNXaXRoKFwiJFwiKSkge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoYGtleSAke2tleX0gbXVzdCBub3Qgc3RhcnQgd2l0aCAnJCdgKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKH5rZXkuaW5kZXhPZihcIi5cIikpIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKGBrZXkgJHtrZXl9IG11c3Qgbm90IGNvbnRhaW4gJy4nYCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplU3RyaW5nKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTnVtYmVyKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcImJpZ2ludFwiKSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKFxuICAgICAgICAgIFwiVW5zdXBwb3J0ZWQgdHlwZSBCaWdJbnQsIHBsZWFzZSB1c2UgRGVjaW1hbDEyOFwiLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJvb2xlYW4oYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZURhdGUoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKGlnbm9yZVVuZGVmaW5lZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZU51bGwoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVOdWxsKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdElkKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplT2JqZWN0SWQoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJ1ZmZlcihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVSZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwib2JqZWN0XCIgJiYgdmFsdWUgaW5zdGFuY2VvZiBEZWNpbWFsMTI4KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRGVjaW1hbDEyOChidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBMb25nIHx8IHZhbHVlIGluc3RhbmNlb2YgVGltZXN0YW1wKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplTG9uZyhidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBEb3VibGUpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVEb3VibGUoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQ29kZSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUNvZGUoXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICAgIGlnbm9yZVVuZGVmaW5lZCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgJiYgc2VyaWFsaXplRnVuY3Rpb25zKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplRnVuY3Rpb24oXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBjaGVja0tleXMsXG4gICAgICAgICAgZGVwdGgsXG4gICAgICAgICAgc2VyaWFsaXplRnVuY3Rpb25zLFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEJpbmFyeSkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJpbmFyeShidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBCU09OU3ltYm9sKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplU3ltYm9sKGJ1ZmZlciwga2V5LCB2YWx1ZSwgaW5kZXgpO1xuICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERCUmVmKSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplREJSZWYoXG4gICAgICAgICAgYnVmZmVyLFxuICAgICAgICAgIGtleSxcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICBpbmRleCxcbiAgICAgICAgICBkZXB0aCxcbiAgICAgICAgICBzZXJpYWxpemVGdW5jdGlvbnMsXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgQlNPTlJlZ0V4cCkge1xuICAgICAgICBpbmRleCA9IHNlcmlhbGl6ZUJTT05SZWdFeHAoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgSW50MzIpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVJbnQzMihidWZmZXIsIGtleSwgdmFsdWUsIGluZGV4KTtcbiAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBNaW5LZXkgfHwgdmFsdWUgaW5zdGFuY2VvZiBNYXhLZXkpIHtcbiAgICAgICAgaW5kZXggPSBzZXJpYWxpemVNaW5NYXgoYnVmZmVyLCBrZXksIHZhbHVlLCBpbmRleCk7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgIGluZGV4ID0gc2VyaWFsaXplT2JqZWN0KFxuICAgICAgICAgIGJ1ZmZlcixcbiAgICAgICAgICBrZXksXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgY2hlY2tLZXlzLFxuICAgICAgICAgIGRlcHRoLFxuICAgICAgICAgIHNlcmlhbGl6ZUZ1bmN0aW9ucyxcbiAgICAgICAgICBpZ25vcmVVbmRlZmluZWQsXG4gICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgcGF0aCxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBCU09OVHlwZUVycm9yKGBVbnJlY29nbml6ZWQgb3IgaW52YWxpZCBCU09OIFR5cGU6ICR7dmFsdWV9YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gUmVtb3ZlIHRoZSBwYXRoXG4gIHBhdGgucG9wKCk7XG5cbiAgLy8gdGhyb3cgaWYgaW5kZXggaXMgb3V0IG9mIGJvdW5kc1xuICBpZiAoYnVmZmVyLmxlbmd0aCA8IGluZGV4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRG9jdW1lbnQgZXhjZWVkcyBtYXggQlNPTiBzaXplXCIpO1xuICB9XG5cbiAgLy8gRmluYWwgcGFkZGluZyBieXRlIGZvciBvYmplY3RcbiAgYnVmZmVyW2luZGV4KytdID0gMHgwMDtcblxuICAvLyBGaW5hbCBzaXplXG4gIGNvbnN0IHNpemUgPSBpbmRleCAtIHN0YXJ0aW5nSW5kZXg7XG4gIC8vIFdyaXRlIHRoZSBzaXplIG9mIHRoZSBvYmplY3RcbiAgYnVmZmVyW3N0YXJ0aW5nSW5kZXgrK10gPSBzaXplICYgMHhmZjtcbiAgYnVmZmVyW3N0YXJ0aW5nSW5kZXgrK10gPSAoc2l6ZSA+PiA4KSAmIDB4ZmY7XG4gIGJ1ZmZlcltzdGFydGluZ0luZGV4KytdID0gKHNpemUgPj4gMTYpICYgMHhmZjtcbiAgYnVmZmVyW3N0YXJ0aW5nSW5kZXgrK10gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICByZXR1cm4gaW5kZXg7XG59XG4iXX0=