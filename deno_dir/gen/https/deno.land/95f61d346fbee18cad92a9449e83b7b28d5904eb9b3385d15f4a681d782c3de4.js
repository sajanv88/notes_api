import { loadCodePoints } from "./load_code_points.ts";
const { unassigned_code_points, commonly_mapped_to_nothing, non_ASCII_space_characters, prohibited_characters, bidirectional_r_al, bidirectional_l, } = loadCodePoints();
const mapping2space = non_ASCII_space_characters;
const mapping2nothing = commonly_mapped_to_nothing;
function getCodePoint(chr) {
    const codePoint = chr.codePointAt(0);
    if (!codePoint) {
        throw new Error(`unable to encode character ${chr}`);
    }
    return codePoint;
}
function first(x) {
    return x[0];
}
function last(x) {
    return x[x.length - 1];
}
function toCodePoints(input) {
    const codepoints = [];
    const size = input.length;
    for (let i = 0; i < size; i += 1) {
        const before = input.charCodeAt(i);
        if (before >= 0xd800 && before <= 0xdbff && size > i + 1) {
            const next = input.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                codepoints.push((before - 0xd800) * 0x400 + next - 0xdc00 + 0x10000);
                i += 1;
                continue;
            }
        }
        codepoints.push(before);
    }
    return codepoints;
}
export function saslprep(input, opts = {}) {
    if (input === null) {
        throw new TypeError("Input must not be null.");
    }
    if (input.length === 0) {
        return "";
    }
    const mapped_input = toCodePoints(input)
        .map((character) => (mapping2space.get(character) ? 0x20 : character))
        .filter((character) => !mapping2nothing.get(character));
    const normalized_input = String.fromCodePoint
        .apply(null, mapped_input)
        .normalize("NFKC");
    const normalized_map = toCodePoints(normalized_input);
    const hasProhibited = normalized_map.some((character) => prohibited_characters.get(character));
    if (hasProhibited) {
        throw new Error("Prohibited character, see https://tools.ietf.org/html/rfc4013#section-2.3");
    }
    if (!opts.allowUnassigned) {
        const hasUnassigned = normalized_map.some((character) => unassigned_code_points.get(character));
        if (hasUnassigned) {
            throw new Error("Unassigned code point, see https://tools.ietf.org/html/rfc4013#section-2.5");
        }
    }
    const hasBidiRAL = normalized_map.some((character) => bidirectional_r_al.get(character));
    const hasBidiL = normalized_map.some((character) => bidirectional_l.get(character));
    if (hasBidiRAL && hasBidiL) {
        throw new Error("String must not contain RandALCat and LCat at the same time," +
            " see https://tools.ietf.org/html/rfc3454#section-6");
    }
    const isFirstBidiRAL = bidirectional_r_al.get(getCodePoint(first(normalized_input)));
    const isLastBidiRAL = bidirectional_r_al.get(getCodePoint(last(normalized_input)));
    if (hasBidiRAL && !(isFirstBidiRAL && isLastBidiRAL)) {
        throw new Error("Bidirectional RandALCat character must be the first and the last" +
            " character of the string, see https://tools.ietf.org/html/rfc3454#section-6");
    }
    return normalized_input;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibW9kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUtBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUV2RCxNQUFNLEVBQ0osc0JBQXNCLEVBQ3RCLDBCQUEwQixFQUMxQiwwQkFBMEIsRUFDMUIscUJBQXFCLEVBQ3JCLGtCQUFrQixFQUNsQixlQUFlLEdBQ2hCLEdBQUcsY0FBYyxFQUFFLENBQUM7QUFRckIsTUFBTSxhQUFhLEdBQWEsMEJBQTBCLENBQUM7QUFNM0QsTUFBTSxlQUFlLEdBQWEsMEJBQTBCLENBQUM7QUFHN0QsU0FBUyxZQUFZLENBQUMsR0FBVztJQUMvQixNQUFNLFNBQVMsR0FBdUIsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUV6RCxJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsR0FBRyxFQUFFLENBQUMsQ0FBQztLQUN0RDtJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ25CLENBQUM7QUFHRCxTQUFTLEtBQUssQ0FBQyxDQUFNO0lBQ25CLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2QsQ0FBQztBQUdELFNBQVMsSUFBSSxDQUFDLENBQU07SUFDbEIsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6QixDQUFDO0FBTUQsU0FBUyxZQUFZLENBQUMsS0FBYTtJQUNqQyxNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDdEIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUUxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7UUFDaEMsTUFBTSxNQUFNLEdBQVcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUzQyxJQUFJLE1BQU0sSUFBSSxNQUFNLElBQUksTUFBTSxJQUFJLE1BQU0sSUFBSSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN4RCxNQUFNLElBQUksR0FBVyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUU3QyxJQUFJLElBQUksSUFBSSxNQUFNLElBQUksSUFBSSxJQUFJLE1BQU0sRUFBRTtnQkFDcEMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxHQUFHLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQztnQkFDckUsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDUCxTQUFTO2FBQ1Y7U0FDRjtRQUVELFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDekI7SUFFRCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBT0QsTUFBTSxVQUFVLFFBQVEsQ0FBQyxLQUFhLEVBQUUsT0FBd0IsRUFBRTtJQUNoRSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7UUFDbEIsTUFBTSxJQUFJLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0tBQ2hEO0lBRUQsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUN0QixPQUFPLEVBQUUsQ0FBQztLQUNYO0lBR0QsTUFBTSxZQUFZLEdBQWEsWUFBWSxDQUFDLEtBQUssQ0FBQztTQUUvQyxHQUFHLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztTQUVyRSxNQUFNLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBRzFELE1BQU0sZ0JBQWdCLEdBQVcsTUFBTSxDQUFDLGFBQWE7U0FDbEQsS0FBSyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUM7U0FDekIsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRXJCLE1BQU0sY0FBYyxHQUFhLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0lBR2hFLE1BQU0sYUFBYSxHQUFZLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUMvRCxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQ3JDLENBQUM7SUFFRixJQUFJLGFBQWEsRUFBRTtRQUNqQixNQUFNLElBQUksS0FBSyxDQUNiLDJFQUEyRSxDQUM1RSxDQUFDO0tBQ0g7SUFHRCxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRTtRQUN6QixNQUFNLGFBQWEsR0FBWSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FDL0Qsc0JBQXNCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUN0QyxDQUFDO1FBRUYsSUFBSSxhQUFhLEVBQUU7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FDYiw0RUFBNEUsQ0FDN0UsQ0FBQztTQUNIO0tBQ0Y7SUFJRCxNQUFNLFVBQVUsR0FBWSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FDNUQsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUNsQyxDQUFDO0lBRUYsTUFBTSxRQUFRLEdBQVksY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQzFELGVBQWUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQy9CLENBQUM7SUFJRixJQUFJLFVBQVUsSUFBSSxRQUFRLEVBQUU7UUFDMUIsTUFBTSxJQUFJLEtBQUssQ0FDYiw4REFBOEQ7WUFDNUQsb0RBQW9ELENBQ3ZELENBQUM7S0FDSDtJQVFELE1BQU0sY0FBYyxHQUFZLGtCQUFrQixDQUFDLEdBQUcsQ0FDcEQsWUFBWSxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQ3RDLENBQUM7SUFDRixNQUFNLGFBQWEsR0FBWSxrQkFBa0IsQ0FBQyxHQUFHLENBQ25ELFlBQVksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUNyQyxDQUFDO0lBRUYsSUFBSSxVQUFVLElBQUksQ0FBQyxDQUFDLGNBQWMsSUFBSSxhQUFhLENBQUMsRUFBRTtRQUNwRCxNQUFNLElBQUksS0FBSyxDQUNiLGtFQUFrRTtZQUNoRSw2RUFBNkUsQ0FDaEYsQ0FBQztLQUNIO0lBRUQsT0FBTyxnQkFBZ0IsQ0FBQztBQUMxQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gZGVuby1saW50LWlnbm9yZS1maWxlIGNhbWVsY2FzZVxuLy9PUklHSU5BTCBQUk9KRUNUIEFORCBMSUNFTlNFIElOOiBodHRwczovL2dpdGh1Yi5jb20vY2hpZWZiaWlrby9zYXNscHJlcFxuLy9PUklHSU5BTCBQUk9KRUNUIEFORCBMSUNFTlNFIElOOiBodHRwczovL2dpdGh1Yi5jb20vY2hpZWZiaWlrby9zcGFyc2UtYml0ZmllbGRcbi8vT1JJR0lOQUwgUFJPSkVDVCBBTkQgTElDRU5TRSBJTjogaHR0cHM6Ly9naXRodWIuY29tL2NoaWVmYmlpa28vbWVtb3J5LXBhZ2VyXG5pbXBvcnQgeyBCaXRmaWVsZCB9IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB7IGxvYWRDb2RlUG9pbnRzIH0gZnJvbSBcIi4vbG9hZF9jb2RlX3BvaW50cy50c1wiO1xuXG5jb25zdCB7XG4gIHVuYXNzaWduZWRfY29kZV9wb2ludHMsXG4gIGNvbW1vbmx5X21hcHBlZF90b19ub3RoaW5nLFxuICBub25fQVNDSUlfc3BhY2VfY2hhcmFjdGVycyxcbiAgcHJvaGliaXRlZF9jaGFyYWN0ZXJzLFxuICBiaWRpcmVjdGlvbmFsX3JfYWwsXG4gIGJpZGlyZWN0aW9uYWxfbCxcbn0gPSBsb2FkQ29kZVBvaW50cygpO1xuXG4vLyAyLjEuICBNYXBwaW5nXG5cbi8qKlxuICogbm9uLUFTQ0lJIHNwYWNlIGNoYXJhY3RlcnMgW1N0cmluZ1ByZXAsIEMuMS4yXSB0aGF0IGNhbiBiZVxuICogbWFwcGVkIHRvIFNQQUNFIChVKzAwMjApLlxuICovXG5jb25zdCBtYXBwaW5nMnNwYWNlOiBCaXRmaWVsZCA9IG5vbl9BU0NJSV9zcGFjZV9jaGFyYWN0ZXJzO1xuXG4vKipcbiAqIFRoZSBcImNvbW1vbmx5IG1hcHBlZCB0byBub3RoaW5nXCIgY2hhcmFjdGVycyBbU3RyaW5nUHJlcCwgQi4xXVxuICogdGhhdCBjYW4gYmUgbWFwcGVkIHRvIG5vdGhpbmcuXG4gKi9cbmNvbnN0IG1hcHBpbmcybm90aGluZzogQml0ZmllbGQgPSBjb21tb25seV9tYXBwZWRfdG9fbm90aGluZztcblxuLy8gdXRpbHNcbmZ1bmN0aW9uIGdldENvZGVQb2ludChjaHI6IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IGNvZGVQb2ludDogdW5kZWZpbmVkIHwgbnVtYmVyID0gY2hyLmNvZGVQb2ludEF0KDApO1xuXG4gIGlmICghY29kZVBvaW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGB1bmFibGUgdG8gZW5jb2RlIGNoYXJhY3RlciAke2Nocn1gKTtcbiAgfVxuXG4gIHJldHVybiBjb2RlUG9pbnQ7XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBmaXJzdCh4OiBhbnkpOiBhbnkge1xuICByZXR1cm4geFswXTtcbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbmZ1bmN0aW9uIGxhc3QoeDogYW55KTogYW55IHtcbiAgcmV0dXJuIHhbeC5sZW5ndGggLSAxXTtcbn0gLyoqXG4gKiBDb252ZXJ0IHByb3ZpZGVkIHN0cmluZyBpbnRvIGFuIGFycmF5IG9mIFVuaWNvZGUgQ29kZSBQb2ludHMuXG4gKiBCYXNlZCBvbiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjE0MDkxNjUvMTU1NjI0OVxuICogYW5kIGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL2NvZGUtcG9pbnQtYXQuXG4gKi9cblxuZnVuY3Rpb24gdG9Db2RlUG9pbnRzKGlucHV0OiBzdHJpbmcpOiBudW1iZXJbXSB7XG4gIGNvbnN0IGNvZGVwb2ludHMgPSBbXTtcbiAgY29uc3Qgc2l6ZSA9IGlucHV0Lmxlbmd0aDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkgKz0gMSkge1xuICAgIGNvbnN0IGJlZm9yZTogbnVtYmVyID0gaW5wdXQuY2hhckNvZGVBdChpKTtcblxuICAgIGlmIChiZWZvcmUgPj0gMHhkODAwICYmIGJlZm9yZSA8PSAweGRiZmYgJiYgc2l6ZSA+IGkgKyAxKSB7XG4gICAgICBjb25zdCBuZXh0OiBudW1iZXIgPSBpbnB1dC5jaGFyQ29kZUF0KGkgKyAxKTtcblxuICAgICAgaWYgKG5leHQgPj0gMHhkYzAwICYmIG5leHQgPD0gMHhkZmZmKSB7XG4gICAgICAgIGNvZGVwb2ludHMucHVzaCgoYmVmb3JlIC0gMHhkODAwKSAqIDB4NDAwICsgbmV4dCAtIDB4ZGMwMCArIDB4MTAwMDApO1xuICAgICAgICBpICs9IDE7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvZGVwb2ludHMucHVzaChiZWZvcmUpO1xuICB9XG5cbiAgcmV0dXJuIGNvZGVwb2ludHM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU0FTTHByZXBPcHRpb25zIHtcbiAgYWxsb3dVbmFzc2lnbmVkPzogYm9vbGVhbjtcbn1cblxuLyoqIFNBU0xwcmVwIHJvdXRpbmUuICovXG5leHBvcnQgZnVuY3Rpb24gc2FzbHByZXAoaW5wdXQ6IHN0cmluZywgb3B0czogU0FTTHByZXBPcHRpb25zID0ge30pOiBzdHJpbmcge1xuICBpZiAoaW5wdXQgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiSW5wdXQgbXVzdCBub3QgYmUgbnVsbC5cIik7XG4gIH1cblxuICBpZiAoaW5wdXQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICAvLyAxLiBNYXBcbiAgY29uc3QgbWFwcGVkX2lucHV0OiBudW1iZXJbXSA9IHRvQ29kZVBvaW50cyhpbnB1dClcbiAgICAvLyAxLjEgbWFwcGluZyB0byBzcGFjZVxuICAgIC5tYXAoKGNoYXJhY3RlcikgPT4gKG1hcHBpbmcyc3BhY2UuZ2V0KGNoYXJhY3RlcikgPyAweDIwIDogY2hhcmFjdGVyKSlcbiAgICAvLyAxLjIgbWFwcGluZyB0byBub3RoaW5nXG4gICAgLmZpbHRlcigoY2hhcmFjdGVyKSA9PiAhbWFwcGluZzJub3RoaW5nLmdldChjaGFyYWN0ZXIpKTtcblxuICAvLyAyLiBOb3JtYWxpemVcbiAgY29uc3Qgbm9ybWFsaXplZF9pbnB1dDogc3RyaW5nID0gU3RyaW5nLmZyb21Db2RlUG9pbnRcbiAgICAuYXBwbHkobnVsbCwgbWFwcGVkX2lucHV0KVxuICAgIC5ub3JtYWxpemUoXCJORktDXCIpO1xuXG4gIGNvbnN0IG5vcm1hbGl6ZWRfbWFwOiBudW1iZXJbXSA9IHRvQ29kZVBvaW50cyhub3JtYWxpemVkX2lucHV0KTtcblxuICAvLyAzLiBQcm9oaWJpdFxuICBjb25zdCBoYXNQcm9oaWJpdGVkOiBib29sZWFuID0gbm9ybWFsaXplZF9tYXAuc29tZSgoY2hhcmFjdGVyKSA9PlxuICAgIHByb2hpYml0ZWRfY2hhcmFjdGVycy5nZXQoY2hhcmFjdGVyKVxuICApO1xuXG4gIGlmIChoYXNQcm9oaWJpdGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgXCJQcm9oaWJpdGVkIGNoYXJhY3Rlciwgc2VlIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM0MDEzI3NlY3Rpb24tMi4zXCIsXG4gICAgKTtcbiAgfVxuXG4gIC8vIFVuYXNzaWduZWQgQ29kZSBQb2ludHNcbiAgaWYgKCFvcHRzLmFsbG93VW5hc3NpZ25lZCkge1xuICAgIGNvbnN0IGhhc1VuYXNzaWduZWQ6IGJvb2xlYW4gPSBub3JtYWxpemVkX21hcC5zb21lKChjaGFyYWN0ZXIpID0+XG4gICAgICB1bmFzc2lnbmVkX2NvZGVfcG9pbnRzLmdldChjaGFyYWN0ZXIpXG4gICAgKTtcblxuICAgIGlmIChoYXNVbmFzc2lnbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiVW5hc3NpZ25lZCBjb2RlIHBvaW50LCBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzQwMTMjc2VjdGlvbi0yLjVcIixcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gNC4gY2hlY2sgYmlkaVxuXG4gIGNvbnN0IGhhc0JpZGlSQUw6IGJvb2xlYW4gPSBub3JtYWxpemVkX21hcC5zb21lKChjaGFyYWN0ZXIpID0+XG4gICAgYmlkaXJlY3Rpb25hbF9yX2FsLmdldChjaGFyYWN0ZXIpXG4gICk7XG5cbiAgY29uc3QgaGFzQmlkaUw6IGJvb2xlYW4gPSBub3JtYWxpemVkX21hcC5zb21lKChjaGFyYWN0ZXIpID0+XG4gICAgYmlkaXJlY3Rpb25hbF9sLmdldChjaGFyYWN0ZXIpXG4gICk7XG5cbiAgLy8gNC4xIElmIGEgc3RyaW5nIGNvbnRhaW5zIGFueSBSYW5kQUxDYXQgY2hhcmFjdGVyLCB0aGUgc3RyaW5nIE1VU1QgTk9UXG4gIC8vIGNvbnRhaW4gYW55IExDYXQgY2hhcmFjdGVyLlxuICBpZiAoaGFzQmlkaVJBTCAmJiBoYXNCaWRpTCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiU3RyaW5nIG11c3Qgbm90IGNvbnRhaW4gUmFuZEFMQ2F0IGFuZCBMQ2F0IGF0IHRoZSBzYW1lIHRpbWUsXCIgK1xuICAgICAgICBcIiBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0NTQjc2VjdGlvbi02XCIsXG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiA0LjIgSWYgYSBzdHJpbmcgY29udGFpbnMgYW55IFJhbmRBTENhdCBjaGFyYWN0ZXIsIGEgUmFuZEFMQ2F0XG4gICAqIGNoYXJhY3RlciBNVVNUIGJlIHRoZSBmaXJzdCBjaGFyYWN0ZXIgb2YgdGhlIHN0cmluZywgYW5kIGFcbiAgICogUmFuZEFMQ2F0IGNoYXJhY3RlciBNVVNUIGJlIHRoZSBsYXN0IGNoYXJhY3RlciBvZiB0aGUgc3RyaW5nLlxuICAgKi9cblxuICBjb25zdCBpc0ZpcnN0QmlkaVJBTDogYm9vbGVhbiA9IGJpZGlyZWN0aW9uYWxfcl9hbC5nZXQoXG4gICAgZ2V0Q29kZVBvaW50KGZpcnN0KG5vcm1hbGl6ZWRfaW5wdXQpKSxcbiAgKTtcbiAgY29uc3QgaXNMYXN0QmlkaVJBTDogYm9vbGVhbiA9IGJpZGlyZWN0aW9uYWxfcl9hbC5nZXQoXG4gICAgZ2V0Q29kZVBvaW50KGxhc3Qobm9ybWFsaXplZF9pbnB1dCkpLFxuICApO1xuXG4gIGlmIChoYXNCaWRpUkFMICYmICEoaXNGaXJzdEJpZGlSQUwgJiYgaXNMYXN0QmlkaVJBTCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIkJpZGlyZWN0aW9uYWwgUmFuZEFMQ2F0IGNoYXJhY3RlciBtdXN0IGJlIHRoZSBmaXJzdCBhbmQgdGhlIGxhc3RcIiArXG4gICAgICAgIFwiIGNoYXJhY3RlciBvZiB0aGUgc3RyaW5nLCBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzM0NTQjc2VjdGlvbi02XCIsXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBub3JtYWxpemVkX2lucHV0O1xufVxuIl19