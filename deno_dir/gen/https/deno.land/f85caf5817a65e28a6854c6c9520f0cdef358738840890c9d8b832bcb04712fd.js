export class BytesList {
    len = 0;
    chunks = [];
    constructor() { }
    size() {
        return this.len;
    }
    add(value, start = 0, end = value.byteLength) {
        if (value.byteLength === 0 || end - start === 0) {
            return;
        }
        checkRange(start, end, value.byteLength);
        this.chunks.push({
            value,
            end,
            start,
            offset: this.len,
        });
        this.len += end - start;
    }
    shift(n) {
        if (n === 0) {
            return;
        }
        if (this.len <= n) {
            this.chunks = [];
            this.len = 0;
            return;
        }
        const idx = this.getChunkIndex(n);
        this.chunks.splice(0, idx);
        const [chunk] = this.chunks;
        if (chunk) {
            const diff = n - chunk.offset;
            chunk.start += diff;
        }
        let offset = 0;
        for (const chunk of this.chunks) {
            chunk.offset = offset;
            offset += chunk.end - chunk.start;
        }
        this.len = offset;
    }
    getChunkIndex(pos) {
        let max = this.chunks.length;
        let min = 0;
        while (true) {
            const i = min + Math.floor((max - min) / 2);
            if (i < 0 || this.chunks.length <= i) {
                return -1;
            }
            const { offset, start, end } = this.chunks[i];
            const len = end - start;
            if (offset <= pos && pos < offset + len) {
                return i;
            }
            else if (offset + len <= pos) {
                min = i + 1;
            }
            else {
                max = i - 1;
            }
        }
    }
    get(i) {
        if (i < 0 || this.len <= i) {
            throw new Error("out of range");
        }
        const idx = this.getChunkIndex(i);
        const { value, offset, start } = this.chunks[idx];
        return value[start + i - offset];
    }
    *iterator(start = 0) {
        const startIdx = this.getChunkIndex(start);
        if (startIdx < 0)
            return;
        const first = this.chunks[startIdx];
        let firstOffset = start - first.offset;
        for (let i = startIdx; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];
            for (let j = chunk.start + firstOffset; j < chunk.end; j++) {
                yield chunk.value[j];
            }
            firstOffset = 0;
        }
    }
    slice(start, end = this.len) {
        if (end === start) {
            return new Uint8Array();
        }
        checkRange(start, end, this.len);
        const result = new Uint8Array(end - start);
        const startIdx = this.getChunkIndex(start);
        const endIdx = this.getChunkIndex(end - 1);
        let written = 0;
        for (let i = startIdx; i < endIdx; i++) {
            const chunk = this.chunks[i];
            const len = chunk.end - chunk.start;
            result.set(chunk.value.subarray(chunk.start, chunk.end), written);
            written += len;
        }
        const last = this.chunks[endIdx];
        const rest = end - start - written;
        result.set(last.value.subarray(last.start, last.start + rest), written);
        return result;
    }
    concat() {
        const result = new Uint8Array(this.len);
        let sum = 0;
        for (const { value, start, end } of this.chunks) {
            result.set(value.subarray(start, end), sum);
            sum += end - start;
        }
        return result;
    }
}
function checkRange(start, end, len) {
    if (start < 0 || len < start || end < 0 || len < end || end < start) {
        throw new Error("invalid range");
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnl0ZXNfbGlzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJ5dGVzX2xpc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBSUEsTUFBTSxPQUFPLFNBQVM7SUFDWixHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQ1IsTUFBTSxHQUtSLEVBQUUsQ0FBQztJQUNULGdCQUFlLENBQUM7SUFLaEIsSUFBSTtRQUNGLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNsQixDQUFDO0lBSUQsR0FBRyxDQUFDLEtBQWlCLEVBQUUsS0FBSyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLFVBQVU7UUFDdEQsSUFBSSxLQUFLLENBQUMsVUFBVSxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsS0FBSyxLQUFLLENBQUMsRUFBRTtZQUMvQyxPQUFPO1NBQ1I7UUFDRCxVQUFVLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDZixLQUFLO1lBQ0wsR0FBRztZQUNILEtBQUs7WUFDTCxNQUFNLEVBQUUsSUFBSSxDQUFDLEdBQUc7U0FDakIsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLEdBQUcsSUFBSSxHQUFHLEdBQUcsS0FBSyxDQUFDO0lBQzFCLENBQUM7SUFLRCxLQUFLLENBQUMsQ0FBUztRQUNiLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUNYLE9BQU87U0FDUjtRQUNELElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEVBQUU7WUFDakIsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDYixPQUFPO1NBQ1I7UUFDRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMs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YXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vKipcbiAqIEFuIGFic3RyYWN0aW9uIG9mIG11bHRpcGxlIFVpbnQ4QXJyYXlzXG4gKi9cbmV4cG9ydCBjbGFzcyBCeXRlc0xpc3Qge1xuICBwcml2YXRlIGxlbiA9IDA7XG4gIHByaXZhdGUgY2h1bmtzOiB7XG4gICAgdmFsdWU6IFVpbnQ4QXJyYXk7XG4gICAgc3RhcnQ6IG51bWJlcjsgLy8gc3RhcnQgb2Zmc2V0IGZyb20gaGVhZCBvZiBjaHVua1xuICAgIGVuZDogbnVtYmVyOyAvLyBlbmQgb2Zmc2V0IGZyb20gaGVhZCBvZiBjaHVua1xuICAgIG9mZnNldDogbnVtYmVyOyAvLyBvZmZzZXQgb2YgaGVhZCBpbiBhbGwgYnl0ZXNcbiAgfVtdID0gW107XG4gIGNvbnN0cnVjdG9yKCkge31cblxuICAvKipcbiAgICogVG90YWwgc2l6ZSBvZiBieXRlc1xuICAgKi9cbiAgc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5sZW47XG4gIH1cbiAgLyoqXG4gICAqIFB1c2ggYnl0ZXMgd2l0aCBnaXZlbiBvZmZzZXQgaW5mb3NcbiAgICovXG4gIGFkZCh2YWx1ZTogVWludDhBcnJheSwgc3RhcnQgPSAwLCBlbmQgPSB2YWx1ZS5ieXRlTGVuZ3RoKSB7XG4gICAgaWYgKHZhbHVlLmJ5dGVMZW5ndGggPT09IDAgfHwgZW5kIC0gc3RhcnQgPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY2hlY2tSYW5nZShzdGFydCwgZW5kLCB2YWx1ZS5ieXRlTGVuZ3RoKTtcbiAgICB0aGlzLmNodW5rcy5wdXNoKHtcbiAgICAgIHZhbHVlLFxuICAgICAgZW5kLFxuICAgICAgc3RhcnQsXG4gICAgICBvZmZzZXQ6IHRoaXMubGVuLFxuICAgIH0pO1xuICAgIHRoaXMubGVuICs9IGVuZCAtIHN0YXJ0O1xuICB9XG5cbiAgLyoqXG4gICAqIERyb3AgaGVhZCBgbmAgYnl0ZXMuXG4gICAqL1xuICBzaGlmdChuOiBudW1iZXIpIHtcbiAgICBpZiAobiA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5sZW4gPD0gbikge1xuICAgICAgdGhpcy5jaHVua3MgPSBbXTtcbiAgICAgIHRoaXMubGVuID0gMDtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgaWR4ID0gdGhpcy5nZXRDaHVua0luZGV4KG4pO1xuICAgIHRoaXMuY2h1bmtzLnNwbGljZSgwLCBpZHgpO1xuICAgIGNvbnN0IFtjaHVua10gPSB0aGlzLmNodW5rcztcbiAgICBpZiAoY2h1bmspIHtcbiAgICAgIGNvbnN0IGRpZmYgPSBuIC0gY2h1bmsub2Zmc2V0O1xuICAgICAgY2h1bmsuc3RhcnQgKz0gZGlmZjtcbiAgICB9XG4gICAgbGV0IG9mZnNldCA9IDA7XG4gICAgZm9yIChjb25zdCBjaHVuayBvZiB0aGlzLmNodW5rcykge1xuICAgICAgY2h1bmsub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgb2Zmc2V0ICs9IGNodW5rLmVuZCAtIGNodW5rLnN0YXJ0O1xuICAgIH1cbiAgICB0aGlzLmxlbiA9IG9mZnNldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGaW5kIGNodW5rIGluZGV4IGluIHdoaWNoIGBwb3NgIGxvY2F0ZXMgYnkgYmluYXJ5LXNlYXJjaFxuICAgKiByZXR1cm5zIC0xIGlmIG91dCBvZiByYW5nZVxuICAgKi9cbiAgZ2V0Q2h1bmtJbmRleChwb3M6IG51bWJlcik6IG51bWJlciB7XG4gICAgbGV0IG1heCA9IHRoaXMuY2h1bmtzLmxlbmd0aDtcbiAgICBsZXQgbWluID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgaSA9IG1pbiArIE1hdGguZmxvb3IoKG1heCAtIG1pbikgLyAyKTtcbiAgICAgIGlmIChpIDwgMCB8fCB0aGlzLmNodW5rcy5sZW5ndGggPD0gaSkge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICBjb25zdCB7IG9mZnNldCwgc3RhcnQsIGVuZCB9ID0gdGhpcy5jaHVua3NbaV07XG4gICAgICBjb25zdCBsZW4gPSBlbmQgLSBzdGFydDtcbiAgICAgIGlmIChvZmZzZXQgPD0gcG9zICYmIHBvcyA8IG9mZnNldCArIGxlbikge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH0gZWxzZSBpZiAob2Zmc2V0ICsgbGVuIDw9IHBvcykge1xuICAgICAgICBtaW4gPSBpICsgMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1heCA9IGkgLSAxO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgaW5kZXhlZCBieXRlIGZyb20gY2h1bmtzXG4gICAqL1xuICBnZXQoaTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBpZiAoaSA8IDAgfHwgdGhpcy5sZW4gPD0gaSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwib3V0IG9mIHJhbmdlXCIpO1xuICAgIH1cbiAgICBjb25zdCBpZHggPSB0aGlzLmdldENodW5rSW5kZXgoaSk7XG4gICAgY29uc3QgeyB2YWx1ZSwgb2Zmc2V0LCBzdGFydCB9ID0gdGhpcy5jaHVua3NbaWR4XTtcbiAgICByZXR1cm4gdmFsdWVbc3RhcnQgKyBpIC0gb2Zmc2V0XTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJdGVyYXRvciBvZiBieXRlcyBmcm9tIGdpdmVuIHBvc2l0aW9uXG4gICAqL1xuICAqaXRlcmF0b3Ioc3RhcnQgPSAwKTogSXRlcmFibGVJdGVyYXRvcjxudW1iZXI+IHtcbiAgICBjb25zdCBzdGFydElkeCA9IHRoaXMuZ2V0Q2h1bmtJbmRleChzdGFydCk7XG4gICAgaWYgKHN0YXJ0SWR4IDwgMCkgcmV0dXJuO1xuICAgIGNvbnN0IGZpcnN0ID0gdGhpcy5jaHVua3Nbc3RhcnRJZHhdO1xuICAgIGxldCBmaXJzdE9mZnNldCA9IHN0YXJ0IC0gZmlyc3Qub2Zmc2V0O1xuICAgIGZvciAobGV0IGkgPSBzdGFydElkeDsgaSA8IHRoaXMuY2h1bmtzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBjaHVuayA9IHRoaXMuY2h1bmtzW2ldO1xuICAgICAgZm9yIChsZXQgaiA9IGNodW5rLnN0YXJ0ICsgZmlyc3RPZmZzZXQ7IGogPCBjaHVuay5lbmQ7IGorKykge1xuICAgICAgICB5aWVsZCBjaHVuay52YWx1ZVtqXTtcbiAgICAgIH1cbiAgICAgIGZpcnN0T2Zmc2V0ID0gMDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBzdWJzZXQgb2YgYnl0ZXMgY29waWVkXG4gICAqL1xuICBzbGljZShzdGFydDogbnVtYmVyLCBlbmQ6IG51bWJlciA9IHRoaXMubGVuKTogVWludDhBcnJheSB7XG4gICAgaWYgKGVuZCA9PT0gc3RhcnQpIHtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSgpO1xuICAgIH1cbiAgICBjaGVja1JhbmdlKHN0YXJ0LCBlbmQsIHRoaXMubGVuKTtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheShlbmQgLSBzdGFydCk7XG4gICAgY29uc3Qgc3RhcnRJZHggPSB0aGlzLmdldENodW5rSW5kZXgoc3RhcnQpO1xuICAgIGNvbnN0IGVuZElkeCA9IHRoaXMuZ2V0Q2h1bmtJbmRleChlbmQgLSAxKTtcbiAgICBsZXQgd3JpdHRlbiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IHN0YXJ0SWR4OyBpIDwgZW5kSWR4OyBpKyspIHtcbiAgICAgIGNvbnN0IGNodW5rID0gdGhpcy5jaHVua3NbaV07XG4gICAgICBjb25zdCBsZW4gPSBjaHVuay5lbmQgLSBjaHVuay5zdGFydDtcbiAgICAgIHJlc3VsdC5zZXQoY2h1bmsudmFsdWUuc3ViYXJyYXkoY2h1bmsuc3RhcnQsIGNodW5rLmVuZCksIHdyaXR0ZW4pO1xuICAgICAgd3JpdHRlbiArPSBsZW47XG4gICAgfVxuICAgIGNvbnN0IGxhc3QgPSB0aGlzLmNodW5rc1tlbmRJZHhdO1xuICAgIGNvbnN0IHJlc3QgPSBlbmQgLSBzdGFydCAtIHdyaXR0ZW47XG4gICAgcmVzdWx0LnNldChsYXN0LnZhbHVlLnN1YmFycmF5KGxhc3Quc3RhcnQsIGxhc3Quc3RhcnQgKyByZXN0KSwgd3JpdHRlbik7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuICAvKipcbiAgICogQ29uY2F0ZW5hdGUgY2h1bmtzIGludG8gc2luZ2xlIFVpbnQ4QXJyYXkgY29waWVkLlxuICAgKi9cbiAgY29uY2F0KCk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuKTtcbiAgICBsZXQgc3VtID0gMDtcbiAgICBmb3IgKGNvbnN0IHsgdmFsdWUsIHN0YXJ0LCBlbmQgfSBvZiB0aGlzLmNodW5rcykge1xuICAgICAgcmVzdWx0LnNldCh2YWx1ZS5zdWJhcnJheShzdGFydCwgZW5kKSwgc3VtKTtcbiAgICAgIHN1bSArPSBlbmQgLSBzdGFydDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuXG5mdW5jdGlvbiBjaGVja1JhbmdlKHN0YXJ0OiBudW1iZXIsIGVuZDogbnVtYmVyLCBsZW46IG51bWJlcikge1xuICBpZiAoc3RhcnQgPCAwIHx8IGxlbiA8IHN0YXJ0IHx8IGVuZCA8IDAgfHwgbGVuIDwgZW5kIHx8IGVuZCA8IHN0YXJ0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCByYW5nZVwiKTtcbiAgfVxufVxuIl19