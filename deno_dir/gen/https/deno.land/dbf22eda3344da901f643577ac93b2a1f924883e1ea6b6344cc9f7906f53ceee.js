import { BSONTypeError } from "./error.ts";
import { Long } from "./long.ts";
const PARSE_STRING_REGEXP = /^(\+|-)?(\d+|(\d*\.\d*))?(E|e)?([-+])?(\d+)?$/;
const PARSE_INF_REGEXP = /^(\+|-)?(Infinity|inf)$/i;
const PARSE_NAN_REGEXP = /^(\+|-)?NaN$/i;
const EXPONENT_MAX = 6111;
const EXPONENT_MIN = -6176;
const EXPONENT_BIAS = 6176;
const MAX_DIGITS = 34;
const NAN_BUFFER = [
    0x7c,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
].reverse();
const INF_NEGATIVE_BUFFER = [
    0xf8,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
].reverse();
const INF_POSITIVE_BUFFER = [
    0x78,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
].reverse();
const EXPONENT_REGEX = /^([-+])?(\d+)?$/;
const COMBINATION_MASK = 0x1f;
const EXPONENT_MASK = 0x3fff;
const COMBINATION_INFINITY = 30;
const COMBINATION_NAN = 31;
function isDigit(value) {
    return !isNaN(parseInt(value, 10));
}
function divideu128(value) {
    const DIVISOR = Long.fromNumber(1000 * 1000 * 1000);
    let _rem = Long.fromNumber(0);
    if (!value.parts[0] && !value.parts[1] && !value.parts[2] && !value.parts[3]) {
        return { quotient: value, rem: _rem };
    }
    for (let i = 0; i <= 3; i++) {
        _rem = _rem.shiftLeft(32);
        _rem = _rem.add(new Long(value.parts[i], 0));
        value.parts[i] = _rem.div(DIVISOR).low;
        _rem = _rem.modulo(DIVISOR);
    }
    return { quotient: value, rem: _rem };
}
function multiply64x2(left, right) {
    if (!left && !right) {
        return { high: Long.fromNumber(0), low: Long.fromNumber(0) };
    }
    const leftHigh = left.shiftRightUnsigned(32);
    const leftLow = new Long(left.getLowBits(), 0);
    const rightHigh = right.shiftRightUnsigned(32);
    const rightLow = new Long(right.getLowBits(), 0);
    let productHigh = leftHigh.multiply(rightHigh);
    let productMid = leftHigh.multiply(rightLow);
    const productMid2 = leftLow.multiply(rightHigh);
    let productLow = leftLow.multiply(rightLow);
    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
    productMid = new Long(productMid.getLowBits(), 0)
        .add(productMid2)
        .add(productLow.shiftRightUnsigned(32));
    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
    productLow = productMid.shiftLeft(32).add(new Long(productLow.getLowBits(), 0));
    return { high: productHigh, low: productLow };
}
function lessThan(left, right) {
    const uhleft = left.high >>> 0;
    const uhright = right.high >>> 0;
    if (uhleft < uhright) {
        return true;
    }
    if (uhleft === uhright) {
        const ulleft = left.low >>> 0;
        const ulright = right.low >>> 0;
        if (ulleft < ulright)
            return true;
    }
    return false;
}
function invalidErr(string, message) {
    throw new BSONTypeError(`"${string}" is not a valid Decimal128 string - ${message}`);
}
export class Decimal128 {
    bytes;
    constructor(bytes) {
        this.bytes = typeof bytes === "string"
            ? Decimal128.fromString(bytes).bytes
            : bytes;
    }
    static fromString(representation) {
        let isNegative = false;
        let sawRadix = false;
        let foundNonZero = false;
        let significantDigits = 0;
        let nDigitsRead = 0;
        let nDigits = 0;
        let radixPosition = 0;
        let firstNonZero = 0;
        const digits = [0];
        let nDigitsStored = 0;
        let digitsInsert = 0;
        let firstDigit = 0;
        let lastDigit = 0;
        let exponent = 0;
        let i = 0;
        let significandHigh = new Long(0, 0);
        let significandLow = new Long(0, 0);
        let biasedExponent = 0;
        let index = 0;
        if (representation.length >= 7000) {
            throw new BSONTypeError(`${representation} not a valid Decimal128 string`);
        }
        const stringMatch = representation.match(PARSE_STRING_REGEXP);
        const infMatch = representation.match(PARSE_INF_REGEXP);
        const nanMatch = representation.match(PARSE_NAN_REGEXP);
        if ((!stringMatch && !infMatch && !nanMatch) || representation.length === 0) {
            throw new BSONTypeError(`${representation} not a valid Decimal128 string`);
        }
        if (stringMatch) {
            const unsignedNumber = stringMatch[2];
            const e = stringMatch[4];
            const expSign = stringMatch[5];
            const expNumber = stringMatch[6];
            if (e && expNumber === undefined) {
                invalidErr(representation, "missing exponent power");
            }
            if (e && unsignedNumber === undefined) {
                invalidErr(representation, "missing exponent base");
            }
            if (e === undefined && (expSign || expNumber)) {
                invalidErr(representation, "missing e before exponent");
            }
        }
        if (representation[index] === "+" || representation[index] === "-") {
            isNegative = representation[index++] === "-";
        }
        if (!isDigit(representation[index]) && representation[index] !== ".") {
            if (representation[index] === "i" || representation[index] === "I") {
                return new Decimal128(new Uint8Array(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER));
            }
            if (representation[index] === "N") {
                return new Decimal128(new Uint8Array(NAN_BUFFER));
            }
        }
        while (isDigit(representation[index]) || representation[index] === ".") {
            if (representation[index] === ".") {
                if (sawRadix)
                    invalidErr(representation, "contains multiple periods");
                sawRadix = true;
                index += 1;
                continue;
            }
            if (nDigitsStored < 34 && (representation[index] !== "0" || foundNonZero)) {
                if (!foundNonZero) {
                    firstNonZero = nDigitsRead;
                }
                foundNonZero = true;
                digits[digitsInsert++] = parseInt(representation[index], 10);
                nDigitsStored += 1;
            }
            if (foundNonZero)
                nDigits += 1;
            if (sawRadix)
                radixPosition += 1;
            nDigitsRead += 1;
            index += 1;
        }
        if (sawRadix && !nDigitsRead) {
            throw new BSONTypeError(`${representation} not a valid Decimal128 string`);
        }
        if (representation[index] === "e" || representation[index] === "E") {
            const match = representation.substr(++index).match(EXPONENT_REGEX);
            if (!match || !match[2]) {
                return new Decimal128(new Uint8Array(NAN_BUFFER));
            }
            exponent = parseInt(match[0], 10);
            index += match[0].length;
        }
        if (representation[index]) {
            return new Decimal128(new Uint8Array(NAN_BUFFER));
        }
        firstDigit = 0;
        if (!nDigitsStored) {
            firstDigit = 0;
            lastDigit = 0;
            digits[0] = 0;
            nDigits = 1;
            nDigitsStored = 1;
            significantDigits = 0;
        }
        else {
            lastDigit = nDigitsStored - 1;
            significantDigits = nDigits;
            if (significantDigits !== 1) {
                while (digits[firstNonZero + significantDigits - 1] === 0) {
                    significantDigits -= 1;
                }
            }
        }
        exponent = exponent <= radixPosition && radixPosition - exponent > 1 << 14
            ? EXPONENT_MIN
            : exponent - radixPosition;
        while (exponent > EXPONENT_MAX) {
            lastDigit += 1;
            if (lastDigit - firstDigit > MAX_DIGITS) {
                const digitsString = digits.join("");
                if (digitsString.match(/^0+$/)) {
                    exponent = EXPONENT_MAX;
                    break;
                }
                invalidErr(representation, "overflow");
            }
            exponent -= 1;
        }
        while (exponent < EXPONENT_MIN || nDigitsStored < nDigits) {
            if (lastDigit === 0 && significantDigits < nDigitsStored) {
                exponent = EXPONENT_MIN;
                significantDigits = 0;
                break;
            }
            if (nDigitsStored < nDigits) {
                nDigits -= 1;
            }
            else {
                lastDigit -= 1;
            }
            if (exponent < EXPONENT_MAX) {
                exponent += 1;
            }
            else {
                const digitsString = digits.join("");
                if (digitsString.match(/^0+$/)) {
                    exponent = EXPONENT_MAX;
                    break;
                }
                invalidErr(representation, "overflow");
            }
        }
        if (lastDigit - firstDigit + 1 < significantDigits) {
            let endOfString = nDigitsRead;
            if (sawRadix) {
                firstNonZero += 1;
                endOfString += 1;
            }
            if (isNegative) {
                firstNonZero += 1;
                endOfString += 1;
            }
            const roundDigit = parseInt(representation[firstNonZero + lastDigit + 1], 10);
            let roundBit = 0;
            if (roundDigit >= 5) {
                roundBit = 1;
                if (roundDigit === 5) {
                    roundBit = digits[lastDigit] % 2 === 1 ? 1 : 0;
                    for (i = firstNonZero + lastDigit + 2; i < endOfString; i++) {
                        if (parseInt(representation[i], 10)) {
                            roundBit = 1;
                            break;
                        }
                    }
                }
            }
            if (roundBit) {
                let dIdx = lastDigit;
                for (; dIdx >= 0; dIdx--) {
                    if (++digits[dIdx] > 9) {
                        digits[dIdx] = 0;
                        if (dIdx === 0) {
                            if (exponent < EXPONENT_MAX) {
                                exponent += 1;
                                digits[dIdx] = 1;
                            }
                            else {
                                return new Decimal128(new Uint8Array(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER));
                            }
                        }
                    }
                }
            }
        }
        significandHigh = Long.fromNumber(0);
        significandLow = Long.fromNumber(0);
        if (significantDigits === 0) {
            significandHigh = Long.fromNumber(0);
            significandLow = Long.fromNumber(0);
        }
        else if (lastDigit - firstDigit < 17) {
            let dIdx = firstDigit;
            significandLow = Long.fromNumber(digits[dIdx++]);
            significandHigh = new Long(0, 0);
            for (; dIdx <= lastDigit; dIdx++) {
                significandLow = significandLow.multiply(Long.fromNumber(10));
                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
            }
        }
        else {
            let dIdx = firstDigit;
            significandHigh = Long.fromNumber(digits[dIdx++]);
            for (; dIdx <= lastDigit - 17; dIdx++) {
                significandHigh = significandHigh.multiply(Long.fromNumber(10));
                significandHigh = significandHigh.add(Long.fromNumber(digits[dIdx]));
            }
            significandLow = Long.fromNumber(digits[dIdx++]);
            for (; dIdx <= lastDigit; dIdx++) {
                significandLow = significandLow.multiply(Long.fromNumber(10));
                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
            }
        }
        const significand = multiply64x2(significandHigh, Long.fromString("100000000000000000"));
        significand.low = significand.low.add(significandLow);
        if (lessThan(significand.low, significandLow)) {
            significand.high = significand.high.add(Long.fromNumber(1));
        }
        biasedExponent = exponent + EXPONENT_BIAS;
        const dec = { low: Long.fromNumber(0), high: Long.fromNumber(0) };
        if (significand.high.shiftRightUnsigned(49).and(Long.fromNumber(1)).equals(Long.fromNumber(1))) {
            dec.high = dec.high.or(Long.fromNumber(0x3).shiftLeft(61));
            dec.high = dec.high.or(Long.fromNumber(biasedExponent).and(Long.fromNumber(0x3f_ff).shiftLeft(47)));
            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x7f_ff_ff_ff_ff_ff)));
        }
        else {
            dec.high = dec.high.or(Long.fromNumber(biasedExponent & 0x3f_ff).shiftLeft(49));
            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x1_ff_ff_ff_ff_ff_ff)));
        }
        dec.low = significand.low;
        if (isNegative) {
            dec.high = dec.high.or(Long.fromString("9223372036854775808"));
        }
        const buffer = new Uint8Array(16);
        index = 0;
        buffer[index++] = dec.low.low & 0xff;
        buffer[index++] = (dec.low.low >> 8) & 0xff;
        buffer[index++] = (dec.low.low >> 16) & 0xff;
        buffer[index++] = (dec.low.low >> 24) & 0xff;
        buffer[index++] = dec.low.high & 0xff;
        buffer[index++] = (dec.low.high >> 8) & 0xff;
        buffer[index++] = (dec.low.high >> 16) & 0xff;
        buffer[index++] = (dec.low.high >> 24) & 0xff;
        buffer[index++] = dec.high.low & 0xff;
        buffer[index++] = (dec.high.low >> 8) & 0xff;
        buffer[index++] = (dec.high.low >> 16) & 0xff;
        buffer[index++] = (dec.high.low >> 24) & 0xff;
        buffer[index++] = dec.high.high & 0xff;
        buffer[index++] = (dec.high.high >> 8) & 0xff;
        buffer[index++] = (dec.high.high >> 16) & 0xff;
        buffer[index++] = (dec.high.high >> 24) & 0xff;
        return new Decimal128(buffer);
    }
    toString() {
        let biasedExponent;
        let significandDigits = 0;
        const significand = new Array(36);
        for (let i = 0; i < significand.length; i++)
            significand[i] = 0;
        let index = 0;
        let isZero = false;
        let significandMsb;
        let significand128 = {
            parts: [0, 0, 0, 0],
        };
        let j;
        let k;
        const string = [];
        index = 0;
        const buffer = this.bytes;
        const low = buffer[index++] | (buffer[index++] << 8) |
            (buffer[index++] << 16) | (buffer[index++] << 24);
        const midl = buffer[index++] | (buffer[index++] << 8) |
            (buffer[index++] << 16) | (buffer[index++] << 24);
        const midh = buffer[index++] | (buffer[index++] << 8) |
            (buffer[index++] << 16) | (buffer[index++] << 24);
        const high = buffer[index++] | (buffer[index++] << 8) |
            (buffer[index++] << 16) | (buffer[index++] << 24);
        index = 0;
        const dec = {
            low: new Long(low, midl),
            high: new Long(midh, high),
        };
        if (dec.high.lessThan(Long.ZERO)) {
            string.push("-");
        }
        const combination = (high >> 26) & COMBINATION_MASK;
        if (combination >> 3 === 3) {
            if (combination === COMBINATION_INFINITY) {
                return `${string.join("")}Infinity`;
            }
            if (combination === COMBINATION_NAN) {
                return "NaN";
            }
            biasedExponent = (high >> 15) & EXPONENT_MASK;
            significandMsb = 0x08 + ((high >> 14) & 0x01);
        }
        else {
            significandMsb = (high >> 14) & 0x07;
            biasedExponent = (high >> 17) & EXPONENT_MASK;
        }
        const exponent = biasedExponent - EXPONENT_BIAS;
        significand128.parts[0] = (high & 0x3f_ff) +
            ((significandMsb & 0xf) << 14);
        significand128.parts[1] = midh;
        significand128.parts[2] = midl;
        significand128.parts[3] = low;
        if (significand128.parts[0] === 0 &&
            significand128.parts[1] === 0 &&
            significand128.parts[2] === 0 &&
            significand128.parts[3] === 0) {
            isZero = true;
        }
        else {
            for (k = 3; k >= 0; k--) {
                let leastDigits = 0;
                const result = divideu128(significand128);
                significand128 = result.quotient;
                leastDigits = result.rem.low;
                if (!leastDigits)
                    continue;
                for (j = 8; j >= 0; j--) {
                    significand[k * 9 + j] = leastDigits % 10;
                    leastDigits = Math.floor(leastDigits / 10);
                }
            }
        }
        if (isZero) {
            significandDigits = 1;
            significand[index] = 0;
        }
        else {
            significandDigits = 36;
            while (!significand[index]) {
                significandDigits -= 1;
                index += 1;
            }
        }
        const scientificExponent = significandDigits - 1 + exponent;
        if (scientificExponent >= 34 || scientificExponent <= -7 || exponent > 0) {
            if (significandDigits > 34) {
                string.push(`${0}`);
                if (exponent > 0)
                    string.push(`E+${exponent}`);
                else if (exponent < 0)
                    string.push(`E${exponent}`);
                return string.join("");
            }
            string.push(`${significand[index++]}`);
            significandDigits -= 1;
            if (significandDigits) {
                string.push(".");
            }
            for (let i = 0; i < significandDigits; i++) {
                string.push(`${significand[index++]}`);
            }
            string.push("E");
            if (scientificExponent > 0) {
                string.push(`+${scientificExponent}`);
            }
            else {
                string.push(`${scientificExponent}`);
            }
        }
        else {
            if (exponent >= 0) {
                for (let i = 0; i < significandDigits; i++) {
                    string.push(`${significand[index++]}`);
                }
            }
            else {
                let radixPosition = significandDigits + exponent;
                if (radixPosition > 0) {
                    for (let i = 0; i < radixPosition; i++) {
                        string.push(`${significand[index++]}`);
                    }
                }
                else {
                    string.push("0");
                }
                string.push(".");
                while (radixPosition++ < 0) {
                    string.push("0");
                }
                for (let i = 0; i < significandDigits - Math.max(radixPosition - 1, 0); i++) {
                    string.push(`${significand[index++]}`);
                }
            }
        }
        return string.join("");
    }
    [Symbol.for("Deno.customInspect")]() {
        return `new Decimal128("${this.toString()}")`;
    }
    toJSON() {
        return { $numberDecimal: this.toString() };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjaW1hbDEyOC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY2ltYWwxMjgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUMzQyxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRWpDLE1BQU0sbUJBQW1CLEdBQUcsK0NBQStDLENBQUM7QUFDNUUsTUFBTSxnQkFBZ0IsR0FBRywwQkFBMEIsQ0FBQztBQUNwRCxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztBQUV6QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsTUFBTSxZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUM7QUFDM0IsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUd0QixNQUFNLFVBQVUsR0FBRztJQUNqQixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0NBQ0wsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVaLE1BQU0sbUJBQW1CLEdBQUc7SUFDMUIsSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtDQUNMLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDWixNQUFNLG1CQUFtQixHQUFHO0lBQzFCLElBQUk7SUFDSixJQUFJO0lBQ0osSUFBSTtJQUNKLElBQUk7SUFDSixJ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QU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzdDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzlDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBSTlDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQztRQUN0QyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUM3QyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUM5QyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQztRQUU5QyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDdkMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUM7UUFDOUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsR0FB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TSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ2hDLE9BQU8sbUJBQW1CLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDO0lBQ2hELENBQUM7SUFFRCxNQUFNO1FBQ0osT0FBTyxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQztJQUM3QyxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCU09OVHlwZUVycm9yIH0gZnJvbSBcIi4vZXJyb3IudHNcIjtcbmltcG9ydCB7IExvbmcgfSBmcm9tIFwiLi9sb25nLnRzXCI7XG5cbmNvbnN0IFBBUlNFX1NUUklOR19SRUdFWFAgPSAvXihcXCt8LSk/KFxcZCt8KFxcZCpcXC5cXGQqKSk/KEV8ZSk/KFstK10pPyhcXGQrKT8kLztcbmNvbnN0IFBBUlNFX0lORl9SRUdFWFAgPSAvXihcXCt8LSk/KEluZmluaXR5fGluZikkL2k7XG5jb25zdCBQQVJTRV9OQU5fUkVHRVhQID0gL14oXFwrfC0pP05hTiQvaTtcblxuY29uc3QgRVhQT05FTlRfTUFYID0gNjExMTtcbmNvbnN0IEVYUE9ORU5UX01JTiA9IC02MTc2O1xuY29uc3QgRVhQT05FTlRfQklBUyA9IDYxNzY7XG5jb25zdCBNQVhfRElHSVRTID0gMzQ7XG5cbi8vIE5hbiB2YWx1ZSBiaXRzIGFzIDMyIGJpdCB2YWx1ZXMgKGR1ZSB0byBsYWNrIG9mIGxvbmdzKVxuY29uc3QgTkFOX0JVRkZFUiA9IFtcbiAgMHg3YyxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbiAgMHgwMCxcbl0ucmV2ZXJzZSgpO1xuLy8gSW5maW5pdHkgdmFsdWUgYml0cyAzMiBiaXQgdmFsdWVzIChkdWUgdG8gbGFjayBvZiBsb25ncylcbmNvbnN0IElORl9ORUdBVElWRV9CVUZGRVIgPSBbXG4gIDB4ZjgsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG5dLnJldmVyc2UoKTtcbmNvbnN0IElORl9QT1NJVElWRV9CVUZGRVIgPSBbXG4gIDB4NzgsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG4gIDB4MDAsXG5dLnJldmVyc2UoKTtcblxuY29uc3QgRVhQT05FTlRfUkVHRVggPSAvXihbLStdKT8oXFxkKyk/JC87XG5cbi8vIEV4dHJhY3QgbGVhc3Qgc2lnbmlmaWNhbnQgNSBiaXRzXG5jb25zdCBDT01CSU5BVElPTl9NQVNLID0gMHgxZjtcbi8vIEV4dHJhY3QgbGVhc3Qgc2lnbmlmaWNhbnQgMTQgYml0c1xuY29uc3QgRVhQT05FTlRfTUFTSyA9IDB4M2ZmZjtcbi8vIFZhbHVlIG9mIGNvbWJpbmF0aW9uIGZpZWxkIGZvciBJbmZcbmNvbnN0IENPTUJJTkFUSU9OX0lORklOSVRZID0gMzA7XG4vLyBWYWx1ZSBvZiBjb21iaW5hdGlvbiBmaWVsZCBmb3IgTmFOXG5jb25zdCBDT01CSU5BVElPTl9OQU4gPSAzMTtcblxuLy8gRGV0ZWN0IGlmIHRoZSB2YWx1ZSBpcyBhIGRpZ2l0XG5mdW5jdGlvbiBpc0RpZ2l0KHZhbHVlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuICFpc05hTihwYXJzZUludCh2YWx1ZSwgMTApKTtcbn1cblxuLy8gRGl2aWRlIHR3byB1aW50MTI4IHZhbHVlc1xuZnVuY3Rpb24gZGl2aWRldTEyOCh2YWx1ZTogeyBwYXJ0czogW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl0gfSkge1xuICBjb25zdCBESVZJU09SID0gTG9uZy5mcm9tTnVtYmVyKDEwMDAgKiAxMDAwICogMTAwMCk7XG4gIGxldCBfcmVtID0gTG9uZy5mcm9tTnVtYmVyKDApO1xuXG4gIGlmIChcbiAgICAhdmFsdWUucGFydHNbMF0gJiYgIXZhbHVlLnBhcnRzWzFdICYmICF2YWx1ZS5wYXJ0c1syXSAmJiAhdmFsdWUucGFydHNbM11cbiAgKSB7XG4gICAgcmV0dXJuIHsgcXVvdGllbnQ6IHZhbHVlLCByZW06IF9yZW0gfTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDw9IDM7IGkrKykge1xuICAgIC8vIEFkanVzdCByZW1haW5kZXIgdG8gbWF0Y2ggdmFsdWUgb2YgbmV4dCBkaXZpZGVuZFxuICAgIF9yZW0gPSBfcmVtLnNoaWZ0TGVmdCgzMik7XG4gICAgLy8gQWRkIHRoZSBkaXZpZGVkIHRvIF9yZW1cbiAgICBfcmVtID0gX3JlbS5hZGQobmV3IExvbmcodmFsdWUucGFydHNbaV0sIDApKTtcbiAgICB2YWx1ZS5wYXJ0c1tpXSA9IF9yZW0uZGl2KERJVklTT1IpLmxvdztcbiAgICBfcmVtID0gX3JlbS5tb2R1bG8oRElWSVNPUik7XG4gIH1cblxuICByZXR1cm4geyBxdW90aWVudDogdmFsdWUsIHJlbTogX3JlbSB9O1xufVxuXG4vLyBNdWx0aXBseSB0d28gTG9uZyB2YWx1ZXMgYW5kIHJldHVybiB0aGUgMTI4IGJpdCB2YWx1ZVxuZnVuY3Rpb24gbXVsdGlwbHk2NHgyKGxlZnQ6IExvbmcsIHJpZ2h0OiBMb25nKTogeyBoaWdoOiBMb25nOyBsb3c6IExvbmcgfSB7XG4gIGlmICghbGVmdCAmJiAhcmlnaHQpIHtcbiAgICByZXR1cm4geyBoaWdoOiBMb25nLmZyb21OdW1iZXIoMCksIGxvdzogTG9uZy5mcm9tTnVtYmVyKDApIH07XG4gIH1cblxuICBjb25zdCBsZWZ0SGlnaCA9IGxlZnQuc2hpZnRSaWdodFVuc2lnbmVkKDMyKTtcbiAgY29uc3QgbGVmdExvdyA9IG5ldyBMb25nKGxlZnQuZ2V0TG93Qml0cygpLCAwKTtcbiAgY29uc3QgcmlnaHRIaWdoID0gcmlnaHQuc2hpZnRSaWdodFVuc2lnbmVkKDMyKTtcbiAgY29uc3QgcmlnaHRMb3cgPSBuZXcgTG9uZyhyaWdodC5nZXRMb3dCaXRzKCksIDApO1xuXG4gIGxldCBwcm9kdWN0SGlnaCA9IGxlZnRIaWdoLm11bHRpcGx5KHJpZ2h0SGlnaCk7XG4gIGxldCBwcm9kdWN0TWlkID0gbGVmdEhpZ2gubXVsdGlwbHkocmlnaHRMb3cpO1xuICBjb25zdCBwcm9kdWN0TWlkMiA9IGxlZnRMb3cubXVsdGlwbHkocmlnaHRIaWdoKTtcbiAgbGV0IHByb2R1Y3RMb3cgPSBsZWZ0TG93Lm11bHRpcGx5KHJpZ2h0TG93KTtcblxuICBwcm9kdWN0SGlnaCA9IHByb2R1Y3RIaWdoLmFkZChwcm9kdWN0TWlkLnNoaWZ0UmlnaHRVbnNpZ25lZCgzMikpO1xuICBwcm9kdWN0TWlkID0gbmV3IExvbmcocHJvZHVjdE1pZC5nZXRMb3dCaXRzKCksIDApXG4gICAgLmFkZChwcm9kdWN0TWlkMilcbiAgICAuYWRkKHByb2R1Y3RMb3cuc2hpZnRSaWdodFVuc2lnbmVkKDMyKSk7XG5cbiAgcHJvZHVjdEhpZ2ggPSBwcm9kdWN0SGlnaC5hZGQocHJvZHVjdE1pZC5zaGlmdFJpZ2h0VW5zaWduZWQoMzIpKTtcbiAgcHJvZHVjdExvdyA9IHByb2R1Y3RNaWQuc2hpZnRMZWZ0KDMyKS5hZGQoXG4gICAgbmV3IExvbmcocHJvZHVjdExvdy5nZXRMb3dCaXRzKCksIDApLFxuICApO1xuXG4gIC8vIFJldHVybiB0aGUgMTI4IGJpdCByZXN1bHRcbiAgcmV0dXJuIHsgaGlnaDogcHJvZHVjdEhpZ2gsIGxvdzogcHJvZHVjdExvdyB9O1xufVxuXG5mdW5jdGlvbiBsZXNzVGhhbihsZWZ0OiBMb25nLCByaWdodDogTG9uZyk6IGJvb2xlYW4ge1xuICAvLyBNYWtlIHZhbHVlcyB1bnNpZ25lZFxuICBjb25zdCB1aGxlZnQgPSBsZWZ0LmhpZ2ggPj4+IDA7XG4gIGNvbnN0IHVocmlnaHQgPSByaWdodC5oaWdoID4+PiAwO1xuXG4gIC8vIENvbXBhcmUgaGlnaCBiaXRzIGZpcnN0XG4gIGlmICh1aGxlZnQgPCB1aHJpZ2h0KSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBpZiAodWhsZWZ0ID09PSB1aHJpZ2h0KSB7XG4gICAgY29uc3QgdWxsZWZ0ID0gbGVmdC5sb3cgPj4+IDA7XG4gICAgY29uc3QgdWxyaWdodCA9IHJpZ2h0LmxvdyA+Pj4gMDtcbiAgICBpZiAodWxsZWZ0IDwgdWxyaWdodCkgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGludmFsaWRFcnIoc3RyaW5nOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICBgXCIke3N0cmluZ31cIiBpcyBub3QgYSB2YWxpZCBEZWNpbWFsMTI4IHN0cmluZyAtICR7bWVzc2FnZX1gLFxuICApO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIERlY2ltYWwxMjhFeHRlbmRlZCB7XG4gICRudW1iZXJEZWNpbWFsOiBzdHJpbmc7XG59XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRhdGlvbiBvZiB0aGUgQlNPTiBEZWNpbWFsMTI4IHR5cGUuXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjbGFzcyBEZWNpbWFsMTI4IHtcbiAgcmVhZG9ubHkgYnl0ZXMhOiBVaW50OEFycmF5O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gYnl0ZXMgLSBhIGJ1ZmZlciBjb250YWluaW5nIHRoZSByYXcgRGVjaW1hbDEyOCBieXRlcyBpbiBsaXR0bGUgZW5kaWFuIG9yZGVyLFxuICAgKiAgICAgICAgICAgICAgICBvciBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBhcyByZXR1cm5lZCBieSAudG9TdHJpbmcoKVxuICAgKi9cbiAgY29uc3RydWN0b3IoYnl0ZXM6IFVpbnQ4QXJyYXkgfCBzdHJpbmcpIHtcbiAgICB0aGlzLmJ5dGVzID0gdHlwZW9mIGJ5dGVzID09PSBcInN0cmluZ1wiXG4gICAgICA/IERlY2ltYWwxMjguZnJvbVN0cmluZyhieXRlcykuYnl0ZXNcbiAgICAgIDogYnl0ZXM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgRGVjaW1hbDEyOCBpbnN0YW5jZSBmcm9tIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uXG4gICAqXG4gICAqIEBwYXJhbSByZXByZXNlbnRhdGlvbiAtIGEgbnVtZXJpYyBzdHJpbmcgcmVwcmVzZW50YXRpb24uXG4gICAqL1xuICBzdGF0aWMgZnJvbVN0cmluZyhyZXByZXNlbnRhdGlvbjogc3RyaW5nKTogRGVjaW1hbDEyOCB7XG4gICAgLy8gUGFyc2Ugc3RhdGUgdHJhY2tpbmdcbiAgICBsZXQgaXNOZWdhdGl2ZSA9IGZhbHNlO1xuICAgIGxldCBzYXdSYWRpeCA9IGZhbHNlO1xuICAgIGxldCBmb3VuZE5vblplcm8gPSBmYWxzZTtcblxuICAgIC8vIFRvdGFsIG51bWJlciBvZiBzaWduaWZpY2FudCBkaWdpdHMgKG5vIGxlYWRpbmcgb3IgdHJhaWxpbmcgemVybylcbiAgICBsZXQgc2lnbmlmaWNhbnREaWdpdHMgPSAwO1xuICAgIC8vIFRvdGFsIG51bWJlciBvZiBzaWduaWZpY2FuZCBkaWdpdHMgcmVhZFxuICAgIGxldCBuRGlnaXRzUmVhZCA9IDA7XG4gICAgLy8gVG90YWwgbnVtYmVyIG9mIGRpZ2l0cyAobm8gbGVhZGluZyB6ZXJvcylcbiAgICBsZXQgbkRpZ2l0cyA9IDA7XG4gICAgLy8gVGhlIG51bWJlciBvZiB0aGUgZGlnaXRzIGFmdGVyIHJhZGl4XG4gICAgbGV0IHJhZGl4UG9zaXRpb24gPSAwO1xuICAgIC8vIFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgbm9uLXplcm8gaW4gKnN0cipcbiAgICBsZXQgZmlyc3ROb25aZXJvID0gMDtcblxuICAgIC8vIERpZ2l0cyBBcnJheVxuICAgIGNvbnN0IGRpZ2l0cyA9IFswXTtcbiAgICAvLyBUaGUgbnVtYmVyIG9mIGRpZ2l0cyBpbiBkaWdpdHNcbiAgICBsZXQgbkRpZ2l0c1N0b3JlZCA9IDA7XG4gICAgLy8gSW5zZXJ0aW9uIHBvaW50ZXIgZm9yIGRpZ2l0c1xuICAgIGxldCBkaWdpdHNJbnNlcnQgPSAwO1xuICAgIC8vIFRoZSBpbmRleCBvZiB0aGUgZmlyc3Qgbm9uLXplcm8gZGlnaXRcbiAgICBsZXQgZmlyc3REaWdpdCA9IDA7XG4gICAgLy8gVGhlIGluZGV4IG9mIHRoZSBsYXN0IGRpZ2l0XG4gICAgbGV0IGxhc3REaWdpdCA9IDA7XG5cbiAgICAvLyBFeHBvbmVudFxuICAgIGxldCBleHBvbmVudCA9IDA7XG4gICAgLy8gbG9vcCBpbmRleCBvdmVyIGFycmF5XG4gICAgbGV0IGkgPSAwO1xuICAgIC8vIFRoZSBoaWdoIDE3IGRpZ2l0cyBvZiB0aGUgc2lnbmlmaWNhbmRcbiAgICBsZXQgc2lnbmlmaWNhbmRIaWdoID0gbmV3IExvbmcoMCwgMCk7XG4gICAgLy8gVGhlIGxvdyAxNyBkaWdpdHMgb2YgdGhlIHNpZ25pZmljYW5kXG4gICAgbGV0IHNpZ25pZmljYW5kTG93ID0gbmV3IExvbmcoMCwgMCk7XG4gICAgLy8gVGhlIGJpYXNlZCBleHBvbmVudFxuICAgIGxldCBiaWFzZWRFeHBvbmVudCA9IDA7XG5cbiAgICAvLyBSZWFkIGluZGV4XG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIC8vIE5haXZlbHkgcHJldmVudCBhZ2FpbnN0IFJFRE9TIGF0dGFja3MuXG4gICAgLy8gVE9ETzogaW1wbGVtZW50aW5nIGEgY3VzdG9tIHBhcnNpbmcgZm9yIHRoaXMsIG9yIHJlZmFjdG9yaW5nIHRoZSByZWdleCB3b3VsZCB5aWVsZFxuICAgIC8vICAgICAgIGZ1cnRoZXIgZ2FpbnMuXG4gICAgaWYgKHJlcHJlc2VudGF0aW9uLmxlbmd0aCA+PSA3MDAwKSB7XG4gICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgICAgYCR7cmVwcmVzZW50YXRpb259IG5vdCBhIHZhbGlkIERlY2ltYWwxMjggc3RyaW5nYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gUmVzdWx0c1xuICAgIGNvbnN0IHN0cmluZ01hdGNoID0gcmVwcmVzZW50YXRpb24ubWF0Y2goUEFSU0VfU1RSSU5HX1JFR0VYUCk7XG4gICAgY29uc3QgaW5mTWF0Y2ggPSByZXByZXNlbnRhdGlvbi5tYXRjaChQQVJTRV9JTkZfUkVHRVhQKTtcbiAgICBjb25zdCBuYW5NYXRjaCA9IHJlcHJlc2VudGF0aW9uLm1hdGNoKFBBUlNFX05BTl9SRUdFWFApO1xuXG4gICAgLy8gVmFsaWRhdGUgdGhlIHN0cmluZ1xuICAgIGlmIChcbiAgICAgICghc3RyaW5nTWF0Y2ggJiYgIWluZk1hdGNoICYmICFuYW5NYXRjaCkgfHwgcmVwcmVzZW50YXRpb24ubGVuZ3RoID09PSAwXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgQlNPTlR5cGVFcnJvcihcbiAgICAgICAgYCR7cmVwcmVzZW50YXRpb259IG5vdCBhIHZhbGlkIERlY2ltYWwxMjggc3RyaW5nYCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHN0cmluZ01hdGNoKSB7XG4gICAgICAvLyBmdWxsX21hdGNoID0gc3RyaW5nTWF0Y2hbMF1cbiAgICAgIC8vIHNpZ24gPSBzdHJpbmdNYXRjaFsxXVxuXG4gICAgICBjb25zdCB1bnNpZ25lZE51bWJlciA9IHN0cmluZ01hdGNoWzJdO1xuICAgICAgLy8gc3RyaW5nTWF0Y2hbM10gaXMgdW5kZWZpbmVkIGlmIGEgd2hvbGUgbnVtYmVyIChleCBcIjFcIiwgMTJcIilcbiAgICAgIC8vIGJ1dCBkZWZpbmVkIGlmIGEgbnVtYmVyIHcvIGRlY2ltYWwgaW4gaXQgKGV4IFwiMS4wLCAxMi4yXCIpXG5cbiAgICAgIGNvbnN0IGUgPSBzdHJpbmdNYXRjaFs0XTtcbiAgICAgIGNvbnN0IGV4cFNpZ24gPSBzdHJpbmdNYXRjaFs1XTtcbiAgICAgIGNvbnN0IGV4cE51bWJlciA9IHN0cmluZ01hdGNoWzZdO1xuXG4gICAgICAvLyB0aGV5IHByb3ZpZGVkIGUsIGJ1dCBkaWRuJ3QgZ2l2ZSBhbiBleHBvbmVudCBudW1iZXIuIGZvciBleCBcIjFlXCJcbiAgICAgIGlmIChlICYmIGV4cE51bWJlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGludmFsaWRFcnIocmVwcmVzZW50YXRpb24sIFwibWlzc2luZyBleHBvbmVudCBwb3dlclwiKTtcbiAgICAgIH1cblxuICAgICAgLy8gdGhleSBwcm92aWRlZCBlLCBidXQgZGlkbid0IGdpdmUgYSBudW1iZXIgYmVmb3JlIGl0LiBmb3IgZXggXCJlMVwiXG4gICAgICBpZiAoZSAmJiB1bnNpZ25lZE51bWJlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGludmFsaWRFcnIocmVwcmVzZW50YXRpb24sIFwibWlzc2luZyBleHBvbmVudCBiYXNlXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZSA9PT0gdW5kZWZpbmVkICYmIChleHBTaWduIHx8IGV4cE51bWJlcikpIHtcbiAgICAgICAgaW52YWxpZEVycihyZXByZXNlbnRhdGlvbiwgXCJtaXNzaW5nIGUgYmVmb3JlIGV4cG9uZW50XCIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEdldCB0aGUgbmVnYXRpdmUgb3IgcG9zaXRpdmUgc2lnblxuICAgIGlmIChyZXByZXNlbnRhdGlvbltpbmRleF0gPT09IFwiK1wiIHx8IHJlcHJlc2VudGF0aW9uW2luZGV4XSA9PT0gXCItXCIpIHtcbiAgICAgIGlzTmVnYXRpdmUgPSByZXByZXNlbnRhdGlvbltpbmRleCsrXSA9PT0gXCItXCI7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdXNlciBwYXNzZWQgSW5maW5pdHkgb3IgTmFOXG4gICAgaWYgKCFpc0RpZ2l0KHJlcHJlc2VudGF0aW9uW2luZGV4XSkgJiYgcmVwcmVzZW50YXRpb25baW5kZXhdICE9PSBcIi5cIikge1xuICAgICAgaWYgKHJlcHJlc2VudGF0aW9uW2luZGV4XSA9PT0gXCJpXCIgfHwgcmVwcmVzZW50YXRpb25baW5kZXhdID09PSBcIklcIikge1xuICAgICAgICByZXR1cm4gbmV3IERlY2ltYWwxMjgoXG4gICAgICAgICAgbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICBpc05lZ2F0aXZlID8gSU5GX05FR0FUSVZFX0JVRkZFUiA6IElORl9QT1NJVElWRV9CVUZGRVIsXG4gICAgICAgICAgKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXByZXNlbnRhdGlvbltpbmRleF0gPT09IFwiTlwiKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVjaW1hbDEyOChuZXcgVWludDhBcnJheShOQU5fQlVGRkVSKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVhZCBhbGwgdGhlIGRpZ2l0c1xuICAgIHdoaWxlIChpc0RpZ2l0KHJlcHJlc2VudGF0aW9uW2luZGV4XSkgfHwgcmVwcmVzZW50YXRpb25baW5kZXhdID09PSBcIi5cIikge1xuICAgICAgaWYgKHJlcHJlc2VudGF0aW9uW2luZGV4XSA9PT0gXCIuXCIpIHtcbiAgICAgICAgaWYgKHNhd1JhZGl4KSBpbnZhbGlkRXJyKHJlcHJlc2VudGF0aW9uLCBcImNvbnRhaW5zIG11bHRpcGxlIHBlcmlvZHNcIik7XG5cbiAgICAgICAgc2F3UmFkaXggPSB0cnVlO1xuICAgICAgICBpbmRleCArPSAxO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBuRGlnaXRzU3RvcmVkIDwgMzQgJiYgKHJlcHJlc2VudGF0aW9uW2luZGV4XSAhPT0gXCIwXCIgfHwgZm91bmROb25aZXJvKVxuICAgICAgKSB7XG4gICAgICAgIGlmICghZm91bmROb25aZXJvKSB7XG4gICAgICAgICAgZmlyc3ROb25aZXJvID0gbkRpZ2l0c1JlYWQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3VuZE5vblplcm8gPSB0cnVlO1xuXG4gICAgICAgIC8vIE9ubHkgc3RvcmUgMzQgZGlnaXRzXG4gICAgICAgIGRpZ2l0c1tkaWdpdHNJbnNlcnQrK10gPSBwYXJzZUludChyZXByZXNlbnRhdGlvbltpbmRleF0sIDEwKTtcbiAgICAgICAgbkRpZ2l0c1N0b3JlZCArPSAxO1xuICAgICAgfVxuXG4gICAgICBpZiAoZm91bmROb25aZXJvKSBuRGlnaXRzICs9IDE7XG4gICAgICBpZiAoc2F3UmFkaXgpIHJhZGl4UG9zaXRpb24gKz0gMTtcblxuICAgICAgbkRpZ2l0c1JlYWQgKz0gMTtcbiAgICAgIGluZGV4ICs9IDE7XG4gICAgfVxuXG4gICAgaWYgKHNhd1JhZGl4ICYmICFuRGlnaXRzUmVhZCkge1xuICAgICAgdGhyb3cgbmV3IEJTT05UeXBlRXJyb3IoXG4gICAgICAgIGAke3JlcHJlc2VudGF0aW9ufSBub3QgYSB2YWxpZCBEZWNpbWFsMTI4IHN0cmluZ2AsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFJlYWQgZXhwb25lbnQgaWYgZXhpc3RzXG4gICAgaWYgKHJlcHJlc2VudGF0aW9uW2luZGV4XSA9PT0gXCJlXCIgfHwgcmVwcmVzZW50YXRpb25baW5kZXhdID09PSBcIkVcIikge1xuICAgICAgLy8gUmVhZCBleHBvbmVudCBkaWdpdHNcbiAgICAgIGNvbnN0IG1hdGNoID0gcmVwcmVzZW50YXRpb24uc3Vic3RyKCsraW5kZXgpLm1hdGNoKEVYUE9ORU5UX1JFR0VYKTtcblxuICAgICAgLy8gTm8gZGlnaXRzIHJlYWRcbiAgICAgIGlmICghbWF0Y2ggfHwgIW1hdGNoWzJdKSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVjaW1hbDEyOChuZXcgVWludDhBcnJheShOQU5fQlVGRkVSKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdldCBleHBvbmVudFxuICAgICAgZXhwb25lbnQgPSBwYXJzZUludChtYXRjaFswXSwgMTApO1xuXG4gICAgICAvLyBBZGp1c3QgdGhlIGluZGV4XG4gICAgICBpbmRleCArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIG5vdCBhIG51bWJlclxuICAgIGlmIChyZXByZXNlbnRhdGlvbltpbmRleF0pIHtcbiAgICAgIHJldHVybiBuZXcgRGVjaW1hbDEyOChuZXcgVWludDhBcnJheShOQU5fQlVGRkVSKSk7XG4gICAgfVxuXG4gICAgLy8gRG9uZSByZWFkaW5nIGlucHV0XG4gICAgLy8gRmluZCBmaXJzdCBub24temVybyBkaWdpdCBpbiBkaWdpdHNcbiAgICBmaXJzdERpZ2l0ID0gMDtcblxuICAgIGlmICghbkRpZ2l0c1N0b3JlZCkge1xuICAgICAgZmlyc3REaWdpdCA9IDA7XG4gICAgICBsYXN0RGlnaXQgPSAwO1xuICAgICAgZGlnaXRzWzBdID0gMDtcbiAgICAgIG5EaWdpdHMgPSAxO1xuICAgICAgbkRpZ2l0c1N0b3JlZCA9IDE7XG4gICAgICBzaWduaWZpY2FudERpZ2l0cyA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxhc3REaWdpdCA9IG5EaWdpdHNTdG9yZWQgLSAxO1xuICAgICAgc2lnbmlmaWNhbnREaWdpdHMgPSBuRGlnaXRzO1xuICAgICAgaWYgKHNpZ25pZmljYW50RGlnaXRzICE9PSAxKSB7XG4gICAgICAgIHdoaWxlIChkaWdpdHNbZmlyc3ROb25aZXJvICsgc2lnbmlmaWNhbnREaWdpdHMgLSAxXSA9PT0gMCkge1xuICAgICAgICAgIHNpZ25pZmljYW50RGlnaXRzIC09IDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBOb3JtYWxpemF0aW9uIG9mIGV4cG9uZW50XG4gICAgLy8gQ29ycmVjdCBleHBvbmVudCBiYXNlZCBvbiByYWRpeCBwb3NpdGlvbiwgYW5kIHNoaWZ0IHNpZ25pZmljYW5kIGFzIG5lZWRlZFxuICAgIC8vIHRvIHJlcHJlc2VudCB1c2VyIGlucHV0XG5cbiAgICAvLyBPdmVyZmxvdyBwcmV2ZW50aW9uXG4gICAgZXhwb25lbnQgPSBleHBvbmVudCA8PSByYWRpeFBvc2l0aW9uICYmIHJhZGl4UG9zaXRpb24gLSBleHBvbmVudCA+IDEgPDwgMTRcbiAgICAgID8gRVhQT05FTlRfTUlOXG4gICAgICA6IGV4cG9uZW50IC0gcmFkaXhQb3NpdGlvbjtcblxuICAgIC8vIEF0dGVtcHQgdG8gbm9ybWFsaXplIHRoZSBleHBvbmVudFxuICAgIHdoaWxlIChleHBvbmVudCA+IEVYUE9ORU5UX01BWCkge1xuICAgICAgLy8gU2hpZnQgZXhwb25lbnQgdG8gc2lnbmlmaWNhbmQgYW5kIGRlY3JlYXNlXG4gICAgICBsYXN0RGlnaXQgKz0gMTtcblxuICAgICAgaWYgKGxhc3REaWdpdCAtIGZpcnN0RGlnaXQgPiBNQVhfRElHSVRTKSB7XG4gICAgICAgIC8vIENoZWNrIGlmIHdlIGhhdmUgYSB6ZXJvIHRoZW4ganVzdCBoYXJkIGNsYW1wLCBvdGhlcndpc2UgZmFpbFxuICAgICAgICBjb25zdCBkaWdpdHNTdHJpbmcgPSBkaWdpdHMuam9pbihcIlwiKTtcbiAgICAgICAgaWYgKGRpZ2l0c1N0cmluZy5tYXRjaCgvXjArJC8pKSB7XG4gICAgICAgICAgZXhwb25lbnQgPSBFWFBPTkVOVF9NQVg7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBpbnZhbGlkRXJyKHJlcHJlc2VudGF0aW9uLCBcIm92ZXJmbG93XCIpO1xuICAgICAgfVxuICAgICAgZXhwb25lbnQgLT0gMTtcbiAgICB9XG5cbiAgICB3aGlsZSAoZXhwb25lbnQgPCBFWFBPTkVOVF9NSU4gfHwgbkRpZ2l0c1N0b3JlZCA8IG5EaWdpdHMpIHtcbiAgICAgIC8vIFNoaWZ0IGxhc3QgZGlnaXQuIGNhbiBvbmx5IGRvIHRoaXMgaWYgPCBzaWduaWZpY2FudCBkaWdpdHMgdGhhbiAjIHN0b3JlZC5cbiAgICAgIGlmIChsYXN0RGlnaXQgPT09IDAgJiYgc2lnbmlmaWNhbnREaWdpdHMgPCBuRGlnaXRzU3RvcmVkKSB7XG4gICAgICAgIGV4cG9uZW50ID0gRVhQT05FTlRfTUlOO1xuICAgICAgICBzaWduaWZpY2FudERpZ2l0cyA9IDA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAobkRpZ2l0c1N0b3JlZCA8IG5EaWdpdHMpIHtcbiAgICAgICAgLy8gYWRqdXN0IHRvIG1hdGNoIGRpZ2l0cyBub3Qgc3RvcmVkXG4gICAgICAgIG5EaWdpdHMgLT0gMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFkanVzdCB0byByb3VuZFxuICAgICAgICBsYXN0RGlnaXQgLT0gMTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV4cG9uZW50IDwgRVhQT05FTlRfTUFYKSB7XG4gICAgICAgIGV4cG9uZW50ICs9IDE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGEgemVybyB0aGVuIGp1c3QgaGFyZCBjbGFtcCwgb3RoZXJ3aXNlIGZhaWxcbiAgICAgICAgY29uc3QgZGlnaXRzU3RyaW5nID0gZGlnaXRzLmpvaW4oXCJcIik7XG4gICAgICAgIGlmIChkaWdpdHNTdHJpbmcubWF0Y2goL14wKyQvKSkge1xuICAgICAgICAgIGV4cG9uZW50ID0gRVhQT05FTlRfTUFYO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGludmFsaWRFcnIocmVwcmVzZW50YXRpb24sIFwib3ZlcmZsb3dcIik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gUm91bmRcbiAgICAvLyBXZSd2ZSBub3JtYWxpemVkIHRoZSBleHBvbmVudCwgYnV0IG1pZ2h0IHN0aWxsIG5lZWQgdG8gcm91bmQuXG4gICAgaWYgKGxhc3REaWdpdCAtIGZpcnN0RGlnaXQgKyAxIDwgc2lnbmlmaWNhbnREaWdpdHMpIHtcbiAgICAgIGxldCBlbmRPZlN0cmluZyA9IG5EaWdpdHNSZWFkO1xuXG4gICAgICAvLyBJZiB3ZSBoYXZlIHNlZW4gYSByYWRpeCBwb2ludCwgJ3N0cmluZycgaXMgMSBsb25nZXIgdGhhbiB3ZSBoYXZlXG4gICAgICAvLyBkb2N1bWVudGVkIHdpdGggbmRpZ2l0c19yZWFkLCBzbyBpbmMgdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBub256ZXJvXG4gICAgICAvLyBkaWdpdCBhbmQgdGhlIHBvc2l0aW9uIHRoYXQgZGlnaXRzIGFyZSByZWFkIHRvLlxuICAgICAgaWYgKHNhd1JhZGl4KSB7XG4gICAgICAgIGZpcnN0Tm9uWmVybyArPSAxO1xuICAgICAgICBlbmRPZlN0cmluZyArPSAxO1xuICAgICAgfVxuICAgICAgLy8gaWYgbmVnYXRpdmUsIHdlIG5lZWQgdG8gaW5jcmVtZW50IGFnYWluIHRvIGFjY291bnQgZm9yIC0gc2lnbiBhdCBzdGFydC5cbiAgICAgIGlmIChpc05lZ2F0aXZlKSB7XG4gICAgICAgIGZpcnN0Tm9uWmVybyArPSAxO1xuICAgICAgICBlbmRPZlN0cmluZyArPSAxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByb3VuZERpZ2l0ID0gcGFyc2VJbnQoXG4gICAgICAgIHJlcHJlc2VudGF0aW9uW2ZpcnN0Tm9uWmVybyArIGxhc3REaWdpdCArIDFdLFxuICAgICAgICAxMCxcbiAgICAgICk7XG4gICAgICBsZXQgcm91bmRCaXQgPSAwO1xuXG4gICAgICBpZiAocm91bmREaWdpdCA+PSA1KSB7XG4gICAgICAgIHJvdW5kQml0ID0gMTtcbiAgICAgICAgaWYgKHJvdW5kRGlnaXQgPT09IDUpIHtcbiAgICAgICAgICByb3VuZEJpdCA9IGRpZ2l0c1tsYXN0RGlnaXRdICUgMiA9PT0gMSA/IDEgOiAwO1xuICAgICAgICAgIGZvciAoaSA9IGZpcnN0Tm9uWmVybyArIGxhc3REaWdpdCArIDI7IGkgPCBlbmRPZlN0cmluZzsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocGFyc2VJbnQocmVwcmVzZW50YXRpb25baV0sIDEwKSkge1xuICAgICAgICAgICAgICByb3VuZEJpdCA9IDE7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocm91bmRCaXQpIHtcbiAgICAgICAgbGV0IGRJZHggPSBsYXN0RGlnaXQ7XG5cbiAgICAgICAgZm9yICg7IGRJZHggPj0gMDsgZElkeC0tKSB7XG4gICAgICAgICAgaWYgKCsrZGlnaXRzW2RJZHhdID4gOSkge1xuICAgICAgICAgICAgZGlnaXRzW2RJZHhdID0gMDtcblxuICAgICAgICAgICAgLy8gb3ZlcmZsb3dlZCBtb3N0IHNpZ25pZmljYW50IGRpZ2l0XG4gICAgICAgICAgICBpZiAoZElkeCA9PT0gMCkge1xuICAgICAgICAgICAgICBpZiAoZXhwb25lbnQgPCBFWFBPTkVOVF9NQVgpIHtcbiAgICAgICAgICAgICAgICBleHBvbmVudCArPSAxO1xuICAgICAgICAgICAgICAgIGRpZ2l0c1tkSWR4XSA9IDE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBEZWNpbWFsMTI4KFxuICAgICAgICAgICAgICAgICAgbmV3IFVpbnQ4QXJyYXkoXG4gICAgICAgICAgICAgICAgICAgIGlzTmVnYXRpdmUgPyBJTkZfTkVHQVRJVkVfQlVGRkVSIDogSU5GX1BPU0lUSVZFX0JVRkZFUixcbiAgICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEVuY29kZSBzaWduaWZpY2FuZFxuICAgIC8vIFRoZSBoaWdoIDE3IGRpZ2l0cyBvZiB0aGUgc2lnbmlmaWNhbmRcbiAgICBzaWduaWZpY2FuZEhpZ2ggPSBMb25nLmZyb21OdW1iZXIoMCk7XG4gICAgLy8gVGhlIGxvdyAxNyBkaWdpdHMgb2YgdGhlIHNpZ25pZmljYW5kXG4gICAgc2lnbmlmaWNhbmRMb3cgPSBMb25nLmZyb21OdW1iZXIoMCk7XG5cbiAgICAvLyByZWFkIGEgemVyb1xuICAgIGlmIChzaWduaWZpY2FudERpZ2l0cyA9PT0gMCkge1xuICAgICAgc2lnbmlmaWNhbmRIaWdoID0gTG9uZy5mcm9tTnVtYmVyKDApO1xuICAgICAgc2lnbmlmaWNhbmRMb3cgPSBMb25nLmZyb21OdW1iZXIoMCk7XG4gICAgfSBlbHNlIGlmIChsYXN0RGlnaXQgLSBmaXJzdERpZ2l0IDwgMTcpIHtcbiAgICAgIGxldCBkSWR4ID0gZmlyc3REaWdpdDtcbiAgICAgIHNpZ25pZmljYW5kTG93ID0gTG9uZy5mcm9tTnVtYmVyKGRpZ2l0c1tkSWR4KytdKTtcbiAgICAgIHNpZ25pZmljYW5kSGlnaCA9IG5ldyBMb25nKDAsIDApO1xuXG4gICAgICBmb3IgKDsgZElkeCA8PSBsYXN0RGlnaXQ7IGRJZHgrKykge1xuICAgICAgICBzaWduaWZpY2FuZExvdyA9IHNpZ25pZmljYW5kTG93Lm11bHRpcGx5KExvbmcuZnJvbU51bWJlcigxMCkpO1xuICAgICAgICBzaWduaWZpY2FuZExvdyA9IHNpZ25pZmljYW5kTG93LmFkZChMb25nLmZyb21OdW1iZXIoZGlnaXRzW2RJZHhdKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBkSWR4ID0gZmlyc3REaWdpdDtcbiAgICAgIHNpZ25pZmljYW5kSGlnaCA9IExvbmcuZnJvbU51bWJlcihkaWdpdHNbZElkeCsrXSk7XG5cbiAgICAgIGZvciAoOyBkSWR4IDw9IGxhc3REaWdpdCAtIDE3OyBkSWR4KyspIHtcbiAgICAgICAgc2lnbmlmaWNhbmRIaWdoID0gc2lnbmlmaWNhbmRIaWdoLm11bHRpcGx5KExvbmcuZnJvbU51bWJlcigxMCkpO1xuICAgICAgICBzaWduaWZpY2FuZEhpZ2ggPSBzaWduaWZpY2FuZEhpZ2guYWRkKExvbmcuZnJvbU51bWJlcihkaWdpdHNbZElkeF0pKTtcbiAgICAgIH1cblxuICAgICAgc2lnbmlmaWNhbmRMb3cgPSBMb25nLmZyb21OdW1iZXIoZGlnaXRzW2RJZHgrK10pO1xuXG4gICAgICBmb3IgKDsgZElkeCA8PSBsYXN0RGlnaXQ7IGRJZHgrKykge1xuICAgICAgICBzaWduaWZpY2FuZExvdyA9IHNpZ25pZmljYW5kTG93Lm11bHRpcGx5KExvbmcuZnJvbU51bWJlcigxMCkpO1xuICAgICAgICBzaWduaWZpY2FuZExvdyA9IHNpZ25pZmljYW5kTG93LmFkZChMb25nLmZyb21OdW1iZXIoZGlnaXRzW2RJZHhdKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qgc2lnbmlmaWNhbmQgPSBtdWx0aXBseTY0eDIoXG4gICAgICBzaWduaWZpY2FuZEhpZ2gsXG4gICAgICBMb25nLmZyb21TdHJpbmcoXCIxMDAwMDAwMDAwMDAwMDAwMDBcIiksXG4gICAgKTtcbiAgICBzaWduaWZpY2FuZC5sb3cgPSBzaWduaWZpY2FuZC5sb3cuYWRkKHNpZ25pZmljYW5kTG93KTtcblxuICAgIGlmIChsZXNzVGhhbihzaWduaWZpY2FuZC5sb3csIHNpZ25pZmljYW5kTG93KSkge1xuICAgICAgc2lnbmlmaWNhbmQuaGlnaCA9IHNpZ25pZmljYW5kLmhpZ2guYWRkKExvbmcuZnJvbU51bWJlcigxKSk7XG4gICAgfVxuXG4gICAgLy8gQmlhc2VkIGV4cG9uZW50XG4gICAgYmlhc2VkRXhwb25lbnQgPSBleHBvbmVudCArIEVYUE9ORU5UX0JJQVM7XG4gICAgY29uc3QgZGVjID0geyBsb3c6IExvbmcuZnJvbU51bWJlcigwKSwgaGlnaDogTG9uZy5mcm9tTnVtYmVyKDApIH07XG5cbiAgICAvLyBFbmNvZGUgY29tYmluYXRpb24sIGV4cG9uZW50LCBhbmQgc2lnbmlmaWNhbmQuXG4gICAgaWYgKFxuICAgICAgc2lnbmlmaWNhbmQuaGlnaC5zaGlmdFJpZ2h0VW5zaWduZWQoNDkpLmFuZChMb25nLmZyb21OdW1iZXIoMSkpLmVxdWFscyhcbiAgICAgICAgTG9uZy5mcm9tTnVtYmVyKDEpLFxuICAgICAgKVxuICAgICkge1xuICAgICAgLy8gRW5jb2RlICcxMScgaW50byBiaXRzIDEgdG8gM1xuICAgICAgZGVjLmhpZ2ggPSBkZWMuaGlnaC5vcihMb25nLmZyb21OdW1iZXIoMHgzKS5zaGlmdExlZnQoNjEpKTtcbiAgICAgIGRlYy5oaWdoID0gZGVjLmhpZ2gub3IoXG4gICAgICAgIExvbmcuZnJvbU51bWJlcihiaWFzZWRFeHBvbmVudCkuYW5kKFxuICAgICAgICAgIExvbmcuZnJvbU51bWJlcigweDNmX2ZmKS5zaGlmdExlZnQoNDcpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAgIGRlYy5oaWdoID0gZGVjLmhpZ2gub3IoXG4gICAgICAgIHNpZ25pZmljYW5kLmhpZ2guYW5kKExvbmcuZnJvbU51bWJlcigweDdmX2ZmX2ZmX2ZmX2ZmX2ZmKSksXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWMuaGlnaCA9IGRlYy5oaWdoLm9yKFxuICAgICAgICBMb25nLmZyb21OdW1iZXIoYmlhc2VkRXhwb25lbnQgJiAweDNmX2ZmKS5zaGlmdExlZnQoNDkpLFxuICAgICAgKTtcbiAgICAgIGRlYy5oaWdoID0gZGVjLmhpZ2gub3IoXG4gICAgICAgIHNpZ25pZmljYW5kLmhpZ2guYW5kKExvbmcuZnJvbU51bWJlcigweDFfZmZfZmZfZmZfZmZfZmZfZmYpKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZGVjLmxvdyA9IHNpZ25pZmljYW5kLmxvdztcblxuICAgIC8vIEVuY29kZSBzaWduXG4gICAgaWYgKGlzTmVnYXRpdmUpIHtcbiAgICAgIGRlYy5oaWdoID0gZGVjLmhpZ2gub3IoTG9uZy5mcm9tU3RyaW5nKFwiOTIyMzM3MjAzNjg1NDc3NTgwOFwiKSk7XG4gICAgfVxuXG4gICAgLy8gRW5jb2RlIGludG8gYSBidWZmZXJcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgaW5kZXggPSAwO1xuXG4gICAgLy8gRW5jb2RlIHRoZSBsb3cgNjQgYml0cyBvZiB0aGUgZGVjaW1hbFxuICAgIC8vIEVuY29kZSBsb3cgYml0c1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IGRlYy5sb3cubG93ICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAoZGVjLmxvdy5sb3cgPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMubG93LmxvdyA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMubG93LmxvdyA+PiAyNCkgJiAweGZmO1xuICAgIC8vIEVuY29kZSBoaWdoIGJpdHNcbiAgICBidWZmZXJbaW5kZXgrK10gPSBkZWMubG93LmhpZ2ggJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMubG93LmhpZ2ggPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMubG93LmhpZ2ggPj4gMTYpICYgMHhmZjtcbiAgICBidWZmZXJbaW5kZXgrK10gPSAoZGVjLmxvdy5oaWdoID4+IDI0KSAmIDB4ZmY7XG5cbiAgICAvLyBFbmNvZGUgdGhlIGhpZ2ggNjQgYml0cyBvZiB0aGUgZGVjaW1hbFxuICAgIC8vIEVuY29kZSBsb3cgYml0c1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IGRlYy5oaWdoLmxvdyAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGRlYy5oaWdoLmxvdyA+PiA4KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGRlYy5oaWdoLmxvdyA+PiAxNikgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMuaGlnaC5sb3cgPj4gMjQpICYgMHhmZjtcbiAgICAvLyBFbmNvZGUgaGlnaCBiaXRzXG4gICAgYnVmZmVyW2luZGV4KytdID0gZGVjLmhpZ2guaGlnaCAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGRlYy5oaWdoLmhpZ2ggPj4gOCkgJiAweGZmO1xuICAgIGJ1ZmZlcltpbmRleCsrXSA9IChkZWMuaGlnaC5oaWdoID4+IDE2KSAmIDB4ZmY7XG4gICAgYnVmZmVyW2luZGV4KytdID0gKGRlYy5oaWdoLmhpZ2ggPj4gMjQpICYgMHhmZjtcblxuICAgIC8vIFJldHVybiB0aGUgbmV3IERlY2ltYWwxMjhcbiAgICByZXR1cm4gbmV3IERlY2ltYWwxMjgoYnVmZmVyKTtcbiAgfVxuXG4gIC8qKiBDcmVhdGUgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIHJhdyBEZWNpbWFsMTI4IHZhbHVlICovXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XG4gICAgLy8gTm90ZTogYml0cyBpbiB0aGlzIHJvdXRpbmUgYXJlIHJlZmVycmVkIHRvIHN0YXJ0aW5nIGF0IDAsXG4gICAgLy8gZnJvbSB0aGUgc2lnbiBiaXQsIHRvd2FyZHMgdGhlIGNvZWZmaWNpZW50LlxuXG4gICAgLy8gZGVjb2RlZCBiaWFzZWQgZXhwb25lbnQgKDE0IGJpdHMpXG4gICAgbGV0IGJpYXNlZEV4cG9uZW50O1xuICAgIC8vIHRoZSBudW1iZXIgb2Ygc2lnbmlmaWNhbmQgZGlnaXRzXG4gICAgbGV0IHNpZ25pZmljYW5kRGlnaXRzID0gMDtcbiAgICAvLyB0aGUgYmFzZS0xMCBkaWdpdHMgaW4gdGhlIHNpZ25pZmljYW5kXG4gICAgY29uc3Qgc2lnbmlmaWNhbmQgPSBuZXcgQXJyYXk8bnVtYmVyPigzNik7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaWduaWZpY2FuZC5sZW5ndGg7IGkrKykgc2lnbmlmaWNhbmRbaV0gPSAwO1xuICAgIC8vIHJlYWQgcG9pbnRlciBpbnRvIHNpZ25pZmljYW5kXG4gICAgbGV0IGluZGV4ID0gMDtcblxuICAgIC8vIHRydWUgaWYgdGhlIG51bWJlciBpcyB6ZXJvXG4gICAgbGV0IGlzWmVybyA9IGZhbHNlO1xuXG4gICAgLy8gdGhlIG1vc3Qgc2lnbmlmaWNhbnQgc2lnbmlmaWNhbmQgYml0cyAoNTAtNDYpXG4gICAgbGV0IHNpZ25pZmljYW5kTXNiO1xuICAgIC8vIHRlbXBvcmFyeSBzdG9yYWdlIGZvciBzaWduaWZpY2FuZCBkZWNvZGluZ1xuICAgIGxldCBzaWduaWZpY2FuZDEyODogeyBwYXJ0czogW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl0gfSA9IHtcbiAgICAgIHBhcnRzOiBbMCwgMCwgMCwgMF0sXG4gICAgfTtcbiAgICAvLyBpbmRleGluZyB2YXJpYWJsZXNcbiAgICBsZXQgajtcbiAgICBsZXQgaztcblxuICAgIC8vIE91dHB1dCBzdHJpbmdcbiAgICBjb25zdCBzdHJpbmc6IHN0cmluZ1tdID0gW107XG5cbiAgICAvLyBVbnBhY2sgaW5kZXhcbiAgICBpbmRleCA9IDA7XG5cbiAgICAvLyBCdWZmZXIgcmVmZXJlbmNlXG4gICAgY29uc3QgYnVmZmVyID0gdGhpcy5ieXRlcztcblxuICAgIC8vIFVucGFjayB0aGUgbG93IDY0Yml0cyBpbnRvIGEgbG9uZ1xuICAgIC8vIGJpdHMgOTYgLSAxMjdcbiAgICBjb25zdCBsb3cgPSBidWZmZXJbaW5kZXgrK10gfCAoYnVmZmVyW2luZGV4KytdIDw8IDgpIHxcbiAgICAgIChidWZmZXJbaW5kZXgrK10gPDwgMTYpIHwgKGJ1ZmZlcltpbmRleCsrXSA8PCAyNCk7XG4gICAgLy8gYml0cyA2NCAtIDk1XG4gICAgY29uc3QgbWlkbCA9IGJ1ZmZlcltpbmRleCsrXSB8IChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfCAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcblxuICAgIC8vIFVucGFjayB0aGUgaGlnaCA2NGJpdHMgaW50byBhIGxvbmdcbiAgICAvLyBiaXRzIDMyIC0gNjNcbiAgICBjb25zdCBtaWRoID0gYnVmZmVyW2luZGV4KytdIHwgKGJ1ZmZlcltpbmRleCsrXSA8PCA4KSB8XG4gICAgICAoYnVmZmVyW2luZGV4KytdIDw8IDE2KSB8IChidWZmZXJbaW5kZXgrK10gPDwgMjQpO1xuICAgIC8vIGJpdHMgMCAtIDMxXG4gICAgY29uc3QgaGlnaCA9IGJ1ZmZlcltpbmRleCsrXSB8IChidWZmZXJbaW5kZXgrK10gPDwgOCkgfFxuICAgICAgKGJ1ZmZlcltpbmRleCsrXSA8PCAxNikgfCAoYnVmZmVyW2luZGV4KytdIDw8IDI0KTtcblxuICAgIC8vIFVucGFjayBpbmRleFxuICAgIGluZGV4ID0gMDtcblxuICAgIC8vIENyZWF0ZSB0aGUgc3RhdGUgb2YgdGhlIGRlY2ltYWxcbiAgICBjb25zdCBkZWMgPSB7XG4gICAgICBsb3c6IG5ldyBMb25nKGxvdywgbWlkbCksXG4gICAgICBoaWdoOiBuZXcgTG9uZyhtaWRoLCBoaWdoKSxcbiAgICB9O1xuXG4gICAgaWYgKGRlYy5oaWdoLmxlc3NUaGFuKExvbmcuWkVSTykpIHtcbiAgICAgIHN0cmluZy5wdXNoKFwiLVwiKTtcbiAgICB9XG5cbiAgICAvLyBEZWNvZGUgY29tYmluYXRpb24gZmllbGQgYW5kIGV4cG9uZW50XG4gICAgLy8gYml0cyAxIC0gNVxuICAgIGNvbnN0IGNvbWJpbmF0aW9uID0gKGhpZ2ggPj4gMjYpICYgQ09NQklOQVRJT05fTUFTSztcblxuICAgIGlmIChjb21iaW5hdGlvbiA+PiAzID09PSAzKSB7XG4gICAgICAvLyBDaGVjayBmb3IgJ3NwZWNpYWwnIHZhbHVlc1xuICAgICAgaWYgKGNvbWJpbmF0aW9uID09PSBDT01CSU5BVElPTl9JTkZJTklUWSkge1xuICAgICAgICByZXR1cm4gYCR7c3RyaW5nLmpvaW4oXCJcIil9SW5maW5pdHlgO1xuICAgICAgfVxuICAgICAgaWYgKGNvbWJpbmF0aW9uID09PSBDT01CSU5BVElPTl9OQU4pIHtcbiAgICAgICAgcmV0dXJuIFwiTmFOXCI7XG4gICAgICB9XG4gICAgICBiaWFzZWRFeHBvbmVudCA9IChoaWdoID4+IDE1KSAmIEVYUE9ORU5UX01BU0s7XG4gICAgICBzaWduaWZpY2FuZE1zYiA9IDB4MDggKyAoKGhpZ2ggPj4gMTQpICYgMHgwMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNpZ25pZmljYW5kTXNiID0gKGhpZ2ggPj4gMTQpICYgMHgwNztcbiAgICAgIGJpYXNlZEV4cG9uZW50ID0gKGhpZ2ggPj4gMTcpICYgRVhQT05FTlRfTUFTSztcbiAgICB9XG5cbiAgICAvLyB1bmJpYXNlZCBleHBvbmVudFxuICAgIGNvbnN0IGV4cG9uZW50ID0gYmlhc2VkRXhwb25lbnQgLSBFWFBPTkVOVF9CSUFTO1xuXG4gICAgLy8gQ3JlYXRlIHN0cmluZyBvZiBzaWduaWZpY2FuZCBkaWdpdHNcblxuICAgIC8vIENvbnZlcnQgdGhlIDExNC1iaXQgYmluYXJ5IG51bWJlciByZXByZXNlbnRlZCBieVxuICAgIC8vIChzaWduaWZpY2FuZF9oaWdoLCBzaWduaWZpY2FuZF9sb3cpIHRvIGF0IG1vc3QgMzQgZGVjaW1hbFxuICAgIC8vIGRpZ2l0cyB0aHJvdWdoIG1vZHVsbyBhbmQgZGl2aXNpb24uXG4gICAgc2lnbmlmaWNhbmQxMjgucGFydHNbMF0gPSAoaGlnaCAmIDB4M2ZfZmYpICtcbiAgICAgICgoc2lnbmlmaWNhbmRNc2IgJiAweGYpIDw8IDE0KTtcbiAgICBzaWduaWZpY2FuZDEyOC5wYXJ0c1sxXSA9IG1pZGg7XG4gICAgc2lnbmlmaWNhbmQxMjgucGFydHNbMl0gPSBtaWRsO1xuICAgIHNpZ25pZmljYW5kMTI4LnBhcnRzWzNdID0gbG93O1xuXG4gICAgaWYgKFxuICAgICAgc2lnbmlmaWNhbmQxMjgucGFydHNbMF0gPT09IDAgJiZcbiAgICAgIHNpZ25pZmljYW5kMTI4LnBhcnRzWzFdID09PSAwICYmXG4gICAgICBzaWduaWZpY2FuZDEyOC5wYXJ0c1syXSA9PT0gMCAmJlxuICAgICAgc2lnbmlmaWNhbmQxMjgucGFydHNbM10gPT09IDBcbiAgICApIHtcbiAgICAgIGlzWmVybyA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAoayA9IDM7IGsgPj0gMDsgay0tKSB7XG4gICAgICAgIGxldCBsZWFzdERpZ2l0cyA9IDA7XG4gICAgICAgIC8vIFBlcmZvcm0gdGhlIGRpdmlkZVxuICAgICAgICBjb25zdCByZXN1bHQgPSBkaXZpZGV1MTI4KHNpZ25pZmljYW5kMTI4KTtcbiAgICAgICAgc2lnbmlmaWNhbmQxMjggPSByZXN1bHQucXVvdGllbnQ7XG4gICAgICAgIGxlYXN0RGlnaXRzID0gcmVzdWx0LnJlbS5sb3c7XG5cbiAgICAgICAgLy8gV2Ugbm93IGhhdmUgdGhlIDkgbGVhc3Qgc2lnbmlmaWNhbnQgZGlnaXRzIChpbiBiYXNlIDIpLlxuICAgICAgICAvLyBDb252ZXJ0IGFuZCBvdXRwdXQgdG8gc3RyaW5nLlxuICAgICAgICBpZiAoIWxlYXN0RGlnaXRzKSBjb250aW51ZTtcblxuICAgICAgICBmb3IgKGogPSA4OyBqID49IDA7IGotLSkge1xuICAgICAgICAgIC8vIHNpZ25pZmljYW5kW2sgKiA5ICsgal0gPSBNYXRoLnJvdW5kKGxlYXN0RGlnaXRzICUgMTApO1xuICAgICAgICAgIHNpZ25pZmljYW5kW2sgKiA5ICsgal0gPSBsZWFzdERpZ2l0cyAlIDEwO1xuICAgICAgICAgIC8vIGxlYXN0RGlnaXRzID0gTWF0aC5yb3VuZChsZWFzdERpZ2l0cyAvIDEwKTtcbiAgICAgICAgICBsZWFzdERpZ2l0cyA9IE1hdGguZmxvb3IobGVhc3REaWdpdHMgLyAxMCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPdXRwdXQgZm9ybWF0IG9wdGlvbnM6XG4gICAgLy8gU2NpZW50aWZpYyAtIFstXWQuZGRkRSgrLy0pZGQgb3IgWy1dZEUoKy8tKWRkXG4gICAgLy8gUmVndWxhciAgICAtIGRkZC5kZGRcblxuICAgIGlmIChpc1plcm8pIHtcbiAgICAgIHNpZ25pZmljYW5kRGlnaXRzID0gMTtcbiAgICAgIHNpZ25pZmljYW5kW2luZGV4XSA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNpZ25pZmljYW5kRGlnaXRzID0gMzY7XG4gICAgICB3aGlsZSAoIXNpZ25pZmljYW5kW2luZGV4XSkge1xuICAgICAgICBzaWduaWZpY2FuZERpZ2l0cyAtPSAxO1xuICAgICAgICBpbmRleCArPSAxO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRoZSBleHBvbmVudCBpZiBzY2llbnRpZmljIG5vdGF0aW9uIGlzIHVzZWRcbiAgICBjb25zdCBzY2llbnRpZmljRXhwb25lbnQgPSBzaWduaWZpY2FuZERpZ2l0cyAtIDEgKyBleHBvbmVudDtcblxuICAgIC8vIFRoZSBzY2llbnRpZmljIGV4cG9uZW50IGNoZWNrcyBhcmUgZGljdGF0ZWQgYnkgdGhlIHN0cmluZyBjb252ZXJzaW9uXG4gICAgLy8gc3BlY2lmaWNhdGlvbiBhbmQgYXJlIHNvbWV3aGF0IGFyYml0cmFyeSBjdXRvZmZzLlxuICAgIC8vXG4gICAgLy8gV2UgbXVzdCBjaGVjayBleHBvbmVudCA+IDAsIGJlY2F1c2UgaWYgdGhpcyBpcyB0aGUgY2FzZSwgdGhlIG51bWJlclxuICAgIC8vIGhhcyB0cmFpbGluZyB6ZXJvcy4gIEhvd2V2ZXIsIHdlICpjYW5ub3QqIG91dHB1dCB0aGVzZSB0cmFpbGluZyB6ZXJvcyxcbiAgICAvLyBiZWNhdXNlIGRvaW5nIHNvIHdvdWxkIGNoYW5nZSB0aGUgcHJlY2lzaW9uIG9mIHRoZSB2YWx1ZSwgYW5kIHdvdWxkXG4gICAgLy8gY2hhbmdlIHN0b3JlZCBkYXRhIGlmIHRoZSBzdHJpbmcgY29udmVydGVkIG51bWJlciBpcyByb3VuZCB0cmlwcGVkLlxuICAgIGlmIChcbiAgICAgIHNjaWVudGlmaWNFeHBvbmVudCA+PSAzNCB8fCBzY2llbnRpZmljRXhwb25lbnQgPD0gLTcgfHwgZXhwb25lbnQgPiAwXG4gICAgKSB7XG4gICAgICAvLyBTY2llbnRpZmljIGZvcm1hdFxuXG4gICAgICAvLyBpZiB0aGVyZSBhcmUgdG9vIG1hbnkgc2lnbmlmaWNhbnQgZGlnaXRzLCB3ZSBzaG91bGQganVzdCBiZSB0cmVhdGluZyBudW1iZXJzXG4gICAgICAvLyBhcyArIG9yIC0gMCBhbmQgdXNpbmcgdGhlIG5vbi1zY2llbnRpZmljIGV4cG9uZW50ICh0aGlzIGlzIGZvciB0aGUgXCJpbnZhbGlkXG4gICAgICAvLyByZXByZXNlbnRhdGlvbiBzaG91bGQgYmUgdHJlYXRlZCBhcyAwLy0wXCIgc3BlYyBjYXNlcyBpbiBkZWNpbWFsMTI4LTEuanNvbilcbiAgICAgIGlmIChzaWduaWZpY2FuZERpZ2l0cyA+IDM0KSB7XG4gICAgICAgIHN0cmluZy5wdXNoKGAkezB9YCk7XG4gICAgICAgIGlmIChleHBvbmVudCA+IDApIHN0cmluZy5wdXNoKGBFKyR7ZXhwb25lbnR9YCk7XG4gICAgICAgIGVsc2UgaWYgKGV4cG9uZW50IDwgMCkgc3RyaW5nLnB1c2goYEUke2V4cG9uZW50fWApO1xuICAgICAgICByZXR1cm4gc3RyaW5nLmpvaW4oXCJcIik7XG4gICAgICB9XG5cbiAgICAgIHN0cmluZy5wdXNoKGAke3NpZ25pZmljYW5kW2luZGV4KytdfWApO1xuICAgICAgc2lnbmlmaWNhbmREaWdpdHMgLT0gMTtcblxuICAgICAgaWYgKHNpZ25pZmljYW5kRGlnaXRzKSB7XG4gICAgICAgIHN0cmluZy5wdXNoKFwiLlwiKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaWduaWZpY2FuZERpZ2l0czsgaSsrKSB7XG4gICAgICAgIHN0cmluZy5wdXNoKGAke3NpZ25pZmljYW5kW2luZGV4KytdfWApO1xuICAgICAgfVxuXG4gICAgICAvLyBFeHBvbmVudFxuICAgICAgc3RyaW5nLnB1c2goXCJFXCIpO1xuICAgICAgaWYgKHNjaWVudGlmaWNFeHBvbmVudCA+IDApIHtcbiAgICAgICAgc3RyaW5nLnB1c2goYCske3NjaWVudGlmaWNFeHBvbmVudH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0cmluZy5wdXNoKGAke3NjaWVudGlmaWNFeHBvbmVudH1gKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVndWxhciBmb3JtYXQgd2l0aCBubyBkZWNpbWFsIHBsYWNlXG4gICAgICBpZiAoZXhwb25lbnQgPj0gMCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpZ25pZmljYW5kRGlnaXRzOyBpKyspIHtcbiAgICAgICAgICBzdHJpbmcucHVzaChgJHtzaWduaWZpY2FuZFtpbmRleCsrXX1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHJhZGl4UG9zaXRpb24gPSBzaWduaWZpY2FuZERpZ2l0cyArIGV4cG9uZW50O1xuXG4gICAgICAgIC8vIG5vbi16ZXJvIGRpZ2l0cyBiZWZvcmUgcmFkaXhcbiAgICAgICAgaWYgKHJhZGl4UG9zaXRpb24gPiAwKSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByYWRpeFBvc2l0aW9uOyBpKyspIHtcbiAgICAgICAgICAgIHN0cmluZy5wdXNoKGAke3NpZ25pZmljYW5kW2luZGV4KytdfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdHJpbmcucHVzaChcIjBcIik7XG4gICAgICAgIH1cblxuICAgICAgICBzdHJpbmcucHVzaChcIi5cIik7XG4gICAgICAgIC8vIGFkZCBsZWFkaW5nIHplcm9zIGFmdGVyIHJhZGl4XG4gICAgICAgIHdoaWxlIChyYWRpeFBvc2l0aW9uKysgPCAwKSB7XG4gICAgICAgICAgc3RyaW5nLnB1c2goXCIwXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChcbiAgICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgICAgaSA8IHNpZ25pZmljYW5kRGlnaXRzIC0gTWF0aC5tYXgocmFkaXhQb3NpdGlvbiAtIDEsIDApO1xuICAgICAgICAgIGkrK1xuICAgICAgICApIHtcbiAgICAgICAgICBzdHJpbmcucHVzaChgJHtzaWduaWZpY2FuZFtpbmRleCsrXX1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzdHJpbmcuam9pbihcIlwiKTtcbiAgfVxuXG4gIFtTeW1ib2wuZm9yKFwiRGVuby5jdXN0b21JbnNwZWN0XCIpXSgpOiBzdHJpbmcge1xuICAgIHJldHVybiBgbmV3IERlY2ltYWwxMjgoXCIke3RoaXMudG9TdHJpbmcoKX1cIilgO1xuICB9XG5cbiAgdG9KU09OKCk6IERlY2ltYWwxMjhFeHRlbmRlZCB7XG4gICAgcmV0dXJuIHsgJG51bWJlckRlY2ltYWw6IHRoaXMudG9TdHJpbmcoKSB9O1xuICB9XG59XG4iXX0=