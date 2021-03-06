export class MongoError extends Error {
    constructor(info) {
        super(`MongoError: ${JSON.stringify(info)}`);
    }
}
export class MongoDriverError extends MongoError {
    constructor(info) {
        super(info);
    }
}
export class MongoServerError extends MongoError {
    ok;
    errmsg;
    code;
    codeName;
    constructor(info) {
        super(info);
        this.ok = info.ok;
        this.errmsg = info.errmsg;
        this.code = info.code;
        this.codeName = info.codeName;
    }
}
export class MongoInvalidArgumentError extends MongoError {
    constructor(info) {
        super(info);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFlQSxNQUFNLE9BQWdCLFVBQVcsU0FBUSxLQUFLO0lBQzVDLFlBQVksSUFBNkI7UUFDdkMsS0FBSyxDQUFDLGVBQWUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0MsQ0FBQztDQUNGO0FBTUQsTUFBTSxPQUFPLGdCQUFpQixTQUFRLFVBQVU7SUFJOUMsWUFBWSxJQUFZO1FBQ3RCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNkLENBQUM7Q0FDRjtBQU1ELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxVQUFVO0lBQzlDLEVBQUUsQ0FBSTtJQUNOLE1BQU0sQ0FBUztJQUNmLElBQUksQ0FBUztJQUNiLFFBQVEsQ0FBUztJQUtqQixZQUFZLElBQW9CO1FBQzlCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVaLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUNoQyxDQUFDO0NBQ0Y7QUFNRCxNQUFNLE9BQU8seUJBQTBCLFNBQVEsVUFBVTtJQUl2RCxZQUFZLElBQVk7UUFDdEIsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2QsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSZXByZXNlbnRhdGlvbiBvZiBhIE1vbmdvREIgc2VydmVyIGVycm9yIHJlc3BvbnNlLlxuICogQHB1YmxpY1xuICovXG5leHBvcnQgaW50ZXJmYWNlIE1vbmdvRXJyb3JJbmZvIHtcbiAgb2s6IDA7XG4gIGVycm1zZzogc3RyaW5nO1xuICBjb2RlOiBudW1iZXI7XG4gIGNvZGVOYW1lOiBzdHJpbmc7XG59XG5cbi8qKlxuICogQSBiYXNlIGNsYXNzIGZyb20gd2hpY2ggTW9uZ28gZXJyb3JzIGFyZSBkZXJpdmVkLlxuICogQHB1YmxpY1xuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgTW9uZ29FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoaW5mbzogTW9uZ29FcnJvckluZm8gfCBzdHJpbmcpIHtcbiAgICBzdXBlcihgTW9uZ29FcnJvcjogJHtKU09OLnN0cmluZ2lmeShpbmZvKX1gKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50YXRpb24gb2YgYW4gZXJyb3Igb2N1cnJpbmcgZHVyaW5nIHRoZSBkcml2ZXIncyBleGVjdXRpb24uXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjbGFzcyBNb25nb0RyaXZlckVycm9yIGV4dGVuZHMgTW9uZ29FcnJvciB7XG4gIC8qKlxuICAgKiBAcGFyYW0gaW5mbyBBIHN0cmluZyBjb250YWluaW5nIHRoZSBlcnJvcidzIG1lc3NhZ2UuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihpbmZvOiBzdHJpbmcpIHtcbiAgICBzdXBlcihpbmZvKTtcbiAgfVxufVxuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50YXRpb24gb2YgYW4gZXJyb3IgcmV0dXJuZWQgYnkgTW9uZ29EQiBzZXJ2ZXIuXG4gKiBAcHVibGljXG4gKi9cbmV4cG9ydCBjbGFzcyBNb25nb1NlcnZlckVycm9yIGV4dGVuZHMgTW9uZ29FcnJvciBpbXBsZW1lbnRzIE1vbmdvRXJyb3JJbmZvIHtcbiAgb2s6IDA7XG4gIGVycm1zZzogc3RyaW5nO1xuICBjb2RlOiBudW1iZXI7XG4gIGNvZGVOYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBpbmZvIEFuIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIHNlcnZlcidzIGVycm9yIHJlc3BvbnNlLlxuICAgKi9cbiAgY29uc3RydWN0b3IoaW5mbzogTW9uZ29FcnJvckluZm8pIHtcbiAgICBzdXBlcihpbmZvKTtcblxuICAgIHRoaXMub2sgPSBpbmZvLm9rO1xuICAgIHRoaXMuZXJybXNnID0gaW5mby5lcnJtc2c7XG4gICAgdGhpcy5jb2RlID0gaW5mby5jb2RlO1xuICAgIHRoaXMuY29kZU5hbWUgPSBpbmZvLmNvZGVOYW1lO1xuICB9XG59XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRhdGlvbiBvZiBhIGNvbW1hbmQgd2l0aCBpbnZhbGlkIGFyZ3VtZW50c1xuICogQHB1YmxpY1xuICovXG5leHBvcnQgY2xhc3MgTW9uZ29JbnZhbGlkQXJndW1lbnRFcnJvciBleHRlbmRzIE1vbmdvRXJyb3Ige1xuICAvKipcbiAgICogQHBhcmFtIGluZm8gQSBzdHJpbmcgY29udGFpbmluZyB0aGUgZXJyb3IncyBtZXNzYWdlLlxuICAgKi9cbiAgY29uc3RydWN0b3IoaW5mbzogc3RyaW5nKSB7XG4gICAgc3VwZXIoaW5mbyk7XG4gIH1cbn1cbiJdfQ==