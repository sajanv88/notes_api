import { Bson } from "../../deps.ts";
import { parseNamespace } from "../utils/ns.ts";
export class CommandCursor {
    #id;
    #protocol;
    #batches = [];
    #db;
    #collection;
    #executor;
    #executed = false;
    constructor(protocol, executor) {
        this.#protocol = protocol;
        this.#executor = executor;
    }
    async execute() {
        this.#executed = true;
        const options = await this.#executor();
        this.#batches = options.firstBatch;
        this.#id = BigInt(options.id);
        const { db, collection } = parseNamespace(options.ns);
        this.#db = db;
        this.#collection = collection;
    }
    async next() {
        if (this.#batches.length > 0) {
            return this.#batches.shift();
        }
        if (!this.#executed) {
            await this.execute();
            return this.#batches.shift();
        }
        if (this.#id === 0n) {
            return undefined;
        }
        const { cursor } = await this.#protocol.commandSingle(this.#db, {
            getMore: Bson.Long.fromBigInt(this.#id),
            collection: this.#collection,
        });
        this.#batches = cursor.nextBatch || [];
        this.#id = BigInt(cursor.id.toString());
        return this.#batches.shift();
    }
    async *[Symbol.asyncIterator]() {
        while (this.#batches.length > 0 || this.#id !== 0n) {
            const value = await this.next();
            if (value !== undefined) {
                yield value;
            }
        }
    }
    async forEach(callback) {
        let index = 0;
        for await (const item of this) {
            if (item) {
                callback(item, index++);
            }
        }
    }
    async map(callback) {
        let index = 0;
        const result = [];
        for await (const item of this) {
            if (item) {
                const newItem = callback(item, index++);
                result.push(newItem);
            }
        }
        return result;
    }
    toArray() {
        return this.map((item) => item);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3Vyc29yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3Vyc29yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFHckMsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBVWhELE1BQU0sT0FBTyxhQUFhO0lBQ3hCLEdBQUcsQ0FBVTtJQUNiLFNBQVMsQ0FBZTtJQUN4QixRQUFRLEdBQVEsRUFBRSxDQUFDO0lBQ25CLEdBQUcsQ0FBVTtJQUNiLFdBQVcsQ0FBVTtJQUVyQixTQUFTLENBQXlDO0lBQ2xELFNBQVMsR0FBRyxLQUFLLENBQUM7SUFFbEIsWUFDRSxRQUFzQixFQUN0QixRQUFnRDtRQUVoRCxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUMxQixJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztJQUM1QixDQUFDO0lBRU8sS0FBSyxDQUFDLE9BQU87UUFDbkIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDdEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDdkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDO1FBQ25DLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM5QixNQUFNLEVBQUUsRUFBRSxFQUFFLFVBQVUsRUFBRSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsS0FBSyxDQUFDLElBQUk7UUFDUixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM1QixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDOUI7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNuQixNQUFNLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNyQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDOUI7UUFFRCxJQUFJLElBQUksQ0FBQyxHQUFHLEtBQUssRUFBRSxFQUFFO1lBQ25CLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsTUFBTSxFQUFFLE1BQU0sRUFBRSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEdBQUksRUFBRTtZQUMvRCxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUksQ0FBQztZQUN4QyxVQUFVLEVBQUUsSUFBSSxDQUFDLFdBQVc7U0FDN0IsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDeEMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQy9CLENBQUM7SUFFRCxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLEVBQUU7WUFDbEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEMsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO2dCQUN2QixNQUFNLEtBQUssQ0FBQzthQUNiO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUEwQztRQUN0RCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDZCxJQUFJLEtBQUssRUFBRSxNQUFNLElBQUksSUFBSSxJQUFJLEVBQUU7WUFDN0IsSUFBSSxJQUFJLEVBQUU7Z0JBQ1IsUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO2FBQ3pCO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLEdBQUcsQ0FBSSxRQUF1QztRQUNsRCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDZCxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDbEIsSUFBSSxLQUFLLEVBQUUsTUFBTSxJQUFJLElBQUksSUFBSSxFQUFFO1lBQzdCLElBQUksSUFBSSxFQUFFO2dCQUNSLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztnQkFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQzthQUN0QjtTQUNGO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELE9BQU87UUFDTCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xDLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJzb24gfSBmcm9tIFwiLi4vLi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgV2lyZVByb3RvY29sIH0gZnJvbSBcIi4vcHJvdG9jb2wudHNcIjtcbmltcG9ydCB7IERvY3VtZW50IH0gZnJvbSBcIi4uL3R5cGVzLnRzXCI7XG5pbXBvcnQgeyBwYXJzZU5hbWVzcGFjZSB9IGZyb20gXCIuLi91dGlscy9ucy50c1wiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbW1hbmRDdXJzb3JPcHRpb25zPFQ+IHtcbiAgaWQ6IGJpZ2ludCB8IG51bWJlciB8IHN0cmluZztcbiAgbnM6IHN0cmluZztcbiAgZmlyc3RCYXRjaDogVFtdO1xuICBtYXhUaW1lTVM/OiBudW1iZXI7XG4gIGNvbW1lbnQ/OiBEb2N1bWVudDtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hbmRDdXJzb3I8VD4ge1xuICAjaWQ/OiBiaWdpbnQ7XG4gICNwcm90b2NvbDogV2lyZVByb3RvY29sO1xuICAjYmF0Y2hlczogVFtdID0gW107XG4gICNkYj86IHN0cmluZztcbiAgI2NvbGxlY3Rpb24/OiBzdHJpbmc7XG5cbiAgI2V4ZWN1dG9yOiAoKSA9PiBQcm9taXNlPENvbW1hbmRDdXJzb3JPcHRpb25zPFQ+PjtcbiAgI2V4ZWN1dGVkID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdG9jb2w6IFdpcmVQcm90b2NvbCxcbiAgICBleGVjdXRvcjogKCkgPT4gUHJvbWlzZTxDb21tYW5kQ3Vyc29yT3B0aW9uczxUPj4sXG4gICkge1xuICAgIHRoaXMuI3Byb3RvY29sID0gcHJvdG9jb2w7XG4gICAgdGhpcy4jZXhlY3V0b3IgPSBleGVjdXRvcjtcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZSgpIHtcbiAgICB0aGlzLiNleGVjdXRlZCA9IHRydWU7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IHRoaXMuI2V4ZWN1dG9yKCk7XG4gICAgdGhpcy4jYmF0Y2hlcyA9IG9wdGlvbnMuZmlyc3RCYXRjaDtcbiAgICB0aGlzLiNpZCA9IEJpZ0ludChvcHRpb25zLmlkKTtcbiAgICBjb25zdCB7IGRiLCBjb2xsZWN0aW9uIH0gPSBwYXJzZU5hbWVzcGFjZShvcHRpb25zLm5zKTtcbiAgICB0aGlzLiNkYiA9IGRiO1xuICAgIHRoaXMuI2NvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICB9XG5cbiAgYXN5bmMgbmV4dCgpOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcbiAgICBpZiAodGhpcy4jYmF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gdGhpcy4jYmF0Y2hlcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy4jZXhlY3V0ZWQpIHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZSgpO1xuICAgICAgcmV0dXJuIHRoaXMuI2JhdGNoZXMuc2hpZnQoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy4jaWQgPT09IDBuKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IHsgY3Vyc29yIH0gPSBhd2FpdCB0aGlzLiNwcm90b2NvbC5jb21tYW5kU2luZ2xlKHRoaXMuI2RiISwge1xuICAgICAgZ2V0TW9yZTogQnNvbi5Mb25nLmZyb21CaWdJbnQodGhpcy4jaWQhKSxcbiAgICAgIGNvbGxlY3Rpb246IHRoaXMuI2NvbGxlY3Rpb24sXG4gICAgfSk7XG4gICAgdGhpcy4jYmF0Y2hlcyA9IGN1cnNvci5uZXh0QmF0Y2ggfHwgW107XG4gICAgdGhpcy4jaWQgPSBCaWdJbnQoY3Vyc29yLmlkLnRvU3RyaW5nKCkpO1xuICAgIHJldHVybiB0aGlzLiNiYXRjaGVzLnNoaWZ0KCk7XG4gIH1cblxuICBhc3luYyAqW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSgpOiBBc3luY0dlbmVyYXRvcjxUPiB7XG4gICAgd2hpbGUgKHRoaXMuI2JhdGNoZXMubGVuZ3RoID4gMCB8fCB0aGlzLiNpZCAhPT0gMG4pIHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5uZXh0KCk7XG4gICAgICBpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB5aWVsZCB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3luYyBmb3JFYWNoKGNhbGxiYWNrOiAoaXRlbTogVCwgaW5kZXg6IG51bWJlcikgPT4gdm9pZCkge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMpIHtcbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIGNhbGxiYWNrKGl0ZW0sIGluZGV4KyspO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1hcDxNPihjYWxsYmFjazogKGl0ZW06IFQsIGluZGV4OiBudW1iZXIpID0+IE0pOiBQcm9taXNlPE1bXT4ge1xuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMpIHtcbiAgICAgIGlmIChpdGVtKSB7XG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSBjYWxsYmFjayhpdGVtLCBpbmRleCsrKTtcbiAgICAgICAgcmVzdWx0LnB1c2gobmV3SXRlbSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB0b0FycmF5KCk6IFByb21pc2U8VFtdPiB7XG4gICAgcmV0dXJuIHRoaXMubWFwKChpdGVtKSA9PiBpdGVtKTtcbiAgfVxufVxuIl19