import { getLevelByName, LogLevels } from "./levels.ts";
import { blue, bold, red, yellow } from "../fmt/colors.ts";
import { exists, existsSync } from "../fs/exists.ts";
import { BufWriterSync } from "../io/buffer.ts";
const DEFAULT_FORMATTER = "{levelName} {msg}";
export class BaseHandler {
    level;
    levelName;
    formatter;
    constructor(levelName, options = {}) {
        this.level = getLevelByName(levelName);
        this.levelName = levelName;
        this.formatter = options.formatter || DEFAULT_FORMATTER;
    }
    handle(logRecord) {
        if (this.level > logRecord.level)
            return;
        const msg = this.format(logRecord);
        return this.log(msg);
    }
    format(logRecord) {
        if (this.formatter instanceof Function) {
            return this.formatter(logRecord);
        }
        return this.formatter.replace(/{(\S+)}/g, (match, p1) => {
            const value = logRecord[p1];
            if (value == null) {
                return match;
            }
            return String(value);
        });
    }
    log(_msg) { }
    async setup() { }
    async destroy() { }
}
export class ConsoleHandler extends BaseHandler {
    format(logRecord) {
        let msg = super.format(logRecord);
        switch (logRecord.level) {
            case LogLevels.INFO:
                msg = blue(msg);
                break;
            case LogLevels.WARNING:
                msg = yellow(msg);
                break;
            case LogLevels.ERROR:
                msg = red(msg);
                break;
            case LogLevels.CRITICAL:
                msg = bold(red(msg));
                break;
            default:
                break;
        }
        return msg;
    }
    log(msg) {
        console.log(msg);
    }
}
export class WriterHandler extends BaseHandler {
    _writer;
    #encoder = new TextEncoder();
}
export class FileHandler extends WriterHandler {
    _file;
    _buf;
    _filename;
    _mode;
    _openOptions;
    _encoder = new TextEncoder();
    #unloadCallback = (() => {
        this.destroy();
    }).bind(this);
    constructor(levelName, options) {
        super(levelName, options);
        this._filename = options.filename;
        this._mode = options.mode ? options.mode : "a";
        this._openOptions = {
            createNew: this._mode === "x",
            create: this._mode !== "x",
            append: this._mode === "a",
            truncate: this._mode !== "a",
            write: true,
        };
    }
    async setup() {
        this._file = await Deno.open(this._filename, this._openOptions);
        this._writer = this._file;
        this._buf = new BufWriterSync(this._file);
        addEventListener("unload", this.#unloadCallback);
    }
    handle(logRecord) {
        super.handle(logRecord);
        if (logRecord.level > LogLevels.ERROR) {
            this.flush();
        }
    }
    log(msg) {
        if (this._encoder.encode(msg).byteLength + 1 > this._buf.available()) {
            this.flush();
        }
        this._buf.writeSync(this._encoder.encode(msg + "\n"));
    }
    flush() {
        if (this._buf?.buffered() > 0) {
            this._buf.flush();
        }
    }
    destroy() {
        this.flush();
        this._file?.close();
        this._file = undefined;
        removeEventListener("unload", this.#unloadCallback);
        return Promise.resolve();
    }
}
export class RotatingFileHandler extends FileHandler {
    #maxBytes;
    #maxBackupCount;
    #currentFileSize = 0;
    constructor(levelName, options) {
        super(levelName, options);
        this.#maxBytes = options.maxBytes;
        this.#maxBackupCount = options.maxBackupCount;
    }
    async setup() {
        if (this.#maxBytes < 1) {
            this.destroy();
            throw new Error("maxBytes cannot be less than 1");
        }
        if (this.#maxBackupCount < 1) {
            this.destroy();
            throw new Error("maxBackupCount cannot be less than 1");
        }
        await super.setup();
        if (this._mode === "w") {
            for (let i = 1; i <= this.#maxBackupCount; i++) {
                if (await exists(this._filename + "." + i)) {
                    await Deno.remove(this._filename + "." + i);
                }
            }
        }
        else if (this._mode === "x") {
            for (let i = 1; i <= this.#maxBackupCount; i++) {
                if (await exists(this._filename + "." + i)) {
                    this.destroy();
                    throw new Deno.errors.AlreadyExists("Backup log file " + this._filename + "." + i + " already exists");
                }
            }
        }
        else {
            this.#currentFileSize = (await Deno.stat(this._filename)).size;
        }
    }
    log(msg) {
        const msgByteLength = this._encoder.encode(msg).byteLength + 1;
        if (this.#currentFileSize + msgByteLength > this.#maxBytes) {
            this.rotateLogFiles();
            this.#currentFileSize = 0;
        }
        super.log(msg);
        this.#currentFileSize += msgByteLength;
    }
    rotateLogFiles() {
        this._buf.flush();
        Deno.close(this._file.rid);
        for (let i = this.#maxBackupCount - 1; i >= 0; i--) {
            const source = this._filename + (i === 0 ? "" : "." + i);
            const dest = this._filename + "." + (i + 1);
            if (existsSync(source)) {
                Deno.renameSync(source, dest);
            }
        }
        this._file = Deno.openSync(this._filename, this._openOptions);
        this._writer = this._file;
        this._buf = new BufWriterSync(this._file);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFuZGxlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoYW5kbGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsY0FBYyxFQUFhLFNBQVMsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUVuRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFaEQsTUFBTSxpQkFBaUIsR0FBRyxtQkFBbUIsQ0FBQztBQVE5QyxNQUFNLE9BQU8sV0FBVztJQUN0QixLQUFLLENBQVM7SUFDZCxTQUFTLENBQVk7SUFDckIsU0FBUyxDQUE2QjtJQUV0QyxZQUFZLFNBQW9CLEVBQUUsVUFBMEIsRUFBRTtRQUM1RCxJQUFJLENBQUMsS0FBSyxHQUFHLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztRQUUzQixJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLElBQUksaUJBQWlCLENBQUM7SUFDMUQsQ0FBQztJQUVELE1BQU0sQ0FBQyxTQUFvQjtRQUN6QixJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQUs7WUFBRSxPQUFPO1FBRXpDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkMsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxNQUFNLENBQUMsU0FBb0I7UUFDekIsSUFBSSxJQUFJLENBQUMsU0FBUyxZQUFZLFFBQVEsRUFBRTtZQUN0QyxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxD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QUFLLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFNUIsS0FBSyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2xELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUN6RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUU1QyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDdEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDL0I7U0FDRjtRQUVELElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUM5RCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDMUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbmltcG9ydCB7IGdldExldmVsQnlOYW1lLCBMZXZlbE5hbWUsIExvZ0xldmVscyB9IGZyb20gXCIuL2xldmVscy50c1wiO1xuaW1wb3J0IHR5cGUgeyBMb2dSZWNvcmQgfSBmcm9tIFwiLi9sb2dnZXIudHNcIjtcbmltcG9ydCB7IGJsdWUsIGJvbGQsIHJlZCwgeWVsbG93IH0gZnJvbSBcIi4uL2ZtdC9jb2xvcnMudHNcIjtcbmltcG9ydCB7IGV4aXN0cywgZXhpc3RzU3luYyB9IGZyb20gXCIuLi9mcy9leGlzdHMudHNcIjtcbmltcG9ydCB7IEJ1ZldyaXRlclN5bmMgfSBmcm9tIFwiLi4vaW8vYnVmZmVyLnRzXCI7XG5cbmNvbnN0IERFRkFVTFRfRk9STUFUVEVSID0gXCJ7bGV2ZWxOYW1lfSB7bXNnfVwiO1xuZXhwb3J0IHR5cGUgRm9ybWF0dGVyRnVuY3Rpb24gPSAobG9nUmVjb3JkOiBMb2dSZWNvcmQpID0+IHN0cmluZztcbmV4cG9ydCB0eXBlIExvZ01vZGUgPSBcImFcIiB8IFwid1wiIHwgXCJ4XCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGFuZGxlck9wdGlvbnMge1xuICBmb3JtYXR0ZXI/OiBzdHJpbmcgfCBGb3JtYXR0ZXJGdW5jdGlvbjtcbn1cblxuZXhwb3J0IGNsYXNzIEJhc2VIYW5kbGVyIHtcbiAgbGV2ZWw6IG51bWJlcjtcbiAgbGV2ZWxOYW1lOiBMZXZlbE5hbWU7XG4gIGZvcm1hdHRlcjogc3RyaW5nIHwgRm9ybWF0dGVyRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3IobGV2ZWxOYW1lOiBMZXZlbE5hbWUsIG9wdGlvbnM6IEhhbmRsZXJPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmxldmVsID0gZ2V0TGV2ZWxCeU5hbWUobGV2ZWxOYW1lKTtcbiAgICB0aGlzLmxldmVsTmFtZSA9IGxldmVsTmFtZTtcblxuICAgIHRoaXMuZm9ybWF0dGVyID0gb3B0aW9ucy5mb3JtYXR0ZXIgfHwgREVGQVVMVF9GT1JNQVRURVI7XG4gIH1cblxuICBoYW5kbGUobG9nUmVjb3JkOiBMb2dSZWNvcmQpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sZXZlbCA+IGxvZ1JlY29yZC5sZXZlbCkgcmV0dXJuO1xuXG4gICAgY29uc3QgbXNnID0gdGhpcy5mb3JtYXQobG9nUmVjb3JkKTtcbiAgICByZXR1cm4gdGhpcy5sb2cobXNnKTtcbiAgfVxuXG4gIGZvcm1hdChsb2dSZWNvcmQ6IExvZ1JlY29yZCk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZm9ybWF0dGVyIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiB0aGlzLmZvcm1hdHRlcihsb2dSZWNvcmQpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmZvcm1hdHRlci5yZXBsYWNlKC97KFxcUyspfS9nLCAobWF0Y2gsIHAxKTogc3RyaW5nID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gbG9nUmVjb3JkW3AxIGFzIGtleW9mIExvZ1JlY29yZF07XG5cbiAgICAgIC8vIGRvIG5vdCBpbnRlcnBvbGF0ZSBtaXNzaW5nIHZhbHVlc1xuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG1hdGNoO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICB9KTtcbiAgfVxuXG4gIGxvZyhfbXNnOiBzdHJpbmcpOiB2b2lkIHt9XG4gIGFzeW5jIHNldHVwKCkge31cbiAgYXN5bmMgZGVzdHJveSgpIHt9XG59XG5cbmV4cG9ydCBjbGFzcyBDb25zb2xlSGFuZGxlciBleHRlbmRzIEJhc2VIYW5kbGVyIHtcbiAgZm9ybWF0KGxvZ1JlY29yZDogTG9nUmVjb3JkKTogc3RyaW5nIHtcbiAgICBsZXQgbXNnID0gc3VwZXIuZm9ybWF0KGxvZ1JlY29yZCk7XG5cbiAgICBzd2l0Y2ggKGxvZ1JlY29yZC5sZXZlbCkge1xuICAgICAgY2FzZSBMb2dMZXZlbHMuSU5GTzpcbiAgICAgICAgbXNnID0gYmx1ZShtc2cpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTG9nTGV2ZWxzLldBUk5JTkc6XG4gICAgICAgIG1zZyA9IHllbGxvdyhtc2cpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgTG9nTGV2ZWxzLkVSUk9SOlxuICAgICAgICBtc2cgPSByZWQobXNnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIExvZ0xldmVscy5DUklUSUNBTDpcbiAgICAgICAgbXNnID0gYm9sZChyZWQobXNnKSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1zZztcbiAgfVxuXG4gIGxvZyhtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnNvbGUubG9nKG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFdyaXRlckhhbmRsZXIgZXh0ZW5kcyBCYXNlSGFuZGxlciB7XG4gIHByb3RlY3RlZCBfd3JpdGVyITogRGVuby5Xcml0ZXI7XG4gICNlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG5cbiAgYWJzdHJhY3QgbG9nKG1zZzogc3RyaW5nKTogdm9pZDtcbn1cblxuaW50ZXJmYWNlIEZpbGVIYW5kbGVyT3B0aW9ucyBleHRlbmRzIEhhbmRsZXJPcHRpb25zIHtcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbW9kZT86IExvZ01vZGU7XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlSGFuZGxlciBleHRlbmRzIFdyaXRlckhhbmRsZXIge1xuICBwcm90ZWN0ZWQgX2ZpbGU6IERlbm8uRmlsZSB8IHVuZGVmaW5lZDtcbiAgcHJvdGVjdGVkIF9idWYhOiBCdWZXcml0ZXJTeW5jO1xuICBwcm90ZWN0ZWQgX2ZpbGVuYW1lOiBzdHJpbmc7XG4gIHByb3RlY3RlZCBfbW9kZTogTG9nTW9kZTtcbiAgcHJvdGVjdGVkIF9vcGVuT3B0aW9uczogRGVuby5PcGVuT3B0aW9ucztcbiAgcHJvdGVjdGVkIF9lbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICN1bmxvYWRDYWxsYmFjayA9ICgoKSA9PiB7XG4gICAgdGhpcy5kZXN0cm95KCk7XG4gIH0pLmJpbmQodGhpcyk7XG5cbiAgY29uc3RydWN0b3IobGV2ZWxOYW1lOiBMZXZlbE5hbWUsIG9wdGlvbnM6IEZpbGVIYW5kbGVyT3B0aW9ucykge1xuICAgIHN1cGVyKGxldmVsTmFtZSwgb3B0aW9ucyk7XG4gICAgdGhpcy5fZmlsZW5hbWUgPSBvcHRpb25zLmZpbGVuYW1lO1xuICAgIC8vIGRlZmF1bHQgdG8gYXBwZW5kIG1vZGUsIHdyaXRlIG9ubHlcbiAgICB0aGlzLl9tb2RlID0gb3B0aW9ucy5tb2RlID8gb3B0aW9ucy5tb2RlIDogXCJhXCI7XG4gICAgdGhpcy5fb3Blbk9wdGlvbnMgPSB7XG4gICAgICBjcmVhdGVOZXc6IHRoaXMuX21vZGUgPT09IFwieFwiLFxuICAgICAgY3JlYXRlOiB0aGlzLl9tb2RlICE9PSBcInhcIixcbiAgICAgIGFwcGVuZDogdGhpcy5fbW9kZSA9PT0gXCJhXCIsXG4gICAgICB0cnVuY2F0ZTogdGhpcy5fbW9kZSAhPT0gXCJhXCIsXG4gICAgICB3cml0ZTogdHJ1ZSxcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgc2V0dXAoKSB7XG4gICAgdGhpcy5fZmlsZSA9IGF3YWl0IERlbm8ub3Blbih0aGlzLl9maWxlbmFtZSwgdGhpcy5fb3Blbk9wdGlvbnMpO1xuICAgIHRoaXMuX3dyaXRlciA9IHRoaXMuX2ZpbGU7XG4gICAgdGhpcy5fYnVmID0gbmV3IEJ1ZldyaXRlclN5bmModGhpcy5fZmlsZSk7XG5cbiAgICBhZGRFdmVudExpc3RlbmVyKFwidW5sb2FkXCIsIHRoaXMuI3VubG9hZENhbGxiYWNrKTtcbiAgfVxuXG4gIGhhbmRsZShsb2dSZWNvcmQ6IExvZ1JlY29yZCk6IHZvaWQge1xuICAgIHN1cGVyLmhhbmRsZShsb2dSZWNvcmQpO1xuXG4gICAgLy8gSW1tZWRpYXRlbHkgZmx1c2ggaWYgbG9nIGxldmVsIGlzIGhpZ2hlciB0aGFuIEVSUk9SXG4gICAgaWYgKGxvZ1JlY29yZC5sZXZlbCA+IExvZ0xldmVscy5FUlJPUikge1xuICAgICAgdGhpcy5mbHVzaCgpO1xuICAgIH1cbiAgfVxuXG4gIGxvZyhtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9lbmNvZGVyLmVuY29kZShtc2cpLmJ5dGVMZW5ndGggKyAxID4gdGhpcy5fYnVmLmF2YWlsYWJsZSgpKSB7XG4gICAgICB0aGlzLmZsdXNoKCk7XG4gICAgfVxuICAgIHRoaXMuX2J1Zi53cml0ZVN5bmModGhpcy5fZW5jb2Rlci5lbmNvZGUobXNnICsgXCJcXG5cIikpO1xuICB9XG5cbiAgZmx1c2goKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2J1Zj8uYnVmZmVyZWQoKSA+IDApIHtcbiAgICAgIHRoaXMuX2J1Zi5mbHVzaCgpO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5mbHVzaCgpO1xuICAgIHRoaXMuX2ZpbGU/LmNsb3NlKCk7XG4gICAgdGhpcy5fZmlsZSA9IHVuZGVmaW5lZDtcbiAgICByZW1vdmVFdmVudExpc3RlbmVyKFwidW5sb2FkXCIsIHRoaXMuI3VubG9hZENhbGxiYWNrKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFJvdGF0aW5nRmlsZUhhbmRsZXJPcHRpb25zIGV4dGVuZHMgRmlsZUhhbmRsZXJPcHRpb25zIHtcbiAgbWF4Qnl0ZXM6IG51bWJlcjtcbiAgbWF4QmFja3VwQ291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGNsYXNzIFJvdGF0aW5nRmlsZUhhbmRsZXIgZXh0ZW5kcyBGaWxlSGFuZGxlciB7XG4gICNtYXhCeXRlczogbnVtYmVyO1xuICAjbWF4QmFja3VwQ291bnQ6IG51bWJlcjtcbiAgI2N1cnJlbnRGaWxlU2l6ZSA9IDA7XG5cbiAgY29uc3RydWN0b3IobGV2ZWxOYW1lOiBMZXZlbE5hbWUsIG9wdGlvbnM6IFJvdGF0aW5nRmlsZUhhbmRsZXJPcHRpb25zKSB7XG4gICAgc3VwZXIobGV2ZWxOYW1lLCBvcHRpb25zKTtcbiAgICB0aGlzLiNtYXhCeXRlcyA9IG9wdGlvbnMubWF4Qnl0ZXM7XG4gICAgdGhpcy4jbWF4QmFja3VwQ291bnQgPSBvcHRpb25zLm1heEJhY2t1cENvdW50O1xuICB9XG5cbiAgYXN5bmMgc2V0dXAoKSB7XG4gICAgaWYgKHRoaXMuI21heEJ5dGVzIDwgMSkge1xuICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJtYXhCeXRlcyBjYW5ub3QgYmUgbGVzcyB0aGFuIDFcIik7XG4gICAgfVxuICAgIGlmICh0aGlzLiNtYXhCYWNrdXBDb3VudCA8IDEpIHtcbiAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwibWF4QmFja3VwQ291bnQgY2Fubm90IGJlIGxlc3MgdGhhbiAxXCIpO1xuICAgIH1cbiAgICBhd2FpdCBzdXBlci5zZXR1cCgpO1xuXG4gICAgaWYgKHRoaXMuX21vZGUgPT09IFwid1wiKSB7XG4gICAgICAvLyBSZW1vdmUgb2xkIGJhY2t1cHMgdG9vIGFzIGl0IGRvZXNuJ3QgbWFrZSBzZW5zZSB0byBzdGFydCB3aXRoIGEgY2xlYW5cbiAgICAgIC8vIGxvZyBmaWxlLCBidXQgb2xkIGJhY2t1cHNcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IHRoaXMuI21heEJhY2t1cENvdW50OyBpKyspIHtcbiAgICAgICAgaWYgKGF3YWl0IGV4aXN0cyh0aGlzLl9maWxlbmFtZSArIFwiLlwiICsgaSkpIHtcbiAgICAgICAgICBhd2FpdCBEZW5vLnJlbW92ZSh0aGlzLl9maWxlbmFtZSArIFwiLlwiICsgaSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuX21vZGUgPT09IFwieFwiKSB7XG4gICAgICAvLyBUaHJvdyBpZiBhbnkgYmFja3VwcyBhbHNvIGV4aXN0XG4gICAgICBmb3IgKGxldCBpID0gMTsgaSA8PSB0aGlzLiNtYXhCYWNrdXBDb3VudDsgaSsrKSB7XG4gICAgICAgIGlmIChhd2FpdCBleGlzdHModGhpcy5fZmlsZW5hbWUgKyBcIi5cIiArIGkpKSB7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgdGhyb3cgbmV3IERlbm8uZXJyb3JzLkFscmVhZHlFeGlzdHMoXG4gICAgICAgICAgICBcIkJhY2t1cCBsb2cgZmlsZSBcIiArIHRoaXMuX2ZpbGVuYW1lICsgXCIuXCIgKyBpICsgXCIgYWxyZWFkeSBleGlzdHNcIixcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuI2N1cnJlbnRGaWxlU2l6ZSA9IChhd2FpdCBEZW5vLnN0YXQodGhpcy5fZmlsZW5hbWUpKS5zaXplO1xuICAgIH1cbiAgfVxuXG4gIGxvZyhtc2c6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IG1zZ0J5dGVMZW5ndGggPSB0aGlzLl9lbmNvZGVyLmVuY29kZShtc2cpLmJ5dGVMZW5ndGggKyAxO1xuXG4gICAgaWYgKHRoaXMuI2N1cnJlbnRGaWxlU2l6ZSArIG1zZ0J5dGVMZW5ndGggPiB0aGlzLiNtYXhCeXRlcykge1xuICAgICAgdGhpcy5yb3RhdGVMb2dGaWxlcygpO1xuICAgICAgdGhpcy4jY3VycmVudEZpbGVTaXplID0gMDtcbiAgICB9XG5cbiAgICBzdXBlci5sb2cobXNnKTtcblxuICAgIHRoaXMuI2N1cnJlbnRGaWxlU2l6ZSArPSBtc2dCeXRlTGVuZ3RoO1xuICB9XG5cbiAgcm90YXRlTG9nRmlsZXMoKTogdm9pZCB7XG4gICAgdGhpcy5fYnVmLmZsdXNoKCk7XG4gICAgRGVuby5jbG9zZSh0aGlzLl9maWxlIS5yaWQpO1xuXG4gICAgZm9yIChsZXQgaSA9IHRoaXMuI21heEJhY2t1cENvdW50IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuX2ZpbGVuYW1lICsgKGkgPT09IDAgPyBcIlwiIDogXCIuXCIgKyBpKTtcbiAgICAgIGNvbnN0IGRlc3QgPSB0aGlzLl9maWxlbmFtZSArIFwiLlwiICsgKGkgKyAxKTtcblxuICAgICAgaWYgKGV4aXN0c1N5bmMoc291cmNlKSkge1xuICAgICAgICBEZW5vLnJlbmFtZVN5bmMoc291cmNlLCBkZXN0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9maWxlID0gRGVuby5vcGVuU3luYyh0aGlzLl9maWxlbmFtZSwgdGhpcy5fb3Blbk9wdGlvbnMpO1xuICAgIHRoaXMuX3dyaXRlciA9IHRoaXMuX2ZpbGU7XG4gICAgdGhpcy5fYnVmID0gbmV3IEJ1ZldyaXRlclN5bmModGhpcy5fZmlsZSk7XG4gIH1cbn1cbiJdfQ==