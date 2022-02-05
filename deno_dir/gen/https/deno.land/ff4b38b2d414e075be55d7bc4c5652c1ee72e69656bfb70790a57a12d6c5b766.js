import { Pager } from "./memory_pager.ts";
function powerOfTwo(x) {
    return !(x & (x - 1));
}
export class Bitfield {
    pageOffset;
    pageSize;
    pages;
    byteLength;
    length;
    _trackUpdates;
    _pageMask;
    constructor(opts = {}) {
        if (opts instanceof Uint8Array) {
            opts = { buffer: opts };
        }
        this.pageOffset = opts.pageOffset || 0;
        this.pageSize = opts.pageSize || 1024;
        this.pages = opts.pages || new Pager(this.pageSize);
        this.byteLength = this.pages.length * this.pageSize;
        this.length = 8 * this.byteLength;
        if (!powerOfTwo(this.pageSize)) {
            throw new Error("The page size should be a power of two");
        }
        this._trackUpdates = !!opts.trackUpdates;
        this._pageMask = this.pageSize - 1;
        if (opts.buffer) {
            for (let i = 0; i < opts.buffer.length; i += this.pageSize) {
                this.pages.set(i / this.pageSize, opts.buffer.slice(i, i + this.pageSize));
            }
            this.byteLength = opts.buffer.length;
            this.length = 8 * this.byteLength;
        }
    }
    getByte(i) {
        const o = i & this._pageMask;
        const j = (i - o) / this.pageSize;
        const page = this.pages.get(j, true);
        return page ? page.buffer[o + this.pageOffset] : 0;
    }
    setByte(i, b) {
        const o = (i & this._pageMask) + this.pageOffset;
        const j = (i - o) / this.pageSize;
        const page = this.pages.get(j, false);
        if (page.buffer[o] === b) {
            return false;
        }
        page.buffer[o] = b;
        if (i >= this.byteLength) {
            this.byteLength = i + 1;
            this.length = this.byteLength * 8;
        }
        if (this._trackUpdates) {
            this.pages.updated(page);
        }
        return true;
    }
    get(i) {
        const o = i & 7;
        const j = (i - o) / 8;
        return !!(this.getByte(j) & (128 >> o));
    }
    set(i, v) {
        const o = i & 7;
        const j = (i - o) / 8;
        const b = this.getByte(j);
        return this.setByte(j, v ? b | (128 >> o) : b & (255 ^ (128 >> o)));
    }
    toBuffer() {
        const all = new Uint8Array(this.pages.length * this.pageSize);
        for (let i = 0; i < this.pages.length; i++) {
            const next = this.pages.get(i, true);
            if (next) {
                all
                    .subarray(i * this.pageSize)
                    .set(next.buffer.subarray(this.pageOffset, this.pageOffset + this.pageSize));
            }
        }
        return all;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3BhcnNlX2JpdGZpZWxkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3BhcnNlX2JpdGZpZWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBUSxLQUFLLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUdoRCxTQUFTLFVBQVUsQ0FBQyxDQUFTO0lBQzNCLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLENBQUM7QUFZRCxNQUFNLE9BQU8sUUFBUTtJQUNWLFVBQVUsQ0FBUztJQUNuQixRQUFRLENBQVM7SUFDakIsS0FBSyxDQUFRO0lBRXRCLFVBQVUsQ0FBUztJQUNuQixNQUFNLENBQVM7SUFFUCxhQUFhLENBQVU7SUFDdkIsU0FBUyxDQUFTO0lBRzFCLFlBQVksT0FBcUMsRUFBRTtRQUNqRCxJQUFJLElBQUksWUFBWSxVQUFVLEVBQUU7WUFDOUIsSUFBSSxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDO1NBQ3pCO1FBRUQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFcEQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3BELElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFFbEMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3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XCIuL21lbW9yeV9wYWdlci50c1wiO1xuXG4vKiogSXMgdGhlIGdpdmVuIG51bWJlciBhIHBvd2VyIG9mIHR3bz8gKi9cbmZ1bmN0aW9uIHBvd2VyT2ZUd28oeDogbnVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiAhKHggJiAoeCAtIDEpKTtcbn1cblxuLyoqIEJpdGZpZWxkIGNvbnN0cnVjdG9yIG9wdGlvbnMuICovXG5leHBvcnQgaW50ZXJmYWNlIEJpdGZpZWxkT3B0aW9ucyB7XG4gIHBhZ2VPZmZzZXQ/OiBudW1iZXI7XG4gIHBhZ2VTaXplPzogbnVtYmVyO1xuICBwYWdlcz86IFBhZ2VyO1xuICB0cmFja1VwZGF0ZXM/OiBib29sZWFuO1xuICBidWZmZXI/OiBVaW50OEFycmF5O1xufVxuXG4vKiogQSBjbGFzcyByZXByZXNlbnRhdGlvbiBvZiBhIGJpdGZpZWxkLiAqL1xuZXhwb3J0IGNsYXNzIEJpdGZpZWxkIHtcbiAgcmVhZG9ubHkgcGFnZU9mZnNldDogbnVtYmVyO1xuICByZWFkb25seSBwYWdlU2l6ZTogbnVtYmVyO1xuICByZWFkb25seSBwYWdlczogUGFnZXI7XG5cbiAgYnl0ZUxlbmd0aDogbnVtYmVyO1xuICBsZW5ndGg6IG51bWJlcjtcblxuICBwcml2YXRlIF90cmFja1VwZGF0ZXM6IGJvb2xlYW47XG4gIHByaXZhdGUgX3BhZ2VNYXNrOiBudW1iZXI7XG5cbiAgLyoqIENyZWF0ZXMgYSBiaXRmaWVsZCBpbnN0YW5jZS4gKi9cbiAgY29uc3RydWN0b3Iob3B0czogVWludDhBcnJheSB8IEJpdGZpZWxkT3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKG9wdHMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICBvcHRzID0geyBidWZmZXI6IG9wdHMgfTtcbiAgICB9XG5cbiAgICB0aGlzLnBhZ2VPZmZzZXQgPSBvcHRzLnBhZ2VPZmZzZXQgfHwgMDtcbiAgICB0aGlzLnBhZ2VTaXplID0gb3B0cy5wYWdlU2l6ZSB8fCAxMDI0O1xuICAgIHRoaXMucGFnZXMgPSBvcHRzLnBhZ2VzIHx8IG5ldyBQYWdlcih0aGlzLnBhZ2VTaXplKTtcblxuICAgIHRoaXMuYnl0ZUxlbmd0aCA9IHRoaXMucGFnZXMubGVuZ3RoICogdGhpcy5wYWdlU2l6ZTtcbiAgICB0aGlzLmxlbmd0aCA9IDggKiB0aGlzLmJ5dGVMZW5ndGg7XG5cbiAgICBpZiAoIXBvd2VyT2ZUd28odGhpcy5wYWdlU2l6ZSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBwYWdlIHNpemUgc2hvdWxkIGJlIGEgcG93ZXIgb2YgdHdvXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX3RyYWNrVXBkYXRlcyA9ICEhb3B0cy50cmFja1VwZGF0ZXM7XG4gICAgdGhpcy5fcGFnZU1hc2sgPSB0aGlzLnBhZ2VTaXplIC0gMTtcblxuICAgIGlmIChvcHRzLmJ1ZmZlcikge1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvcHRzLmJ1ZmZlci5sZW5ndGg7IGkgKz0gdGhpcy5wYWdlU2l6ZSkge1xuICAgICAgICB0aGlzLnBhZ2VzLnNldChcbiAgICAgICAgICBpIC8gdGhpcy5wYWdlU2l6ZSxcbiAgICAgICAgICBvcHRzLmJ1ZmZlci5zbGljZShpLCBpICsgdGhpcy5wYWdlU2l6ZSksXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYnl0ZUxlbmd0aCA9IG9wdHMuYnVmZmVyLmxlbmd0aDtcbiAgICAgIHRoaXMubGVuZ3RoID0gOCAqIHRoaXMuYnl0ZUxlbmd0aDtcbiAgICB9XG4gIH1cblxuICAvKiogR2V0cyBhIGJ5dGUuICovXG4gIGdldEJ5dGUoaTogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBvOiBudW1iZXIgPSBpICYgdGhpcy5fcGFnZU1hc2s7XG4gICAgY29uc3QgajogbnVtYmVyID0gKGkgLSBvKSAvIHRoaXMucGFnZVNpemU7XG4gICAgY29uc3QgcGFnZTogUGFnZSA9IHRoaXMucGFnZXMuZ2V0KGosIHRydWUpO1xuXG4gICAgcmV0dXJuIHBhZ2UgPyBwYWdlLmJ1ZmZlcltvICsgdGhpcy5wYWdlT2Zmc2V0XSA6IDA7XG4gIH1cblxuICAvKiogU2V0cyBhIGJ5dGUuICovXG4gIHNldEJ5dGUoaTogbnVtYmVyLCBiOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICBjb25zdCBvOiBudW1iZXIgPSAoaSAmIHRoaXMuX3BhZ2VNYXNrKSArIHRoaXMucGFnZU9mZnNldDtcbiAgICBjb25zdCBqOiBudW1iZXIgPSAoaSAtIG8pIC8gdGhpcy5wYWdlU2l6ZTtcbiAgICBjb25zdCBwYWdlOiBQYWdlID0gdGhpcy5wYWdlcy5nZXQoaiwgZmFsc2UpO1xuXG4gICAgaWYgKHBhZ2UuYnVmZmVyW29dID09PSBiKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcGFnZS5idWZmZXJbb10gPSBiO1xuXG4gICAgaWYgKGkgPj0gdGhpcy5ieXRlTGVuZ3RoKSB7XG4gICAgICB0aGlzLmJ5dGVMZW5ndGggPSBpICsgMTtcbiAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5ieXRlTGVuZ3RoICogODtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fdHJhY2tVcGRhdGVzKSB7XG4gICAgICB0aGlzLnBhZ2VzLnVwZGF0ZWQocGFnZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKiogR2V0cyBhIGJpdC4gKi9cbiAgZ2V0KGk6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IG86IG51bWJlciA9IGkgJiA3O1xuICAgIGNvbnN0IGo6IG51bWJlciA9IChpIC0gbykgLyA4O1xuXG4gICAgcmV0dXJuICEhKHRoaXMuZ2V0Qnl0ZShqKSAmICgxMjggPj4gbykpO1xuICB9XG5cbiAgLyoqIFNldHMgYSBiaXQuICovXG4gIHNldChpOiBudW1iZXIsIHY6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICBjb25zdCBvOiBudW1iZXIgPSBpICYgNztcbiAgICBjb25zdCBqOiBudW1iZXIgPSAoaSAtIG8pIC8gODtcbiAgICBjb25zdCBiOiBudW1iZXIgPSB0aGlzLmdldEJ5dGUoaik7XG5cbiAgICByZXR1cm4gdGhpcy5zZXRCeXRlKGosIHYgPyBiIHwgKDEyOCA+PiBvKSA6IGIgJiAoMjU1IF4gKDEyOCA+PiBvKSkpO1xuICB9XG5cbiAgLyoqIEdldHMgYSBzaW5nbGUgYnVmZmVyIHJlcHJlc2VudGluZyB0aGUgZW50aXJlIGJpdGZpZWxkLiAqL1xuICB0b0J1ZmZlcigpOiBVaW50OEFycmF5IHtcbiAgICBjb25zdCBhbGw6IFVpbnQ4QXJyYXkgPSBuZXcgVWludDhBcnJheSh0aGlzLnBhZ2VzLmxlbmd0aCAqIHRoaXMucGFnZVNpemUpO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnBhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBuZXh0OiBQYWdlID0gdGhpcy5wYWdlcy5nZXQoaSwgdHJ1ZSk7XG5cbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIGFsbFxuICAgICAgICAgIC5zdWJhcnJheShpICogdGhpcy5wYWdlU2l6ZSlcbiAgICAgICAgICAuc2V0KFxuICAgICAgICAgICAgbmV4dC5idWZmZXIuc3ViYXJyYXkoXG4gICAgICAgICAgICAgIHRoaXMucGFnZU9mZnNldCxcbiAgICAgICAgICAgICAgdGhpcy5wYWdlT2Zmc2V0ICsgdGhpcy5wYWdlU2l6ZSxcbiAgICAgICAgICAgICksXG4gICAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYWxsO1xuICB9XG59XG4iXX0=