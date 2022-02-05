import { isObjectLike } from "./parser/utils.ts";
export function isDBRefLike(value) {
    return (isObjectLike(value) &&
        value.$id != null &&
        typeof value.$ref === "string" &&
        (value.$db == null || typeof value.$db === "string"));
}
export class DBRef {
    collection;
    oid;
    db;
    fields;
    constructor(collection, oid, db, fields) {
        const parts = collection.split(".");
        if (parts.length === 2) {
            db = parts.shift();
            collection = parts.shift();
        }
        this.collection = collection;
        this.oid = oid;
        this.db = db;
        this.fields = fields || {};
    }
    toJSON() {
        const o = Object.assign({
            $ref: this.collection,
            $id: this.oid,
        }, this.fields);
        if (this.db != null)
            o.$db = this.db;
        return o;
    }
    static fromExtendedJSON(doc) {
        const copy = Object.assign({}, doc);
        delete copy.$ref;
        delete copy.$id;
        delete copy.$db;
        return new DBRef(doc.$ref, doc.$id, doc.$db, copy);
    }
    [Symbol.for("Deno.customInspect")]() {
        const oid = this.oid === undefined || this.oid.toString === undefined
            ? this.oid
            : this.oid.toString();
        return `new DBRef("${this.collection}", new ObjectId("${oid}")${this.db ? `, "${this.db}"` : ""})`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGJfcmVmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZGJfcmVmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQVVqRCxNQUFNLFVBQVUsV0FBVyxDQUFDLEtBQWM7SUFDeEMsT0FBTyxDQUNMLFlBQVksQ0FBQyxLQUFLLENBQUM7UUFDbkIsS0FBSyxDQUFDLEdBQUcsSUFBSSxJQUFJO1FBQ2pCLE9BQU8sS0FBSyxDQUFDLElBQUksS0FBSyxRQUFRO1FBQzlCLENBQUMsS0FBSyxDQUFDLEdBQUcsSUFBSSxJQUFJLElBQUksT0FBTyxLQUFLLENBQUMsR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUNyRCxDQUFDO0FBQ0osQ0FBQztBQU1ELE1BQU0sT0FBTyxLQUFLO0lBQ2hCLFVBQVUsQ0FBVTtJQUNwQixHQUFHLENBQVk7SUFDZixFQUFFLENBQVU7SUFDWixNQUFNLENBQVk7SUFPbEIsWUFDRSxVQUFrQixFQUNsQixHQUFhLEVBQ2IsRUFBVyxFQUNYLE1BQWlCO1FBR2pCLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDcEMsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN0QixFQUFFLEdBQUcsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBRW5CLFVBQVUsR0FBRyxLQUFLLENBQUMsS0FBSyxFQUFHLENBQUM7U0FDN0I7UUFFRCxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQztRQUM3QixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNmLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLElBQUksRUFBRSxDQUFDO0lBQzdCLENBQUM7SUFFRCxNQUFNO1FBQ0osTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FDckI7WUFDRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDckIsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHO1NBQ2QsRUFDRCxJQUFJLENBQUMsTUFBTSxDQUNaLENBQUM7UUFFRixJQUFJLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSTtZQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNyQyxPQUFPLENBQUMsQ0FBQztJQUNYLENBQUM7SUFHRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsR0FBYztRQUNwQyxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQXVCLENBQUM7UUFDMUQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ2pCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztRQUNoQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDaEIsT0FBTyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyRCxDQUFDO0lBRUQsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFaEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssU0FBUztZQUNuRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUc7WUFDVixDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN4QixPQUFPLGNBQWMsSUFBSSxDQUFDLFVBQVUsb0JBQW9CLEdBQUcsS0FDekQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQy9CLEdBQUcsQ0FBQztJQUNOLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgRG9jdW1lbnQgfSBmcm9tIFwiLi9ic29uLnRzXCI7XG5pbXBvcnQgdHlwZSB7IE9iamVjdElkIH0gZnJvbSBcIi4vb2JqZWN0aWQudHNcIjtcbmltcG9ydCB7IGlzT2JqZWN0TGlrZSB9IGZyb20gXCIuL3BhcnNlci91dGlscy50c1wiO1xuXG4vKiogQHB1YmxpYyAqL1xuZXhwb3J0IGludGVyZmFjZSBEQlJlZkxpa2Uge1xuICAkcmVmOiBzdHJpbmc7XG4gICRpZDogT2JqZWN0SWQ7XG4gICRkYj86IHN0cmluZztcbn1cblxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzREJSZWZMaWtlKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgREJSZWZMaWtlIHtcbiAgcmV0dXJuIChcbiAgICBpc09iamVjdExpa2UodmFsdWUpICYmXG4gICAgdmFsdWUuJGlkICE9IG51bGwgJiZcbiAgICB0eXBlb2YgdmFsdWUuJHJlZiA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICh2YWx1ZS4kZGIgPT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUuJGRiID09PSBcInN0cmluZ1wiKVxuICApO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50YXRpb24gb2YgdGhlIEJTT04gREJSZWYgdHlwZS5cbiAqIEBwdWJsaWNcbiAqL1xuZXhwb3J0IGNsYXNzIERCUmVmIHtcbiAgY29sbGVjdGlvbiE6IHN0cmluZztcbiAgb2lkITogT2JqZWN0SWQ7XG4gIGRiPzogc3RyaW5nO1xuICBmaWVsZHMhOiBEb2N1bWVudDtcblxuICAvKipcbiAgICogQHBhcmFtIGNvbGxlY3Rpb24gLSB0aGUgY29sbGVjdGlvbiBuYW1lLlxuICAgKiBAcGFyYW0gb2lkIC0gdGhlIHJlZmVyZW5jZSBPYmplY3RJZC5cbiAgICogQHBhcmFtIGRiIC0gb3B0aW9uYWwgZGIgbmFtZSwgaWYgb21pdHRlZCB0aGUgcmVmZXJlbmNlIGlzIGxvY2FsIHRvIHRoZSBjdXJyZW50IGRiLlxuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgY29sbGVjdGlvbjogc3RyaW5nLFxuICAgIG9pZDogT2JqZWN0SWQsXG4gICAgZGI/OiBzdHJpbmcsXG4gICAgZmllbGRzPzogRG9jdW1lbnQsXG4gICkge1xuICAgIC8vIGNoZWNrIGlmIG5hbWVzcGFjZSBoYXMgYmVlbiBwcm92aWRlZFxuICAgIGNvbnN0IHBhcnRzID0gY29sbGVjdGlvbi5zcGxpdChcIi5cIik7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgZGIgPSBwYXJ0cy5zaGlmdCgpO1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1ub24tbnVsbC1hc3NlcnRpb25cbiAgICAgIGNvbGxlY3Rpb24gPSBwYXJ0cy5zaGlmdCgpITtcbiAgICB9XG5cbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMub2lkID0gb2lkO1xuICAgIHRoaXMuZGIgPSBkYjtcbiAgICB0aGlzLmZpZWxkcyA9IGZpZWxkcyB8fCB7fTtcbiAgfVxuXG4gIHRvSlNPTigpOiBEQlJlZkxpa2UgJiBEb2N1bWVudCB7XG4gICAgY29uc3QgbyA9IE9iamVjdC5hc3NpZ24oXG4gICAgICB7XG4gICAgICAgICRyZWY6IHRoaXMuY29sbGVjdGlvbixcbiAgICAgICAgJGlkOiB0aGlzLm9pZCxcbiAgICAgIH0sXG4gICAgICB0aGlzLmZpZWxkcyxcbiAgICApO1xuXG4gICAgaWYgKHRoaXMuZGIgIT0gbnVsbCkgby4kZGIgPSB0aGlzLmRiO1xuICAgIHJldHVybiBvO1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBzdGF0aWMgZnJvbUV4dGVuZGVkSlNPTihkb2M6IERCUmVmTGlrZSk6IERCUmVmIHtcbiAgICBjb25zdCBjb3B5ID0gT2JqZWN0LmFzc2lnbih7fSwgZG9jKSBhcyBQYXJ0aWFsPERCUmVmTGlrZT47XG4gICAgZGVsZXRlIGNvcHkuJHJlZjtcbiAgICBkZWxldGUgY29weS4kaWQ7XG4gICAgZGVsZXRlIGNvcHkuJGRiO1xuICAgIHJldHVybiBuZXcgREJSZWYoZG9jLiRyZWYsIGRvYy4kaWQsIGRvYy4kZGIsIGNvcHkpO1xuICB9XG5cbiAgW1N5bWJvbC5mb3IoXCJEZW5vLmN1c3RvbUluc3BlY3RcIildKCk6IHN0cmluZyB7XG4gICAgLy8gTk9URTogaWYgT0lEIGlzIGFuIE9iamVjdElkIGNsYXNzIGl0IHdpbGwganVzdCBwcmludCB0aGUgb2lkIHN0cmluZy5cbiAgICBjb25zdCBvaWQgPSB0aGlzLm9pZCA9PT0gdW5kZWZpbmVkIHx8IHRoaXMub2lkLnRvU3RyaW5nID09PSB1bmRlZmluZWRcbiAgICAgID8gdGhpcy5vaWRcbiAgICAgIDogdGhpcy5vaWQudG9TdHJpbmcoKTtcbiAgICByZXR1cm4gYG5ldyBEQlJlZihcIiR7dGhpcy5jb2xsZWN0aW9ufVwiLCBuZXcgT2JqZWN0SWQoXCIke29pZH1cIikke1xuICAgICAgdGhpcy5kYiA/IGAsIFwiJHt0aGlzLmRifVwiYCA6IFwiXCJcbiAgICB9KWA7XG4gIH1cbn1cbiJdfQ==