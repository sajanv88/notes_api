import { Binary, BinarySizes } from "../binary.ts";
import { Code } from "../code.ts";
import { BSONData, JS_INT_MAX, JS_INT_MIN } from "../constants.ts";
import { DBRef, isDBRefLike } from "../db_ref.ts";
import { Decimal128 } from "../decimal128.ts";
import { Double } from "../double.ts";
import { BSONError } from "../error.ts";
import { Int32 } from "../int_32.ts";
import { Long } from "../long.ts";
import { MaxKey, MinKey } from "../key.ts";
import { ObjectId } from "../objectid.ts";
import { BSONRegExp } from "../regexp.ts";
import { BSONSymbol } from "../symbol.ts";
import { Timestamp } from "../timestamp.ts";
import { validateUtf8 } from "../validate_utf8.ts";
import { bytesCopy, utf8Slice } from "./utils.ts";
const JS_INT_MAX_LONG = Long.fromNumber(JS_INT_MAX);
const JS_INT_MIN_LONG = Long.fromNumber(JS_INT_MIN);
const functionCache = {};
export function deserialize(buffer, options = {}, isArray) {
    const index = options?.index ? options.index : 0;
    const size = buffer[index] |
        (buffer[index + 1] << 8) |
        (buffer[index + 2] << 16) |
        (buffer[index + 3] << 24);
    if (size < 5) {
        throw new BSONError(`bson size must be >= 5, is ${size}`);
    }
    if (options.allowObjectSmallerThanBufferSize && buffer.length < size) {
        throw new BSONError(`buffer length ${buffer.length} must be >= bson size ${size}`);
    }
    if (!options.allowObjectSmallerThanBufferSize && buffer.length !== size) {
        throw new BSONError(`buffer length ${buffer.length} must === bson size ${size}`);
    }
    if (size + index > buffer.byteLength) {
        throw new BSONError(`(bson size ${size} + options.index ${index} must be <= buffer length ${buffer.byteLength})`);
    }
    if (buffer[index + size - 1] !== 0) {
        throw new BSONError("One object, sized correctly, with a spot for an EOO, but the EOO isn't 0x00");
    }
    return deserializeObject(buffer, index, options, isArray);
}
const allowedDBRefKeys = /^\$ref$|^\$id$|^\$db$/;
function deserializeObject(buffer, index, options, isArray = false) {
    const evalFunctions = options.evalFunctions ?? false;
    const cacheFunctions = options.cacheFunctions ?? false;
    const fieldsAsRaw = options.fieldsAsRaw ?? null;
    const raw = options.raw ?? false;
    const bsonRegExp = options.bsonRegExp ?? false;
    const promoteBuffers = options.promoteBuffers ?? false;
    const promoteLongs = options.promoteLongs ?? true;
    const promoteValues = options.promoteValues ?? true;
    const validation = options.validation ?? { utf8: true };
    let globalUTFValidation = true;
    let validationSetting;
    const utf8KeysSet = new Set();
    const utf8ValidatedKeys = validation.utf8;
    if (typeof utf8ValidatedKeys === "boolean") {
        validationSetting = utf8ValidatedKeys;
    }
    else {
        globalUTFValidation = false;
        const utf8ValidationValues = Object.keys(utf8ValidatedKeys).map((key) => utf8ValidatedKeys[key]);
        if (utf8ValidationValues.length === 0) {
            throw new BSONError("UTF-8 validation setting cannot be empty");
        }
        if (typeof utf8ValidationValues[0] !== "boolean") {
            throw new BSONError("Invalid UTF-8 validation option, must specify boolean values");
        }
        validationSetting = utf8ValidationValues[0];
        if (!utf8ValidationValues.every((item) => item === validationSetting)) {
            throw new BSONError("Invalid UTF-8 validation option - keys must be all true or all false");
        }
    }
    if (!globalUTFValidation) {
        for (const key of Object.keys(utf8ValidatedKeys)) {
            utf8KeysSet.add(key);
        }
    }
    const startIndex = index;
    if (buffer.length < 5) {
        throw new BSONError("corrupt bson message < 5 bytes long");
    }
    const size = buffer[index++] | (buffer[index++] << 8) |
        (buffer[index++] << 16) | (buffer[index++] << 24);
    if (size < 5 || size > buffer.length) {
        throw new BSONError("corrupt bson message");
    }
    const object = isArray ? [] : {};
    let arrayIndex = 0;
    const done = false;
    let isPossibleDBRef = isArray ? false : null;
    while (!done) {
        const elementType = buffer[index++];
        if (elementType === 0)
            break;
        let i = index;
        while (buffer[i] !== 0x00 && i < buffer.length) {
            i++;
        }
        if (i >= buffer.byteLength) {
            throw new BSONError("Bad BSON Document: illegal CString");
        }
        const name = isArray ? arrayIndex++ : utf8Slice(buffer, index, i);
        let shouldValidateKey = true;
        shouldValidateKey = globalUTFValidation || utf8KeysSet.has(name)
            ? validationSetting
            : !validationSetting;
        if (isPossibleDBRef !== false && name[0] === "$") {
            isPossibleDBRef = allowedDBRefKeys.test(name);
        }
        let value;
        index = i + 1;
        if (elementType === BSONData.STRING) {
            const stringSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (stringSize <= 0 ||
                stringSize > buffer.length - index ||
                buffer[index + stringSize - 1] !== 0) {
                throw new BSONError("bad string length in bson");
            }
            value = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);
            index += stringSize;
        }
        else if (elementType === BSONData.OID) {
            const oid = new Uint8Array(12);
            bytesCopy(oid, 0, buffer, index, index + 12);
            value = new ObjectId(oid);
            index += 12;
        }
        else if (elementType === BSONData.INT && promoteValues === false) {
            value = new Int32(buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) |
                (buffer[index++] << 24));
        }
        else if (elementType === BSONData.INT) {
            value = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
        }
        else if (elementType === BSONData.NUMBER && promoteValues === false) {
            value = new Double(new DataView(buffer.buffer, index, 8).getFloat64(0, true));
            index += 8;
        }
        else if (elementType === BSONData.NUMBER) {
            value = new DataView(buffer.buffer, index, 8).getFloat64(0, true);
            index += 8;
        }
        else if (elementType === BSONData.DATE) {
            const lowBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            const highBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            value = new Date(new Long(lowBits, highBits).toNumber());
        }
        else if (elementType === BSONData.BOOLEAN) {
            if (buffer[index] !== 0 && buffer[index] !== 1) {
                throw new BSONError("illegal boolean type value");
            }
            value = buffer[index++] === 1;
        }
        else if (elementType === BSONData.OBJECT) {
            const _index = index;
            const objectSize = buffer[index] |
                (buffer[index + 1] << 8) |
                (buffer[index + 2] << 16) |
                (buffer[index + 3] << 24);
            if (objectSize <= 0 || objectSize > buffer.length - index) {
                throw new BSONError("bad embedded document length in bson");
            }
            if (raw) {
                value = buffer.slice(index, index + objectSize);
            }
            else {
                let objectOptions = options;
                if (!globalUTFValidation) {
                    objectOptions = {
                        ...options,
                        validation: { utf8: shouldValidateKey },
                    };
                }
                value = deserializeObject(buffer, _index, objectOptions, false);
            }
            index += objectSize;
        }
        else if (elementType === BSONData.ARRAY) {
            const _index = index;
            const objectSize = buffer[index] |
                (buffer[index + 1] << 8) |
                (buffer[index + 2] << 16) |
                (buffer[index + 3] << 24);
            let arrayOptions = options;
            const stopIndex = index + objectSize;
            if (fieldsAsRaw && fieldsAsRaw[name]) {
                arrayOptions = {};
                for (const n in options) {
                    arrayOptions[n] = options[n];
                }
                arrayOptions.raw = true;
            }
            if (!globalUTFValidation) {
                arrayOptions = {
                    ...arrayOptions,
                    validation: { utf8: shouldValidateKey },
                };
            }
            value = deserializeObject(buffer, _index, arrayOptions, true);
            index += objectSize;
            if (buffer[index - 1] !== 0) {
                throw new BSONError("invalid array terminator byte");
            }
            if (index !== stopIndex)
                throw new BSONError("corrupted array bson");
        }
        else if (elementType === BSONData.UNDEFINED) {
            value = undefined;
        }
        else if (elementType === BSONData.NULL) {
            value = null;
        }
        else if (elementType === BSONData.LONG) {
            const lowBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            const highBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            const long = new Long(lowBits, highBits);
            if (promoteLongs && promoteValues === true) {
                value = long.lessThanOrEqual(JS_INT_MAX_LONG) &&
                    long.greaterThanOrEqual(JS_INT_MIN_LONG)
                    ? long.toNumber()
                    : long;
            }
            else {
                value = long;
            }
        }
        else if (elementType === BSONData.DECIMAL128) {
            const bytes = new Uint8Array(16);
            bytesCopy(bytes, 0, buffer, index, index + 16);
            index += 16;
            const decimal128 = new Decimal128(bytes);
            value =
                "toObject" in decimal128 && typeof decimal128.toObject === "function"
                    ? decimal128.toObject()
                    : decimal128;
        }
        else if (elementType === BSONData.BINARY) {
            let binarySize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            const totalBinarySize = binarySize;
            const subType = buffer[index++];
            if (binarySize < 0) {
                throw new BSONError("Negative binary type element size found");
            }
            if (binarySize > buffer.byteLength) {
                throw new BSONError("Binary type size larger than document size");
            }
            if (buffer.slice != null) {
                if (subType === BinarySizes.SUBTYPE_BYTE_ARRAY) {
                    binarySize = buffer[index++] |
                        (buffer[index++] << 8) |
                        (buffer[index++] << 16) |
                        (buffer[index++] << 24);
                    if (binarySize < 0) {
                        throw new BSONError("Negative binary type element size found for subtype 0x02");
                    }
                    if (binarySize > totalBinarySize - 4) {
                        throw new BSONError("Binary type with subtype 0x02 contains too long binary size");
                    }
                    if (binarySize < totalBinarySize - 4) {
                        throw new BSONError("Binary type with subtype 0x02 contains too short binary size");
                    }
                }
                value = promoteBuffers && promoteValues
                    ? buffer.slice(index, index + binarySize)
                    : new Binary(buffer.slice(index, index + binarySize), subType);
            }
            else {
                const _buffer = new Uint8Array(binarySize);
                if (subType === BinarySizes.SUBTYPE_BYTE_ARRAY) {
                    binarySize = buffer[index++] |
                        (buffer[index++] << 8) |
                        (buffer[index++] << 16) |
                        (buffer[index++] << 24);
                    if (binarySize < 0) {
                        throw new BSONError("Negative binary type element size found for subtype 0x02");
                    }
                    if (binarySize > totalBinarySize - 4) {
                        throw new BSONError("Binary type with subtype 0x02 contains too long binary size");
                    }
                    if (binarySize < totalBinarySize - 4) {
                        throw new BSONError("Binary type with subtype 0x02 contains too short binary size");
                    }
                }
                for (i = 0; i < binarySize; i++) {
                    _buffer[i] = buffer[index + i];
                }
                value = promoteBuffers && promoteValues
                    ? _buffer
                    : new Binary(_buffer, subType);
            }
            index += binarySize;
        }
        else if (elementType === BSONData.REGEXP && bsonRegExp === false) {
            i = index;
            while (buffer[i] !== 0x00 && i < buffer.length) {
                i++;
            }
            if (i >= buffer.length) {
                throw new BSONError("Bad BSON Document: illegal CString");
            }
            const source = utf8Slice(buffer, index, i);
            index = i + 1;
            i = index;
            while (buffer[i] !== 0x00 && i < buffer.length) {
                i++;
            }
            if (i >= buffer.length) {
                throw new BSONError("Bad BSON Document: illegal CString");
            }
            const regExpOptions = utf8Slice(buffer, index, i);
            index = i + 1;
            const optionsArray = new Array(regExpOptions.length);
            for (i = 0; i < regExpOptions.length; i++) {
                switch (regExpOptions[i]) {
                    case "m":
                        optionsArray[i] = "m";
                        break;
                    case "s":
                        optionsArray[i] = "g";
                        break;
                    case "i":
                        optionsArray[i] = "i";
                        break;
                }
            }
            value = new RegExp(source, optionsArray.join(""));
        }
        else if (elementType === BSONData.REGEXP && bsonRegExp === true) {
            i = index;
            while (buffer[i] !== 0x00 && i < buffer.length) {
                i++;
            }
            if (i >= buffer.length) {
                throw new BSONError("Bad BSON Document: illegal CString");
            }
            const source = utf8Slice(buffer, index, i);
            index = i + 1;
            i = index;
            while (buffer[i] !== 0x00 && i < buffer.length) {
                i++;
            }
            if (i >= buffer.length) {
                throw new BSONError("Bad BSON Document: illegal CString");
            }
            const regExpOptions = utf8Slice(buffer, index, i);
            index = i + 1;
            value = new BSONRegExp(source, regExpOptions);
        }
        else if (elementType === BSONData.SYMBOL) {
            const stringSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (stringSize <= 0 ||
                stringSize > buffer.length - index ||
                buffer[index + stringSize - 1] !== 0) {
                throw new BSONError("bad string length in bson");
            }
            const symbol = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);
            value = promoteValues ? symbol : new BSONSymbol(symbol);
            index += stringSize;
        }
        else if (elementType === BSONData.TIMESTAMP) {
            const lowBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            const highBits = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            value = new Timestamp(new Long(lowBits, highBits));
        }
        else if (elementType === BSONData.MIN_KEY) {
            value = new MinKey();
        }
        else if (elementType === BSONData.MAX_KEY) {
            value = new MaxKey();
        }
        else if (elementType === BSONData.CODE) {
            const stringSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (stringSize <= 0 ||
                stringSize > buffer.length - index ||
                buffer[index + stringSize - 1] !== 0) {
                throw new BSONError("bad string length in bson");
            }
            const functionString = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);
            if (evalFunctions) {
                value = cacheFunctions
                    ? isolateEval(functionString, functionCache, object)
                    : isolateEval(functionString);
            }
            else {
                value = new Code(functionString);
            }
            index += stringSize;
        }
        else if (elementType === BSONData.CODE_W_SCOPE) {
            const totalSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (totalSize < 4 + 4 + 4 + 1) {
                throw new BSONError("code_w_scope total size shorter minimum expected length");
            }
            const stringSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (stringSize <= 0 ||
                stringSize > buffer.length - index ||
                buffer[index + stringSize - 1] !== 0) {
                throw new BSONError("bad string length in bson");
            }
            const functionString = getValidatedString(buffer, index, index + stringSize - 1, shouldValidateKey);
            index += stringSize;
            const _index = index;
            const objectSize = buffer[index] |
                (buffer[index + 1] << 8) |
                (buffer[index + 2] << 16) |
                (buffer[index + 3] << 24);
            const scopeObject = deserializeObject(buffer, _index, options, false);
            index += objectSize;
            if (totalSize < 4 + 4 + objectSize + stringSize) {
                throw new BSONError("code_w_scope total size is too short, truncating scope");
            }
            if (totalSize > 4 + 4 + objectSize + stringSize) {
                throw new BSONError("code_w_scope total size is too long, clips outer document");
            }
            if (evalFunctions) {
                value = cacheFunctions
                    ? isolateEval(functionString, functionCache, object)
                    : isolateEval(functionString);
                value.scope = scopeObject;
            }
            else {
                value = new Code(functionString, scopeObject);
            }
        }
        else if (elementType === BSONData.DBPOINTER) {
            const stringSize = buffer[index++] |
                (buffer[index++] << 8) |
                (buffer[index++] << 16) |
                (buffer[index++] << 24);
            if (stringSize <= 0 ||
                stringSize > buffer.length - index ||
                buffer[index + stringSize - 1] !== 0) {
                throw new BSONError("bad string length in bson");
            }
            if (validation?.utf8 && !validateUtf8(buffer, index, index + stringSize - 1)) {
                throw new BSONError("Invalid UTF-8 string in BSON document");
            }
            const namespace = utf8Slice(buffer, index, index + stringSize - 1);
            index += stringSize;
            const oidBuffer = new Uint8Array(12);
            bytesCopy(oidBuffer, 0, buffer, index, index + 12);
            const oid = new ObjectId(oidBuffer);
            index += 12;
            value = new DBRef(namespace, oid);
        }
        else {
            throw new BSONError(`Detected unknown BSON type ${elementType.toString(16)}` +
                ' for fieldname "' + name + '"');
        }
        if (name === "__proto__") {
            Object.defineProperty(object, name, {
                value,
                writable: true,
                enumerable: true,
                configurable: true,
            });
        }
        else {
            object[name] = value;
        }
    }
    if (size !== index - startIndex) {
        if (isArray)
            throw new BSONError("corrupt array bson");
        throw new BSONError("corrupt object bson");
    }
    if (!isPossibleDBRef)
        return object;
    if (isDBRefLike(object)) {
        const copy = Object.assign({}, object);
        delete copy.$ref;
        delete copy.$id;
        delete copy.$db;
        return new DBRef(object.$ref, object.$id, object.$db, copy);
    }
    return object;
}
function isolateEval(functionString, functionCache, object) {
    if (!functionCache)
        return new Function(functionString);
    if (functionCache[functionString] == null) {
        functionCache[functionString] = new Function(functionString);
    }
    return functionCache[functionString].bind(object);
}
function getValidatedString(buffer, start, end, shouldValidateUtf8) {
    const value = utf8Slice(buffer, start, end);
    if (shouldValidateUtf8) {
        for (let i = 0; i < value.length; i++) {
            if (value.charCodeAt(i) === 0xff_fd) {
                if (!validateUtf8(buffer, start, end)) {
                    throw new BSONError("Invalid UTF-8 string in BSON document");
                }
                break;
            }
        }
    }
    return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVzZXJpYWxpemVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGVzZXJpYWxpemVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBRW5ELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDbEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDbkUsT0FBTyxFQUFFLEtBQUssRUFBYSxXQUFXLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDN0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDdEMsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUN4QyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDbEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDM0MsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDMUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMxQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDNUMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ25ELE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBMkNsRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BELE1BQU0s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Q0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDckMsSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLE9BQU8sRUFBRTtnQkFDbkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFO29CQUNyQyxNQUFNLElBQUksU0FBUyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7aUJBQzlEO2dCQUNELE1BQU07YUFDUDtTQUNGO0tBQ0Y7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCaW5hcnksIEJpbmFyeVNpemVzIH0gZnJvbSBcIi4uL2JpbmFyeS50c1wiO1xuaW1wb3J0IHR5cGUgeyBEb2N1bWVudCB9IGZyb20gXCIuLi9ic29uLnRzXCI7XG5pbXBvcnQgeyBDb2RlIH0gZnJvbSBcIi4uL2NvZGUudHNcIjtcbmltcG9ydCB7IEJTT05EYXRhLCBKU19JTlRfTUFYLCBKU19JTlRfTUlOIH0gZnJvbSBcIi4uL2NvbnN0YW50cy50c1wiO1xuaW1wb3J0IHsgREJSZWYsIERCUmVmTGlrZSwgaXNEQlJlZkxpa2UgfSBmcm9tIFwiLi4vZGJfcmVmLnRzXCI7XG5pbXBvcnQgeyBEZWNpbWFsMTI4IH0gZnJvbSBcIi4uL2RlY2ltYWwxMjgudHNcIjtcbmltcG9ydCB7IERvdWJsZSB9IGZyb20gXCIuLi9kb3VibGUudHNcIjtcbmltcG9ydCB7IEJTT05FcnJvciB9IGZyb20gXCIuLi9lcnJvci50c1wiO1xuaW1wb3J0IHsgSW50MzIgfSBmcm9tIFwiLi4vaW50XzMyLnRzXCI7XG5pbXBvcnQgeyBMb25nIH0gZnJvbSBcIi4uL2xvbmcudHNcIjtcbmltcG9ydCB7IE1heEtleSwgTWluS2V5IH0gZnJvbSBcIi4uL2tleS50c1wiO1xuaW1wb3J0IHsgT2JqZWN0SWQgfSBmcm9tIFwiLi4vb2JqZWN0aWQudHNcIjtcbmltcG9ydCB7IEJTT05SZWdFeHAgfSBmcm9tIFwiLi4vcmVnZXhwLnRzXCI7XG5pbXBvcnQgeyBCU09OU3ltYm9sIH0gZnJvbSBcIi4uL3N5bWJvbC50c1wiO1xuaW1wb3J0IHsgVGltZXN0YW1wIH0gZnJvbSBcIi4uL3RpbWVzdGFtcC50c1wiO1xuaW1wb3J0IHsgdmFsaWRhdGVVdGY4IH0gZnJvbSBcIi4uL3ZhbGlkYXRlX3V0ZjgudHNcIjtcbmltcG9ydCB7IGJ5dGVzQ29weSwgdXRmOFNsaWNlIH0gZnJvbSBcIi4vdXRpbHMudHNcIjtcblxuLyoqIEBwdWJsaWMgKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVzZXJpYWxpemVPcHRpb25zIHtcbiAgLyoqIGV2YWx1YXRlIGZ1bmN0aW9ucyBpbiB0aGUgQlNPTiBkb2N1bWVudCBzY29wZWQgdG8gdGhlIG9iamVjdCBkZXNlcmlhbGl6ZWQuICovXG4gIGV2YWxGdW5jdGlvbnM/OiBib29sZWFuO1xuICAvKiogY2FjaGUgZXZhbHVhdGVkIGZ1bmN0aW9ucyBmb3IgcmV1c2UuICovXG4gIGNhY2hlRnVuY3Rpb25zPzogYm9vbGVhbjtcbiAgLyoqIHdoZW4gZGVzZXJpYWxpemluZyBhIExvbmcgd2lsbCBmaXQgaXQgaW50byBhIE51bWJlciBpZiBpdCdzIHNtYWxsZXIgdGhhbiA1MyBiaXRzICovXG4gIHByb21vdGVMb25ncz86IGJvb2xlYW47XG4gIC8qKiB3aGVuIGRlc2VyaWFsaXppbmcgYSBCaW5hcnkgd2lsbCByZXR1cm4gaXQgYXMgYSBub2RlLmpzIEJ1ZmZlciBpbnN0YW5jZS4gKi9cbiAgcHJvbW90ZUJ1ZmZlcnM/OiBib29sZWFuO1xuICAvKiogd2hlbiBkZXNlcmlhbGl6aW5nIHdpbGwgcHJvbW90ZSBCU09OIHZhbHVlcyB0byB0aGVpciBOb2RlLmpzIGNsb3Nlc3QgZXF1aXZhbGVudCB0eXBlcy4gKi9cbiAgcHJvbW90ZVZhbHVlcz86IGJvb2xlYW47XG4gIC8qKiBhbGxvdyB0byBzcGVjaWZ5IGlmIHRoZXJlIHdoYXQgZmllbGRzIHdlIHdpc2ggdG8gcmV0dXJuIGFzIHVuc2VyaWFsaXplZCByYXcgYnVmZmVyLiAqL1xuICBmaWVsZHNBc1Jhdz86IERvY3VtZW50O1xuICAvKiogcmV0dXJuIEJTT04gcmVndWxhciBleHByZXNzaW9ucyBhcyBCU09OUmVnRXhwIGluc3RhbmNlcy4gKi9cbiAgYnNvblJlZ0V4cD86IGJvb2xlYW47XG4gIC8qKiBhbGxvd3MgdGhlIGJ1ZmZlciB0byBiZSBsYXJnZXIgdGhhbiB0aGUgcGFyc2VkIEJTT04gb2JqZWN0ICovXG4gIGFsbG93T2JqZWN0U21hbGxlclRoYW5CdWZmZXJTaXplPzogYm9vbGVhbjtcbiAgLyoqIE9mZnNldCBpbnRvIGJ1ZmZlciB0byBiZWdpbiByZWFkaW5nIGRvY3VtZW50IGZyb20gKi9cbiAgaW5kZXg/OiBudW1iZXI7XG5cbiAgcmF3PzogYm9vbGVhbjtcbiAgLyoqIEFsbG93cyBmb3Igb3B0LW91dCB1dGYtOCB2YWxpZGF0aW9uIGZvciBhbGwga2V5cyBvclxuICAgKiBzcGVjaWZpZWQga2V5cy4gTXVzdCBiZSBhbGwgdHJ1ZSBvciBhbGwgZmFsc2UuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGBgYGpzXG4gICAqIC8vIGRpc2FibGVzIHZhbGlkYXRpb24gb24gYWxsIGtleXNcbiAgICogIHZhbGlkYXRpb246IHsgdXRmODogZmFsc2UgfVxuICAgKlxuICAgKiAvLyBlbmFibGVzIHZhbGlkYXRpb24gb25seSBvbiBzcGVjaWZpZWQga2V5cyBhLCBiLCBhbmQgY1xuICAgKiAgdmFsaWRhdGlvbjogeyB1dGY4OiB7IGE6IHRydWUsIGI6IHRydWUsIGM6IHRydWUgfSB9XG4gICAqXG4gICAqICAvLyBkaXNhYmxlcyB2YWxpZGF0aW9uIG9ubHkgb24gc3BlY2lmaWVkIGtleXMgYSwgYlxuICAgKiAgdmFsaWRhdGlvbjogeyB1dGY4OiB7IGE6IGZhbHNlLCBiOiBmYWxzZSB9IH1cbiAgICogYGBgXG4gICAqL1xuICB2YWxpZGF0aW9uPzogeyB1dGY4OiBib29sZWFuIHwgUmVjb3JkPHN0cmluZywgdHJ1ZT4gfCBSZWNvcmQ8c3RyaW5nLCBmYWxzZT4gfTtcbn1cblxuLy8gSW50ZXJuYWwgbG9uZyB2ZXJzaW9uc1xuY29uc3QgSlNfSU5UX01BWF9MT05HID0gTG9uZy5mcm9tTnVtYmVyKEpTX0lOVF9NQVgpO1xuY29uc3QgSlNfSU5UX01JTl9MT05HID0gTG9uZy5mcm9tTnVtYmVyKEpTX0lOVF9NSU4pO1xuXG4vLyBkZW5vLWxpbnQtaWdub3JlIGJhbi10eXBlc1xuY29uc3QgZnVuY3Rpb25DYWNoZTogeyBbaGFzaDogc3RyaW5nXTogRnVuY3Rpb24gfSA9IHt9O1xuXG5leHBvcnQgZnVuY3Rpb24gZGVzZXJpYWxpemUoXG4gIGJ1ZmZlcjogVWludDhBcnJheSxcbiAgb3B0aW9uczogRGVzZXJpYWxpemVPcHRpb25zID0ge30sXG4gIGlzQXJyYXk/OiBib29sZWFuLFxuKTogRG9jdW1lbnQge1xuICBjb25zdCBpbmRleCA9IG9wdGlvbnM/LmluZGV4ID8gb3B0aW9ucy5pbmRleCA6IDA7XG4gIC8vIFJlYWQgdGhlIGRvY3VtZW50IHNpemVcbiAgY29uc3Qgc2l6ZSA9IGJ1ZmZlcltpbmRleF0gfFxuICAgIChidWZmZXJbaW5kZXggKyAxXSA8PCA4KSB8XG4gICAgKGJ1ZmZlcltpbmRleCArIDJdIDw8IDE2KSB8XG4gICAgKGJ1ZmZlcltpbmRleCArIDNdIDw8IDI0KTtcblxuICBpZiAoc2l6ZSA8IDUpIHtcbiAgICB0aHJvdyBuZXcgQlNPTkVycm9yKGBic29uIHNpemUgbXVzdCBiZSA+PSA1LCBpcyAke3NpemV9YCk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5hbGxvd09iamVjdFNtYWxsZXJUaGFuQnVmZmVyU2l6ZSAmJiBidWZmZXIubGVuZ3RoIDwgc2l6ZSkge1xuICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICBgYnVmZmVyIGxlbmd0aCAke2J1ZmZlci5sZW5ndGh9IG11c3QgYmUgPj0gYnNvbiBzaXplICR7c2l6ZX1gLFxuICAgICk7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMuYWxsb3dPYmplY3RTbWFsbGVyVGhhbkJ1ZmZlclNpemUgJiYgYnVmZmVyLmxlbmd0aCAhPT0gc2l6ZSkge1xuICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICBgYnVmZmVyIGxlbmd0aCAke2J1ZmZlci5sZW5ndGh9IG11c3QgPT09IGJzb24gc2l6ZSAke3NpemV9YCxcbiAgICApO1xuICB9XG5cbiAgaWYgKHNpemUgKyBpbmRleCA+IGJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEJTT05FcnJvcihcbiAgICAgIGAoYnNvbiBzaXplICR7c2l6ZX0gKyBvcHRpb25zLmluZGV4ICR7aW5kZXh9IG11c3QgYmUgPD0gYnVmZmVyIGxlbmd0aCAke2J1ZmZlci5ieXRlTGVuZ3RofSlgLFxuICAgICk7XG4gIH1cblxuICAvLyBJbGxlZ2FsIGVuZCB2YWx1ZVxuICBpZiAoYnVmZmVyW2luZGV4ICsgc2l6ZSAtIDFdICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEJTT05FcnJvcihcbiAgICAgIFwiT25lIG9iamVjdCwgc2l6ZWQgY29ycmVjdGx5LCB3aXRoIGEgc3BvdCBmb3IgYW4gRU9PLCBidXQgdGhlIEVPTyBpc24ndCAweDAwXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIFN0YXJ0IGRlc2VyaWFsaXp0aW9uXG4gIHJldHVybiBkZXNlcmlhbGl6ZU9iamVjdChidWZmZXIsIGluZGV4LCBvcHRpb25zLCBpc0FycmF5KTtcbn1cblxuY29uc3QgYWxsb3dlZERCUmVmS2V5cyA9IC9eXFwkcmVmJHxeXFwkaWQkfF5cXCRkYiQvO1xuXG5mdW5jdGlvbiBkZXNlcmlhbGl6ZU9iamVjdChcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBpbmRleDogbnVtYmVyLFxuICBvcHRpb25zOiBEZXNlcmlhbGl6ZU9wdGlvbnMsXG4gIGlzQXJyYXkgPSBmYWxzZSxcbikge1xuICBjb25zdCBldmFsRnVuY3Rpb25zID0gb3B0aW9ucy5ldmFsRnVuY3Rpb25zID8/IGZhbHNlO1xuICBjb25zdCBjYWNoZUZ1bmN0aW9ucyA9IG9wdGlvbnMuY2FjaGVGdW5jdGlvbnMgPz8gZmFsc2U7XG5cbiAgY29uc3QgZmllbGRzQXNSYXcgPSBvcHRpb25zLmZpZWxkc0FzUmF3ID8/IG51bGw7XG5cbiAgLy8gUmV0dXJuIHJhdyBic29uIGJ1ZmZlciBpbnN0ZWFkIG9mIHBhcnNpbmcgaXRcbiAgY29uc3QgcmF3ID0gb3B0aW9ucy5yYXcgPz8gZmFsc2U7XG5cbiAgLy8gUmV0dXJuIEJTT05SZWdFeHAgb2JqZWN0cyBpbnN0ZWFkIG9mIG5hdGl2ZSByZWd1bGFyIGV4cHJlc3Npb25zXG4gIGNvbnN0IGJzb25SZWdFeHAgPSBvcHRpb25zLmJzb25SZWdFeHAgPz8gZmFsc2U7XG5cbiAgLy8gQ29udHJvbHMgdGhlIHByb21vdGlvbiBvZiB2YWx1ZXMgdnMgd3JhcHBlciBjbGFzc2VzXG4gIGNvbnN0IHByb21vdGVCdWZmZXJzID0gb3B0aW9ucy5wcm9tb3RlQnVmZmVycyA/PyBmYWxzZTtcbiAgY29uc3QgcHJvbW90ZUxvbmdzID0gb3B0aW9ucy5wcm9tb3RlTG9uZ3MgPz8gdHJ1ZTtcbiAgY29uc3QgcHJvbW90ZVZhbHVlcyA9IG9wdGlvbnMucHJvbW90ZVZhbHVlcyA/PyB0cnVlO1xuXG4gIC8vIEVuc3VyZXMgZGVmYXVsdCB2YWxpZGF0aW9uIG9wdGlvbiBpZiBub25lIGdpdmVuXG4gIGNvbnN0IHZhbGlkYXRpb24gPSBvcHRpb25zLnZhbGlkYXRpb24gPz8geyB1dGY4OiB0cnVlIH07XG5cbiAgLy8gU2hvd3MgaWYgZ2xvYmFsIHV0Zi04IHZhbGlkYXRpb24gaXMgZW5hYmxlZCBvciBkaXNhYmxlZFxuICBsZXQgZ2xvYmFsVVRGVmFsaWRhdGlvbiA9IHRydWU7XG4gIC8vIFJlZmxlY3RzIHV0Zi04IHZhbGlkYXRpb24gc2V0dGluZyByZWdhcmRsZXNzIG9mIGdsb2JhbCBvciBzcGVjaWZpYyBrZXkgdmFsaWRhdGlvblxuICBsZXQgdmFsaWRhdGlvblNldHRpbmc6IGJvb2xlYW47XG4gIC8vIFNldCBvZiBrZXlzIGVpdGhlciB0byBlbmFibGUgb3IgZGlzYWJsZSB2YWxpZGF0aW9uIG9uXG4gIGNvbnN0IHV0ZjhLZXlzU2V0ID0gbmV3IFNldCgpO1xuXG4gIC8vIENoZWNrIGZvciBib29sZWFuIHVuaWZvcm1pdHkgYW5kIGVtcHR5IHZhbGlkYXRpb24gb3B0aW9uXG4gIGNvbnN0IHV0ZjhWYWxpZGF0ZWRLZXlzID0gdmFsaWRhdGlvbi51dGY4O1xuICBpZiAodHlwZW9mIHV0ZjhWYWxpZGF0ZWRLZXlzID09PSBcImJvb2xlYW5cIikge1xuICAgIHZhbGlkYXRpb25TZXR0aW5nID0gdXRmOFZhbGlkYXRlZEtleXM7XG4gIH0gZWxzZSB7XG4gICAgZ2xvYmFsVVRGVmFsaWRhdGlvbiA9IGZhbHNlO1xuICAgIGNvbnN0IHV0ZjhWYWxpZGF0aW9uVmFsdWVzID0gT2JqZWN0LmtleXModXRmOFZhbGlkYXRlZEtleXMpLm1hcChcbiAgICAgIChrZXkpID0+IHV0ZjhWYWxpZGF0ZWRLZXlzW2tleV0sXG4gICAgKTtcbiAgICBpZiAodXRmOFZhbGlkYXRpb25WYWx1ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiVVRGLTggdmFsaWRhdGlvbiBzZXR0aW5nIGNhbm5vdCBiZSBlbXB0eVwiKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB1dGY4VmFsaWRhdGlvblZhbHVlc1swXSAhPT0gXCJib29sZWFuXCIpIHtcbiAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICAgIFwiSW52YWxpZCBVVEYtOCB2YWxpZGF0aW9uIG9wdGlvbiwgbXVzdCBzcGVjaWZ5IGJvb2xlYW4gdmFsdWVzXCIsXG4gICAgICApO1xuICAgIH1cbiAgICB2YWxpZGF0aW9uU2V0dGluZyA9IHV0ZjhWYWxpZGF0aW9uVmFsdWVzWzBdO1xuICAgIC8vIEVuc3VyZXMgYm9vbGVhbiB1bmlmb3JtaXR5IGluIHV0Zi04IHZhbGlkYXRpb24gKGFsbCB0cnVlIG9yIGFsbCBmYWxzZSlcbiAgICBpZiAoIXV0ZjhWYWxpZGF0aW9uVmFsdWVzLmV2ZXJ5KChpdGVtKSA9PiBpdGVtID09PSB2YWxpZGF0aW9uU2V0dGluZykpIHtcbiAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICAgIFwiSW52YWxpZCBVVEYtOCB2YWxpZGF0aW9uIG9wdGlvbiAtIGtleXMgbXVzdCBiZSBhbGwgdHJ1ZSBvciBhbGwgZmFsc2VcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gQWRkIGtleXMgdG8gc2V0IHRoYXQgd2lsbCBlaXRoZXIgYmUgdmFsaWRhdGVkIG9yIG5vdCBiYXNlZCBvbiB2YWxpZGF0aW9uU2V0dGluZ1xuICBpZiAoIWdsb2JhbFVURlZhbGlkYXRpb24pIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyh1dGY4VmFsaWRhdGVkS2V5cykpIHtcbiAgICAgIHV0ZjhLZXlzU2V0LmFkZChrZXkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNldCB0aGUgc3RhcnQgaW5kZXhcbiAgY29uc3Qgc3RhcnRJbmRleCA9IGluZGV4O1xuXG4gIC8vIFZhbGlkYXRlIHRoYXQgd2UgaGF2ZSBhdCBsZWFzdCA0IGJ5dGVzIG9mIGJ1ZmZlclxuICBpZiAoYnVmZmVyLmxlbmd0aCA8IDUpIHtcbiAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiY29ycnVwdCBic29uIG1lc3NhZ2UgPCA1IGJ5dGVzIGxvbmdcIik7XG4gIH1cblxuICAvLyBSZWFkIHRoZSBkb2N1bWVudCBzaXplXG4gIGNvbnN0IHNpemUgPSBidWZmZXJbaW5kZXgrK10gfCAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8IChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuXG4gIC8vIEVuc3VyZSBidWZmZXIgaXMgdmFsaWQgc2l6ZVxuICBpZiAoc2l6ZSA8IDUgfHwgc2l6ZSA+IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiY29ycnVwdCBic29uIG1lc3NhZ2VcIik7XG4gIH1cblxuICAvLyBDcmVhdGUgaG9sZGluZyBvYmplY3RcbiAgY29uc3Qgb2JqZWN0OiBEb2N1bWVudCA9IGlzQXJyYXkgPyBbXSA6IHt9O1xuICAvLyBVc2VkIGZvciBhcnJheXMgdG8gc2tpcCBoYXZpbmcgdG8gcGVyZm9ybSB1dGY4IGRlY29kaW5nXG4gIGxldCBhcnJheUluZGV4ID0gMDtcbiAgY29uc3QgZG9uZSA9IGZhbHNlO1xuXG4gIGxldCBpc1Bvc3NpYmxlREJSZWYgPSBpc0FycmF5ID8gZmFsc2UgOiBudWxsO1xuXG4gIC8vIFdoaWxlIHdlIGhhdmUgbW9yZSBsZWZ0IGRhdGEgbGVmdCBrZWVwIHBhcnNpbmdcbiAgd2hpbGUgKCFkb25lKSB7XG4gICAgLy8gUmVhZCB0aGUgdHlwZVxuICAgIGNvbnN0IGVsZW1lbnRUeXBlID0gYnVmZmVyW2luZGV4KytdO1xuXG4gICAgLy8gSWYgd2UgZ2V0IGEgemVybyBpdCdzIHRoZSBsYXN0IGJ5dGUsIGV4aXRcbiAgICBpZiAoZWxlbWVudFR5cGUgPT09IDApIGJyZWFrO1xuXG4gICAgLy8gR2V0IHRoZSBzdGFydCBzZWFyY2ggaW5kZXhcbiAgICBsZXQgaSA9IGluZGV4O1xuICAgIC8vIExvY2F0ZSB0aGUgZW5kIG9mIHRoZSBjIHN0cmluZ1xuICAgIHdoaWxlIChidWZmZXJbaV0gIT09IDB4MDAgJiYgaSA8IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgIGkrKztcbiAgICB9XG5cbiAgICAvLyBJZiBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIHRoZSBkb2N1bWVudFxuICAgIGlmIChpID49IGJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiQmFkIEJTT04gRG9jdW1lbnQ6IGlsbGVnYWwgQ1N0cmluZ1wiKTtcbiAgICB9XG5cbiAgICAvLyBSZXByZXNlbnRzIHRoZSBrZXlcbiAgICBjb25zdCBuYW1lID0gaXNBcnJheSA/IGFycmF5SW5kZXgrKyA6IHV0ZjhTbGljZShidWZmZXIsIGluZGV4LCBpKTtcblxuICAgIC8vIHNob3VsZFZhbGlkYXRlS2V5IGlzIHRydWUgaWYgdGhlIGtleSBzaG91bGQgYmUgdmFsaWRhdGVkLCBmYWxzZSBvdGhlcndpc2VcbiAgICBsZXQgc2hvdWxkVmFsaWRhdGVLZXkgPSB0cnVlO1xuICAgIHNob3VsZFZhbGlkYXRlS2V5ID0gZ2xvYmFsVVRGVmFsaWRhdGlvbiB8fCB1dGY4S2V5c1NldC5oYXMobmFtZSlcbiAgICAgID8gdmFsaWRhdGlvblNldHRpbmdcbiAgICAgIDogIXZhbGlkYXRpb25TZXR0aW5nO1xuXG4gICAgaWYgKGlzUG9zc2libGVEQlJlZiAhPT0gZmFsc2UgJiYgKG5hbWUgYXMgc3RyaW5nKVswXSA9PT0gXCIkXCIpIHtcbiAgICAgIGlzUG9zc2libGVEQlJlZiA9IGFsbG93ZWREQlJlZktleXMudGVzdChuYW1lIGFzIHN0cmluZyk7XG4gICAgfVxuICAgIGxldCB2YWx1ZTtcblxuICAgIGluZGV4ID0gaSArIDE7XG5cbiAgICBpZiAoZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLlNUUklORykge1xuICAgICAgY29uc3Qgc3RyaW5nU2l6ZSA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgaWYgKFxuICAgICAgICBzdHJpbmdTaXplIDw9IDAgfHxcbiAgICAgICAgc3RyaW5nU2l6ZSA+IGJ1ZmZlci5sZW5ndGggLSBpbmRleCB8fFxuICAgICAgICBidWZmZXJbaW5kZXggKyBzdHJpbmdTaXplIC0gMV0gIT09IDBcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiYmFkIHN0cmluZyBsZW5ndGggaW4gYnNvblwiKTtcbiAgICAgIH1cbiAgICAgIHZhbHVlID0gZ2V0VmFsaWRhdGVkU3RyaW5nKFxuICAgICAgICBidWZmZXIsXG4gICAgICAgIGluZGV4LFxuICAgICAgICBpbmRleCArIHN0cmluZ1NpemUgLSAxLFxuICAgICAgICBzaG91bGRWYWxpZGF0ZUtleSxcbiAgICAgICk7XG4gICAgICBpbmRleCArPSBzdHJpbmdTaXplO1xuICAgIH0gZWxzZSBpZiAoZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLk9JRCkge1xuICAgICAgY29uc3Qgb2lkID0gbmV3IFVpbnQ4QXJyYXkoMTIpO1xuICAgICAgYnl0ZXNDb3B5KG9pZCwgMCwgYnVmZmVyLCBpbmRleCwgaW5kZXggKyAxMik7XG4gICAgICB2YWx1ZSA9IG5ldyBPYmplY3RJZChvaWQpO1xuICAgICAgaW5kZXggKz0gMTI7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5JTlQgJiYgcHJvbW90ZVZhbHVlcyA9PT0gZmFsc2VcbiAgICApIHtcbiAgICAgIHZhbHVlID0gbmV3IEludDMyKFxuICAgICAgICBidWZmZXJbaW5kZXgrK10gfCAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHwgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpLFxuICAgICAgKTtcbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5JTlQpIHtcbiAgICAgIHZhbHVlID0gYnVmZmVyW2luZGV4KytdIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCA4KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMTYpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAyNCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5OVU1CRVIgJiYgcHJvbW90ZVZhbHVlcyA9PT0gZmFsc2VcbiAgICApIHtcbiAgICAgIHZhbHVlID0gbmV3IERvdWJsZShcbiAgICAgICAgbmV3IERhdGFWaWV3KGJ1ZmZlci5idWZmZXIsIGluZGV4LCA4KS5nZXRGbG9hdDY0KDAsIHRydWUpLFxuICAgICAgKTtcbiAgICAgIGluZGV4ICs9IDg7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuTlVNQkVSKSB7XG4gICAgICB2YWx1ZSA9IG5ldyBEYXRhVmlldyhidWZmZXIuYnVmZmVyLCBpbmRleCwgOCkuZ2V0RmxvYXQ2NCgwLCB0cnVlKTtcbiAgICAgIGluZGV4ICs9IDg7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuREFURSkge1xuICAgICAgY29uc3QgbG93Qml0cyA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgY29uc3QgaGlnaEJpdHMgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcbiAgICAgIHZhbHVlID0gbmV3IERhdGUobmV3IExvbmcobG93Qml0cywgaGlnaEJpdHMpLnRvTnVtYmVyKCkpO1xuICAgIH0gZWxzZSBpZiAoZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLkJPT0xFQU4pIHtcbiAgICAgIGlmIChidWZmZXJbaW5kZXhdICE9PSAwICYmIGJ1ZmZlcltpbmRleF0gIT09IDEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcImlsbGVnYWwgYm9vbGVhbiB0eXBlIHZhbHVlXCIpO1xuICAgICAgfVxuICAgICAgdmFsdWUgPSBidWZmZXJbaW5kZXgrK10gPT09IDE7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuT0JKRUNUKSB7XG4gICAgICBjb25zdCBfaW5kZXggPSBpbmRleDtcbiAgICAgIGNvbnN0IG9iamVjdFNpemUgPSBidWZmZXJbaW5kZXhdIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCArIDFdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCArIDJdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXggKyAzXSA8PCAyNCk7XG4gICAgICBpZiAob2JqZWN0U2l6ZSA8PSAwIHx8IG9iamVjdFNpemUgPiBidWZmZXIubGVuZ3RoIC0gaW5kZXgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcImJhZCBlbWJlZGRlZCBkb2N1bWVudCBsZW5ndGggaW4gYnNvblwiKTtcbiAgICAgIH1cblxuICAgICAgLy8gV2UgaGF2ZSBhIHJhdyB2YWx1ZVxuICAgICAgaWYgKHJhdykge1xuICAgICAgICB2YWx1ZSA9IGJ1ZmZlci5zbGljZShpbmRleCwgaW5kZXggKyBvYmplY3RTaXplKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBvYmplY3RPcHRpb25zID0gb3B0aW9ucztcbiAgICAgICAgaWYgKCFnbG9iYWxVVEZWYWxpZGF0aW9uKSB7XG4gICAgICAgICAgb2JqZWN0T3B0aW9ucyA9IHtcbiAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICB2YWxpZGF0aW9uOiB7IHV0Zjg6IHNob3VsZFZhbGlkYXRlS2V5IH0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZSA9IGRlc2VyaWFsaXplT2JqZWN0KGJ1ZmZlciwgX2luZGV4LCBvYmplY3RPcHRpb25zLCBmYWxzZSk7XG4gICAgICB9XG5cbiAgICAgIGluZGV4ICs9IG9iamVjdFNpemU7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuQVJSQVkpIHtcbiAgICAgIGNvbnN0IF9pbmRleCA9IGluZGV4O1xuICAgICAgY29uc3Qgb2JqZWN0U2l6ZSA9IGJ1ZmZlcltpbmRleF0gfFxuICAgICAgICAoYnVmZmVyW2luZGV4ICsgMV0gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4ICsgMl0gPDwgMTYpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCArIDNdIDw8IDI0KTtcbiAgICAgIGxldCBhcnJheU9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgICAvLyBTdG9wIGluZGV4XG4gICAgICBjb25zdCBzdG9wSW5kZXggPSBpbmRleCArIG9iamVjdFNpemU7XG5cbiAgICAgIC8vIEFsbCBlbGVtZW50cyBvZiBhcnJheSB0byBiZSByZXR1cm5lZCBhcyByYXcgYnNvblxuICAgICAgaWYgKGZpZWxkc0FzUmF3ICYmIGZpZWxkc0FzUmF3W25hbWVdKSB7XG4gICAgICAgIGFycmF5T3B0aW9ucyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IG4gaW4gb3B0aW9ucykge1xuICAgICAgICAgIChcbiAgICAgICAgICAgIGFycmF5T3B0aW9ucyBhcyB7XG4gICAgICAgICAgICAgIFtrZXk6IHN0cmluZ106IERlc2VyaWFsaXplT3B0aW9uc1trZXlvZiBEZXNlcmlhbGl6ZU9wdGlvbnNdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIClbbl0gPSBvcHRpb25zW24gYXMga2V5b2YgRGVzZXJpYWxpemVPcHRpb25zXTtcbiAgICAgICAgfVxuICAgICAgICBhcnJheU9wdGlvbnMucmF3ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghZ2xvYmFsVVRGVmFsaWRhdGlvbikge1xuICAgICAgICBhcnJheU9wdGlvbnMgPSB7XG4gICAgICAgICAgLi4uYXJyYXlPcHRpb25zLFxuICAgICAgICAgIHZhbGlkYXRpb246IHsgdXRmODogc2hvdWxkVmFsaWRhdGVLZXkgfSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHZhbHVlID0gZGVzZXJpYWxpemVPYmplY3QoYnVmZmVyLCBfaW5kZXgsIGFycmF5T3B0aW9ucywgdHJ1ZSk7XG4gICAgICBpbmRleCArPSBvYmplY3RTaXplO1xuXG4gICAgICBpZiAoYnVmZmVyW2luZGV4IC0gMV0gIT09IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcImludmFsaWQgYXJyYXkgdGVybWluYXRvciBieXRlXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGluZGV4ICE9PSBzdG9wSW5kZXgpIHRocm93IG5ldyBCU09ORXJyb3IoXCJjb3JydXB0ZWQgYXJyYXkgYnNvblwiKTtcbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5VTkRFRklORUQpIHtcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAoZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLk5VTEwpIHtcbiAgICAgIHZhbHVlID0gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5MT05HKSB7XG4gICAgICAvLyBVbnBhY2sgdGhlIGxvdyBhbmQgaGlnaCBiaXRzXG4gICAgICBjb25zdCBsb3dCaXRzID0gYnVmZmVyW2luZGV4KytdIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCA4KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMTYpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAyNCk7XG4gICAgICBjb25zdCBoaWdoQml0cyA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgY29uc3QgbG9uZyA9IG5ldyBMb25nKGxvd0JpdHMsIGhpZ2hCaXRzKTtcbiAgICAgIC8vIFByb21vdGUgdGhlIGxvbmcgaWYgcG9zc2libGVcbiAgICAgIGlmIChwcm9tb3RlTG9uZ3MgJiYgcHJvbW90ZVZhbHVlcyA9PT0gdHJ1ZSkge1xuICAgICAgICB2YWx1ZSA9IGxvbmcubGVzc1RoYW5PckVxdWFsKEpTX0lOVF9NQVhfTE9ORykgJiZcbiAgICAgICAgICAgIGxvbmcuZ3JlYXRlclRoYW5PckVxdWFsKEpTX0lOVF9NSU5fTE9ORylcbiAgICAgICAgICA/IGxvbmcudG9OdW1iZXIoKVxuICAgICAgICAgIDogbG9uZztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gbG9uZztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5ERUNJTUFMMTI4KSB7XG4gICAgICAvLyBCdWZmZXIgdG8gY29udGFpbiB0aGUgZGVjaW1hbCBieXRlc1xuICAgICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgICAvLyBDb3B5IHRoZSBuZXh0IDE2IGJ5dGVzIGludG8gdGhlIGJ5dGVzIGJ1ZmZlclxuICAgICAgYnl0ZXNDb3B5KGJ5dGVzLCAwLCBidWZmZXIsIGluZGV4LCBpbmRleCArIDE2KTtcblxuICAgICAgLy8gVXBkYXRlIGluZGV4XG4gICAgICBpbmRleCArPSAxNjtcbiAgICAgIC8vIEFzc2lnbiB0aGUgbmV3IERlY2ltYWwxMjggdmFsdWVcbiAgICAgIGNvbnN0IGRlY2ltYWwxMjggPSBuZXcgRGVjaW1hbDEyOChieXRlcykgYXMgRGVjaW1hbDEyOCB8IHtcbiAgICAgICAgdG9PYmplY3QoKTogdW5rbm93bjtcbiAgICAgIH07XG4gICAgICAvLyBJZiB3ZSBoYXZlIGFuIGFsdGVybmF0aXZlIG1hcHBlciB1c2UgdGhhdFxuICAgICAgdmFsdWUgPVxuICAgICAgICBcInRvT2JqZWN0XCIgaW4gZGVjaW1hbDEyOCAmJiB0eXBlb2YgZGVjaW1hbDEyOC50b09iamVjdCA9PT0gXCJmdW5jdGlvblwiXG4gICAgICAgICAgPyBkZWNpbWFsMTI4LnRvT2JqZWN0KClcbiAgICAgICAgICA6IGRlY2ltYWwxMjg7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuQklOQVJZKSB7XG4gICAgICBsZXQgYmluYXJ5U2l6ZSA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgY29uc3QgdG90YWxCaW5hcnlTaXplID0gYmluYXJ5U2l6ZTtcbiAgICAgIGNvbnN0IHN1YlR5cGUgPSBidWZmZXJbaW5kZXgrK107XG5cbiAgICAgIC8vIERpZCB3ZSBoYXZlIGEgbmVnYXRpdmUgYmluYXJ5IHNpemUsIHRocm93XG4gICAgICBpZiAoYmluYXJ5U2l6ZSA8IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcIk5lZ2F0aXZlIGJpbmFyeSB0eXBlIGVsZW1lbnQgc2l6ZSBmb3VuZFwiKTtcbiAgICAgIH1cblxuICAgICAgLy8gSXMgdGhlIGxlbmd0aCBsb25nZXIgdGhhbiB0aGUgZG9jdW1lbnRcbiAgICAgIGlmIChiaW5hcnlTaXplID4gYnVmZmVyLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcIkJpbmFyeSB0eXBlIHNpemUgbGFyZ2VyIHRoYW4gZG9jdW1lbnQgc2l6ZVwiKTtcbiAgICAgIH1cblxuICAgICAgLy8gRGVjb2RlIGFzIHJhdyBCdWZmZXIgb2JqZWN0IGlmIG9wdGlvbnMgc3BlY2lmaWVzIGl0XG4gICAgICBpZiAoYnVmZmVyLnNsaWNlICE9IG51bGwpIHtcbiAgICAgICAgLy8gSWYgd2UgaGF2ZSBzdWJ0eXBlIDIgc2tpcCB0aGUgNCBieXRlcyBmb3IgdGhlIHNpemVcbiAgICAgICAgaWYgKHN1YlR5cGUgPT09IEJpbmFyeVNpemVzLlNVQlRZUEVfQllURV9BUlJBWSkge1xuICAgICAgICAgIGJpbmFyeVNpemUgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCA4KSB8XG4gICAgICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcbiAgICAgICAgICBpZiAoYmluYXJ5U2l6ZSA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICAgICAgICAgIFwiTmVnYXRpdmUgYmluYXJ5IHR5cGUgZWxlbWVudCBzaXplIGZvdW5kIGZvciBzdWJ0eXBlIDB4MDJcIixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChiaW5hcnlTaXplID4gdG90YWxCaW5hcnlTaXplIC0gNCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcbiAgICAgICAgICAgICAgXCJCaW5hcnkgdHlwZSB3aXRoIHN1YnR5cGUgMHgwMiBjb250YWlucyB0b28gbG9uZyBiaW5hcnkgc2l6ZVwiLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGJpbmFyeVNpemUgPCB0b3RhbEJpbmFyeVNpemUgLSA0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFxuICAgICAgICAgICAgICBcIkJpbmFyeSB0eXBlIHdpdGggc3VidHlwZSAweDAyIGNvbnRhaW5zIHRvbyBzaG9ydCBiaW5hcnkgc2l6ZVwiLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YWx1ZSA9IHByb21vdGVCdWZmZXJzICYmIHByb21vdGVWYWx1ZXNcbiAgICAgICAgICA/IGJ1ZmZlci5zbGljZShpbmRleCwgaW5kZXggKyBiaW5hcnlTaXplKVxuICAgICAgICAgIDogbmV3IEJpbmFyeShidWZmZXIuc2xpY2UoaW5kZXgsIGluZGV4ICsgYmluYXJ5U2l6ZSksIHN1YlR5cGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgX2J1ZmZlciA9IG5ldyBVaW50OEFycmF5KGJpbmFyeVNpemUpO1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIHN1YnR5cGUgMiBza2lwIHRoZSA0IGJ5dGVzIGZvciB0aGUgc2l6ZVxuICAgICAgICBpZiAoc3ViVHlwZSA9PT0gQmluYXJ5U2l6ZXMuU1VCVFlQRV9CWVRFX0FSUkFZKSB7XG4gICAgICAgICAgYmluYXJ5U2l6ZSA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMTYpIHxcbiAgICAgICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgICAgIGlmIChiaW5hcnlTaXplIDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcbiAgICAgICAgICAgICAgXCJOZWdhdGl2ZSBiaW5hcnkgdHlwZSBlbGVtZW50IHNpemUgZm91bmQgZm9yIHN1YnR5cGUgMHgwMlwiLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGJpbmFyeVNpemUgPiB0b3RhbEJpbmFyeVNpemUgLSA0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFxuICAgICAgICAgICAgICBcIkJpbmFyeSB0eXBlIHdpdGggc3VidHlwZSAweDAyIGNvbnRhaW5zIHRvbyBsb25nIGJpbmFyeSBzaXplXCIsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYmluYXJ5U2l6ZSA8IHRvdGFsQmluYXJ5U2l6ZSAtIDQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICAgICAgICAgIFwiQmluYXJ5IHR5cGUgd2l0aCBzdWJ0eXBlIDB4MDIgY29udGFpbnMgdG9vIHNob3J0IGJpbmFyeSBzaXplXCIsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvcHkgdGhlIGRhdGFcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGJpbmFyeVNpemU7IGkrKykge1xuICAgICAgICAgIF9idWZmZXJbaV0gPSBidWZmZXJbaW5kZXggKyBpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhbHVlID0gcHJvbW90ZUJ1ZmZlcnMgJiYgcHJvbW90ZVZhbHVlc1xuICAgICAgICAgID8gX2J1ZmZlclxuICAgICAgICAgIDogbmV3IEJpbmFyeShfYnVmZmVyLCBzdWJUeXBlKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIHRoZSBpbmRleFxuICAgICAgaW5kZXggKz0gYmluYXJ5U2l6ZTtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLlJFR0VYUCAmJiBic29uUmVnRXhwID09PSBmYWxzZVxuICAgICkge1xuICAgICAgLy8gR2V0IHRoZSBzdGFydCBzZWFyY2ggaW5kZXhcbiAgICAgIGkgPSBpbmRleDtcbiAgICAgIC8vIExvY2F0ZSB0aGUgZW5kIG9mIHRoZSBjIHN0cmluZ1xuICAgICAgd2hpbGUgKGJ1ZmZlcltpXSAhPT0gMHgwMCAmJiBpIDwgYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICAvLyBJZiBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIHRoZSBkb2N1bWVudFxuICAgICAgaWYgKGkgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiQmFkIEJTT04gRG9jdW1lbnQ6IGlsbGVnYWwgQ1N0cmluZ1wiKTtcbiAgICAgIH1cbiAgICAgIC8vIFJldHVybiB0aGUgQyBzdHJpbmdcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHV0ZjhTbGljZShidWZmZXIsIGluZGV4LCBpKTtcbiAgICAgIC8vIENyZWF0ZSB0aGUgcmVnZXhwXG4gICAgICBpbmRleCA9IGkgKyAxO1xuXG4gICAgICAvLyBHZXQgdGhlIHN0YXJ0IHNlYXJjaCBpbmRleFxuICAgICAgaSA9IGluZGV4O1xuICAgICAgLy8gTG9jYXRlIHRoZSBlbmQgb2YgdGhlIGMgc3RyaW5nXG4gICAgICB3aGlsZSAoYnVmZmVyW2ldICE9PSAweDAwICYmIGkgPCBidWZmZXIubGVuZ3RoKSB7XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIC8vIElmIGFyZSBhdCB0aGUgZW5kIG9mIHRoZSBidWZmZXIgdGhlcmUgaXMgYSBwcm9ibGVtIHdpdGggdGhlIGRvY3VtZW50XG4gICAgICBpZiAoaSA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXCJCYWQgQlNPTiBEb2N1bWVudDogaWxsZWdhbCBDU3RyaW5nXCIpO1xuICAgICAgfVxuICAgICAgLy8gUmV0dXJuIHRoZSBDIHN0cmluZ1xuICAgICAgY29uc3QgcmVnRXhwT3B0aW9ucyA9IHV0ZjhTbGljZShidWZmZXIsIGluZGV4LCBpKTtcbiAgICAgIGluZGV4ID0gaSArIDE7XG5cbiAgICAgIC8vIEZvciBlYWNoIG9wdGlvbiBhZGQgdGhlIGNvcnJlc3BvbmRpbmcgb25lIGZvciBqYXZhc2NyaXB0XG4gICAgICBjb25zdCBvcHRpb25zQXJyYXkgPSBuZXcgQXJyYXkocmVnRXhwT3B0aW9ucy5sZW5ndGgpO1xuXG4gICAgICAvLyBQYXJzZSBvcHRpb25zXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgcmVnRXhwT3B0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzd2l0Y2ggKHJlZ0V4cE9wdGlvbnNbaV0pIHtcbiAgICAgICAgICBjYXNlIFwibVwiOlxuICAgICAgICAgICAgb3B0aW9uc0FycmF5W2ldID0gXCJtXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIFwic1wiOlxuICAgICAgICAgICAgb3B0aW9uc0FycmF5W2ldID0gXCJnXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIFwiaVwiOlxuICAgICAgICAgICAgb3B0aW9uc0FycmF5W2ldID0gXCJpXCI7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YWx1ZSA9IG5ldyBSZWdFeHAoc291cmNlLCBvcHRpb25zQXJyYXkuam9pbihcIlwiKSk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5SRUdFWFAgJiYgYnNvblJlZ0V4cCA9PT0gdHJ1ZVxuICAgICkge1xuICAgICAgLy8gR2V0IHRoZSBzdGFydCBzZWFyY2ggaW5kZXhcbiAgICAgIGkgPSBpbmRleDtcbiAgICAgIC8vIExvY2F0ZSB0aGUgZW5kIG9mIHRoZSBjIHN0cmluZ1xuICAgICAgd2hpbGUgKGJ1ZmZlcltpXSAhPT0gMHgwMCAmJiBpIDwgYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICAvLyBJZiBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyIHRoZXJlIGlzIGEgcHJvYmxlbSB3aXRoIHRoZSBkb2N1bWVudFxuICAgICAgaWYgKGkgPj0gYnVmZmVyLmxlbmd0aCkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiQmFkIEJTT04gRG9jdW1lbnQ6IGlsbGVnYWwgQ1N0cmluZ1wiKTtcbiAgICAgIH1cbiAgICAgIC8vIFJldHVybiB0aGUgQyBzdHJpbmdcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHV0ZjhTbGljZShidWZmZXIsIGluZGV4LCBpKTtcbiAgICAgIGluZGV4ID0gaSArIDE7XG5cbiAgICAgIC8vIEdldCB0aGUgc3RhcnQgc2VhcmNoIGluZGV4XG4gICAgICBpID0gaW5kZXg7XG4gICAgICAvLyBMb2NhdGUgdGhlIGVuZCBvZiB0aGUgYyBzdHJpbmdcbiAgICAgIHdoaWxlIChidWZmZXJbaV0gIT09IDB4MDAgJiYgaSA8IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgLy8gSWYgYXJlIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciB0aGVyZSBpcyBhIHByb2JsZW0gd2l0aCB0aGUgZG9jdW1lbnRcbiAgICAgIGlmIChpID49IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcIkJhZCBCU09OIERvY3VtZW50OiBpbGxlZ2FsIENTdHJpbmdcIik7XG4gICAgICB9XG4gICAgICAvLyBSZXR1cm4gdGhlIEMgc3RyaW5nXG4gICAgICBjb25zdCByZWdFeHBPcHRpb25zID0gdXRmOFNsaWNlKGJ1ZmZlciwgaW5kZXgsIGkpO1xuICAgICAgaW5kZXggPSBpICsgMTtcblxuICAgICAgLy8gU2V0IHRoZSBvYmplY3RcbiAgICAgIHZhbHVlID0gbmV3IEJTT05SZWdFeHAoc291cmNlLCByZWdFeHBPcHRpb25zKTtcbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5TWU1CT0wpIHtcbiAgICAgIGNvbnN0IHN0cmluZ1NpemUgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcbiAgICAgIGlmIChcbiAgICAgICAgc3RyaW5nU2l6ZSA8PSAwIHx8XG4gICAgICAgIHN0cmluZ1NpemUgPiBidWZmZXIubGVuZ3RoIC0gaW5kZXggfHxcbiAgICAgICAgYnVmZmVyW2luZGV4ICsgc3RyaW5nU2l6ZSAtIDFdICE9PSAwXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcImJhZCBzdHJpbmcgbGVuZ3RoIGluIGJzb25cIik7XG4gICAgICB9XG4gICAgICBjb25zdCBzeW1ib2wgPSBnZXRWYWxpZGF0ZWRTdHJpbmcoXG4gICAgICAgIGJ1ZmZlcixcbiAgICAgICAgaW5kZXgsXG4gICAgICAgIGluZGV4ICsgc3RyaW5nU2l6ZSAtIDEsXG4gICAgICAgIHNob3VsZFZhbGlkYXRlS2V5LFxuICAgICAgKTtcbiAgICAgIHZhbHVlID0gcHJvbW90ZVZhbHVlcyA/IHN5bWJvbCA6IG5ldyBCU09OU3ltYm9sKHN5bWJvbCk7XG4gICAgICBpbmRleCArPSBzdHJpbmdTaXplO1xuICAgIH0gZWxzZSBpZiAoZWxlbWVudFR5cGUgPT09IEJTT05EYXRhLlRJTUVTVEFNUCkge1xuICAgICAgY29uc3QgbG93Qml0cyA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgY29uc3QgaGlnaEJpdHMgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcblxuICAgICAgdmFsdWUgPSBuZXcgVGltZXN0YW1wKG5ldyBMb25nKGxvd0JpdHMsIGhpZ2hCaXRzKSk7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuTUlOX0tFWSkge1xuICAgICAgdmFsdWUgPSBuZXcgTWluS2V5KCk7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuTUFYX0tFWSkge1xuICAgICAgdmFsdWUgPSBuZXcgTWF4S2V5KCk7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuQ09ERSkge1xuICAgICAgY29uc3Qgc3RyaW5nU2l6ZSA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgaWYgKFxuICAgICAgICBzdHJpbmdTaXplIDw9IDAgfHxcbiAgICAgICAgc3RyaW5nU2l6ZSA+IGJ1ZmZlci5sZW5ndGggLSBpbmRleCB8fFxuICAgICAgICBidWZmZXJbaW5kZXggKyBzdHJpbmdTaXplIC0gMV0gIT09IDBcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiYmFkIHN0cmluZyBsZW5ndGggaW4gYnNvblwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZ1bmN0aW9uU3RyaW5nID0gZ2V0VmFsaWRhdGVkU3RyaW5nKFxuICAgICAgICBidWZmZXIsXG4gICAgICAgIGluZGV4LFxuICAgICAgICBpbmRleCArIHN0cmluZ1NpemUgLSAxLFxuICAgICAgICBzaG91bGRWYWxpZGF0ZUtleSxcbiAgICAgICk7XG5cbiAgICAgIC8vIElmIHdlIGFyZSBldmFsdWF0aW5nIHRoZSBmdW5jdGlvbnNcbiAgICAgIGlmIChldmFsRnVuY3Rpb25zKSB7XG4gICAgICAgIC8vIElmIHdlIGhhdmUgY2FjaGUgZW5hYmxlZCBsZXQncyBsb29rIGZvciB0aGUgbWQ1IG9mIHRoZSBmdW5jdGlvbiBpbiB0aGUgY2FjaGVcbiAgICAgICAgdmFsdWUgPSBjYWNoZUZ1bmN0aW9uc1xuICAgICAgICAgID8gaXNvbGF0ZUV2YWwoZnVuY3Rpb25TdHJpbmcsIGZ1bmN0aW9uQ2FjaGUsIG9iamVjdClcbiAgICAgICAgICA6IGlzb2xhdGVFdmFsKGZ1bmN0aW9uU3RyaW5nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gbmV3IENvZGUoZnVuY3Rpb25TdHJpbmcpO1xuICAgICAgfVxuXG4gICAgICAvLyBVcGRhdGUgcGFyc2UgaW5kZXggcG9zaXRpb25cbiAgICAgIGluZGV4ICs9IHN0cmluZ1NpemU7XG4gICAgfSBlbHNlIGlmIChlbGVtZW50VHlwZSA9PT0gQlNPTkRhdGEuQ09ERV9XX1NDT1BFKSB7XG4gICAgICBjb25zdCB0b3RhbFNpemUgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcblxuICAgICAgLy8gRWxlbWVudCBjYW5ub3QgYmUgc2hvcnRlciB0aGFuIHRvdGFsU2l6ZSArIHN0cmluZ1NpemUgKyBkb2N1bWVudFNpemUgKyB0ZXJtaW5hdG9yXG4gICAgICBpZiAodG90YWxTaXplIDwgNCArIDQgKyA0ICsgMSkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFxuICAgICAgICAgIFwiY29kZV93X3Njb3BlIHRvdGFsIHNpemUgc2hvcnRlciBtaW5pbXVtIGV4cGVjdGVkIGxlbmd0aFwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIGNvZGUgc3RyaW5nIHNpemVcbiAgICAgIGNvbnN0IHN0cmluZ1NpemUgPSBidWZmZXJbaW5kZXgrK10gfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcbiAgICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYSB2YWxpZCBzdHJpbmdcbiAgICAgIGlmIChcbiAgICAgICAgc3RyaW5nU2l6ZSA8PSAwIHx8XG4gICAgICAgIHN0cmluZ1NpemUgPiBidWZmZXIubGVuZ3RoIC0gaW5kZXggfHxcbiAgICAgICAgYnVmZmVyW2luZGV4ICsgc3RyaW5nU2l6ZSAtIDFdICE9PSAwXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcImJhZCBzdHJpbmcgbGVuZ3RoIGluIGJzb25cIik7XG4gICAgICB9XG5cbiAgICAgIC8vIEphdmFzY3JpcHQgZnVuY3Rpb25cbiAgICAgIGNvbnN0IGZ1bmN0aW9uU3RyaW5nID0gZ2V0VmFsaWRhdGVkU3RyaW5nKFxuICAgICAgICBidWZmZXIsXG4gICAgICAgIGluZGV4LFxuICAgICAgICBpbmRleCArIHN0cmluZ1NpemUgLSAxLFxuICAgICAgICBzaG91bGRWYWxpZGF0ZUtleSxcbiAgICAgICk7XG4gICAgICAvLyBVcGRhdGUgcGFyc2UgaW5kZXggcG9zaXRpb25cbiAgICAgIGluZGV4ICs9IHN0cmluZ1NpemU7XG4gICAgICAvLyBQYXJzZSB0aGUgZWxlbWVudFxuICAgICAgY29uc3QgX2luZGV4ID0gaW5kZXg7XG4gICAgICAvLyBEZWNvZGUgdGhlIHNpemUgb2YgdGhlIG9iamVjdCBkb2N1bWVudFxuICAgICAgY29uc3Qgb2JqZWN0U2l6ZSA9IGJ1ZmZlcltpbmRleF0gfFxuICAgICAgICAoYnVmZmVyW2luZGV4ICsgMV0gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4ICsgMl0gPDwgMTYpIHxcbiAgICAgICAgKGJ1ZmZlcltpbmRleCArIDNdIDw8IDI0KTtcbiAgICAgIC8vIERlY29kZSB0aGUgc2NvcGUgb2JqZWN0XG4gICAgICBjb25zdCBzY29wZU9iamVjdCA9IGRlc2VyaWFsaXplT2JqZWN0KGJ1ZmZlciwgX2luZGV4LCBvcHRpb25zLCBmYWxzZSk7XG4gICAgICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gICAgICBpbmRleCArPSBvYmplY3RTaXplO1xuXG4gICAgICAvLyBDaGVjayBpZiBmaWVsZCBsZW5ndGggaXMgdG9vIHNob3J0XG4gICAgICBpZiAodG90YWxTaXplIDwgNCArIDQgKyBvYmplY3RTaXplICsgc3RyaW5nU2l6ZSkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFxuICAgICAgICAgIFwiY29kZV93X3Njb3BlIHRvdGFsIHNpemUgaXMgdG9vIHNob3J0LCB0cnVuY2F0aW5nIHNjb3BlXCIsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIHRvdGFsU2l6ZSBmaWVsZCBpcyB0b28gbG9uZ1xuICAgICAgaWYgKHRvdGFsU2l6ZSA+IDQgKyA0ICsgb2JqZWN0U2l6ZSArIHN0cmluZ1NpemUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcbiAgICAgICAgICBcImNvZGVfd19zY29wZSB0b3RhbCBzaXplIGlzIHRvbyBsb25nLCBjbGlwcyBvdXRlciBkb2N1bWVudFwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB3ZSBhcmUgZXZhbHVhdGluZyB0aGUgZnVuY3Rpb25zXG4gICAgICBpZiAoZXZhbEZ1bmN0aW9ucykge1xuICAgICAgICAvLyBJZiB3ZSBoYXZlIGNhY2hlIGVuYWJsZWQgbGV0J3MgbG9vayBmb3IgdGhlIG1kNSBvZiB0aGUgZnVuY3Rpb24gaW4gdGhlIGNhY2hlXG4gICAgICAgIHZhbHVlID0gY2FjaGVGdW5jdGlvbnNcbiAgICAgICAgICA/IGlzb2xhdGVFdmFsKGZ1bmN0aW9uU3RyaW5nLCBmdW5jdGlvbkNhY2hlLCBvYmplY3QpXG4gICAgICAgICAgOiBpc29sYXRlRXZhbChmdW5jdGlvblN0cmluZyk7XG5cbiAgICAgICAgdmFsdWUuc2NvcGUgPSBzY29wZU9iamVjdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gbmV3IENvZGUoZnVuY3Rpb25TdHJpbmcsIHNjb3BlT2JqZWN0KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGVsZW1lbnRUeXBlID09PSBCU09ORGF0YS5EQlBPSU5URVIpIHtcbiAgICAgIC8vIEdldCB0aGUgY29kZSBzdHJpbmcgc2l6ZVxuICAgICAgY29uc3Qgc3RyaW5nU2l6ZSA9IGJ1ZmZlcltpbmRleCsrXSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8XG4gICAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhIHZhbGlkIHN0cmluZ1xuICAgICAgaWYgKFxuICAgICAgICBzdHJpbmdTaXplIDw9IDAgfHxcbiAgICAgICAgc3RyaW5nU2l6ZSA+IGJ1ZmZlci5sZW5ndGggLSBpbmRleCB8fFxuICAgICAgICBidWZmZXJbaW5kZXggKyBzdHJpbmdTaXplIC0gMV0gIT09IDBcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiYmFkIHN0cmluZyBsZW5ndGggaW4gYnNvblwiKTtcbiAgICAgIH1cbiAgICAgIC8vIE5hbWVzcGFjZVxuICAgICAgaWYgKFxuICAgICAgICB2YWxpZGF0aW9uPy51dGY4ICYmICF2YWxpZGF0ZVV0ZjgoYnVmZmVyLCBpbmRleCwgaW5kZXggKyBzdHJpbmdTaXplIC0gMSlcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiSW52YWxpZCBVVEYtOCBzdHJpbmcgaW4gQlNPTiBkb2N1bWVudFwiKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG5hbWVzcGFjZSA9IHV0ZjhTbGljZShcbiAgICAgICAgYnVmZmVyLFxuICAgICAgICBpbmRleCxcbiAgICAgICAgaW5kZXggKyBzdHJpbmdTaXplIC0gMSxcbiAgICAgICk7XG4gICAgICAvLyBVcGRhdGUgcGFyc2UgaW5kZXggcG9zaXRpb25cbiAgICAgIGluZGV4ICs9IHN0cmluZ1NpemU7XG5cbiAgICAgIC8vIFJlYWQgdGhlIG9pZFxuICAgICAgY29uc3Qgb2lkQnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoMTIpO1xuXG4gICAgICBieXRlc0NvcHkob2lkQnVmZmVyLCAwLCBidWZmZXIsIGluZGV4LCBpbmRleCArIDEyKTtcbiAgICAgIGNvbnN0IG9pZCA9IG5ldyBPYmplY3RJZChvaWRCdWZmZXIpO1xuXG4gICAgICAvLyBVcGRhdGUgdGhlIGluZGV4XG4gICAgICBpbmRleCArPSAxMjtcblxuICAgICAgLy8gVXBncmFkZSB0byBEQlJlZiB0eXBlXG4gICAgICB2YWx1ZSA9IG5ldyBEQlJlZihuYW1lc3BhY2UsIG9pZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBCU09ORXJyb3IoXG4gICAgICAgIGBEZXRlY3RlZCB1bmtub3duIEJTT04gdHlwZSAke2VsZW1lbnRUeXBlLnRvU3RyaW5nKDE2KX1gICtcbiAgICAgICAgICAnIGZvciBmaWVsZG5hbWUgXCInICsgbmFtZSArICdcIicsXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAobmFtZSA9PT0gXCJfX3Byb3RvX19cIikge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iamVjdCwgbmFtZSwge1xuICAgICAgICB2YWx1ZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBvYmplY3RbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBDaGVjayBpZiB0aGUgZGVzZXJpYWxpemF0aW9uIHdhcyBhZ2FpbnN0IGEgdmFsaWQgYXJyYXkvb2JqZWN0XG4gIGlmIChzaXplICE9PSBpbmRleCAtIHN0YXJ0SW5kZXgpIHtcbiAgICBpZiAoaXNBcnJheSkgdGhyb3cgbmV3IEJTT05FcnJvcihcImNvcnJ1cHQgYXJyYXkgYnNvblwiKTtcbiAgICB0aHJvdyBuZXcgQlNPTkVycm9yKFwiY29ycnVwdCBvYmplY3QgYnNvblwiKTtcbiAgfVxuXG4gIC8vIGlmIHdlIGRpZCBub3QgZmluZCBcIiRyZWZcIiwgXCIkaWRcIiwgXCIkZGJcIiwgb3IgZm91bmQgYW4gZXh0cmFuZW91cyAka2V5LCBkb24ndCBtYWtlIGEgREJSZWZcbiAgaWYgKCFpc1Bvc3NpYmxlREJSZWYpIHJldHVybiBvYmplY3Q7XG5cbiAgaWYgKGlzREJSZWZMaWtlKG9iamVjdCkpIHtcbiAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgb2JqZWN0KSBhcyBQYXJ0aWFsPERCUmVmTGlrZT47XG4gICAgZGVsZXRlIGNvcHkuJHJlZjtcbiAgICBkZWxldGUgY29weS4kaWQ7XG4gICAgZGVsZXRlIGNvcHkuJGRiO1xuICAgIHJldHVybiBuZXcgREJSZWYob2JqZWN0LiRyZWYsIG9iamVjdC4kaWQsIG9iamVjdC4kZGIsIGNvcHkpO1xuICB9XG5cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxuLyoqXG4gKiBFbnN1cmUgZXZhbCBpcyBpc29sYXRlZCwgc3RvcmUgdGhlIHJlc3VsdCBpbiBmdW5jdGlvbkNhY2hlLlxuICpcbiAqIEBpbnRlcm5hbFxuICovXG5mdW5jdGlvbiBpc29sYXRlRXZhbChcbiAgZnVuY3Rpb25TdHJpbmc6IHN0cmluZyxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBiYW4tdHlwZXNcbiAgZnVuY3Rpb25DYWNoZT86IHsgW2hhc2g6IHN0cmluZ106IEZ1bmN0aW9uIH0sXG4gIG9iamVjdD86IERvY3VtZW50LFxuKSB7XG4gIGlmICghZnVuY3Rpb25DYWNoZSkgcmV0dXJuIG5ldyBGdW5jdGlvbihmdW5jdGlvblN0cmluZyk7XG4gIC8vIENoZWNrIGZvciBjYWNoZSBoaXQsIGV2YWwgaWYgbWlzc2luZyBhbmQgcmV0dXJuIGNhY2hlZCBmdW5jdGlvblxuICBpZiAoZnVuY3Rpb25DYWNoZVtmdW5jdGlvblN0cmluZ10gPT0gbnVsbCkge1xuICAgIGZ1bmN0aW9uQ2FjaGVbZnVuY3Rpb25TdHJpbmddID0gbmV3IEZ1bmN0aW9uKGZ1bmN0aW9uU3RyaW5nKTtcbiAgfVxuXG4gIC8vIFNldCB0aGUgb2JqZWN0XG4gIHJldHVybiBmdW5jdGlvbkNhY2hlW2Z1bmN0aW9uU3RyaW5nXS5iaW5kKG9iamVjdCk7XG59XG5cbmZ1bmN0aW9uIGdldFZhbGlkYXRlZFN0cmluZyhcbiAgYnVmZmVyOiBVaW50OEFycmF5LFxuICBzdGFydDogbnVtYmVyLFxuICBlbmQ6IG51bWJlcixcbiAgc2hvdWxkVmFsaWRhdGVVdGY4OiBib29sZWFuLFxuKSB7XG4gIGNvbnN0IHZhbHVlID0gdXRmOFNsaWNlKGJ1ZmZlciwgc3RhcnQsIGVuZCk7XG4gIC8vIGlmIHV0ZjggdmFsaWRhdGlvbiBpcyBvbiwgZG8gdGhlIGNoZWNrXG4gIGlmIChzaG91bGRWYWxpZGF0ZVV0ZjgpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWUuY2hhckNvZGVBdChpKSA9PT0gMHhmZl9mZCkge1xuICAgICAgICBpZiAoIXZhbGlkYXRlVXRmOChidWZmZXIsIHN0YXJ0LCBlbmQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEJTT05FcnJvcihcIkludmFsaWQgVVRGLTggc3RyaW5nIGluIEJTT04gZG9jdW1lbnRcIik7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB2YWx1ZTtcbn1cbiJdfQ==