import { BufReader } from "./buf_reader.ts";
import { getFilename } from "./content_disposition.ts";
import { equals, extension, writeAll } from "./deps.ts";
import { readHeaders, toParamRegExp, unquote } from "./headers.ts";
import { httpErrors } from "./httpError.ts";
import { getRandomFilename, skipLWSPChar, stripEol } from "./util.ts";
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const BOUNDARY_PARAM_REGEX = toParamRegExp("boundary", "i");
const DEFAULT_BUFFER_SIZE = 1_048_576;
const DEFAULT_MAX_FILE_SIZE = 10_485_760;
const DEFAULT_MAX_SIZE = 0;
const NAME_PARAM_REGEX = toParamRegExp("name", "i");
function append(a, b) {
    const ab = new Uint8Array(a.length + b.length);
    ab.set(a, 0);
    ab.set(b, a.length);
    return ab;
}
function isEqual(a, b) {
    return equals(skipLWSPChar(a), b);
}
async function readToStartOrEnd(body, start, end) {
    let lineResult;
    while ((lineResult = await body.readLine())) {
        if (isEqual(lineResult.bytes, start)) {
            return true;
        }
        if (isEqual(lineResult.bytes, end)) {
            return false;
        }
    }
    throw new httpErrors.BadRequest("Unable to find multi-part boundary.");
}
async function* parts({ body, final, part, maxFileSize, maxSize, outPath, prefix }) {
    async function getFile(contentType) {
        const ext = extension(contentType);
        if (!ext) {
            throw new httpErrors.BadRequest(`Invalid media type for part: ${ext}`);
        }
        if (!outPath) {
            outPath = await Deno.makeTempDir();
        }
        const filename = `${outPath}/${await getRandomFilename(prefix, ext)}`;
        const file = await Deno.open(filename, { write: true, createNew: true });
        return [filename, file];
    }
    while (true) {
        const headers = await readHeaders(body);
        const contentType = headers["content-type"];
        const contentDisposition = headers["content-disposition"];
        if (!contentDisposition) {
            throw new httpErrors.BadRequest("Form data part missing content-disposition header");
        }
        if (!contentDisposition.match(/^form-data;/i)) {
            throw new httpErrors.BadRequest(`Unexpected content-disposition header: "${contentDisposition}"`);
        }
        const matches = NAME_PARAM_REGEX.exec(contentDisposition);
        if (!matches) {
            throw new httpErrors.BadRequest(`Unable to determine name of form body part`);
        }
        let [, name] = matches;
        name = unquote(name);
        if (contentType) {
            const originalName = getFilename(contentDisposition);
            let byteLength = 0;
            let file;
            let filename;
            let buf;
            if (maxSize) {
                buf = new Uint8Array();
            }
            else {
                const result = await getFile(contentType);
                filename = result[0];
                file = result[1];
            }
            while (true) {
                const readResult = await body.readLine(false);
                if (!readResult) {
                    throw new httpErrors.BadRequest("Unexpected EOF reached");
                }
                const { bytes } = readResult;
                const strippedBytes = stripEol(bytes);
                if (isEqual(strippedBytes, part) || isEqual(strippedBytes, final)) {
                    if (file) {
                        const bytesDiff = bytes.length - strippedBytes.length;
                        if (bytesDiff) {
                            const originalBytesSize = await file.seek(-bytesDiff, Deno.SeekMode.Current);
                            await file.truncate(originalBytesSize);
                        }
                        file.close();
                    }
                    yield [
                        name,
                        {
                            content: buf,
                            contentType,
                            name,
                            filename,
                            originalName,
                        },
                    ];
                    if (isEqual(strippedBytes, final)) {
                        return;
                    }
                    break;
                }
                byteLength += bytes.byteLength;
                if (byteLength > maxFileSize) {
                    if (file) {
                        file.close();
                    }
                    throw new httpErrors.RequestEntityTooLarge(`File size exceeds limit of ${maxFileSize} bytes.`);
                }
                if (buf) {
                    if (byteLength > maxSize) {
                        const result = await getFile(contentType);
                        filename = result[0];
                        file = result[1];
                        await writeAll(file, buf);
                        buf = undefined;
                    }
                    else {
                        buf = append(buf, bytes);
                    }
                }
                if (file) {
                    await writeAll(file, bytes);
                }
            }
        }
        else {
            const lines = [];
            while (true) {
                const readResult = await body.readLine();
                if (!readResult) {
                    throw new httpErrors.BadRequest("Unexpected EOF reached");
                }
                const { bytes } = readResult;
                if (isEqual(bytes, part) || isEqual(bytes, final)) {
                    yield [name, lines.join("\n")];
                    if (isEqual(bytes, final)) {
                        return;
                    }
                    break;
                }
                lines.push(decoder.decode(bytes));
            }
        }
    }
}
export class FormDataReader {
    #body;
    #boundaryFinal;
    #boundaryPart;
    #reading = false;
    constructor(contentType, body) {
        const matches = contentType.match(BOUNDARY_PARAM_REGEX);
        if (!matches) {
            throw new httpErrors.BadRequest(`Content type "${contentType}" does not contain a valid boundary.`);
        }
        let [, boundary] = matches;
        boundary = unquote(boundary);
        this.#boundaryPart = encoder.encode(`--${boundary}`);
        this.#boundaryFinal = encoder.encode(`--${boundary}--`);
        this.#body = body;
    }
    async read(options = {}) {
        if (this.#reading) {
            throw new Error("Body is already being read.");
        }
        this.#reading = true;
        const { outPath, maxFileSize = DEFAULT_MAX_FILE_SIZE, maxSize = DEFAULT_MAX_SIZE, bufferSize = DEFAULT_BUFFER_SIZE, } = options;
        const body = new BufReader(this.#body, bufferSize);
        const result = { fields: {} };
        if (!(await readToStartOrEnd(body, this.#boundaryPart, this.#boundaryFinal))) {
            return result;
        }
        try {
            for await (const part of parts({
                body,
                part: this.#boundaryPart,
                final: this.#boundaryFinal,
                maxFileSize,
                maxSize,
                outPath,
            })) {
                const [key, value] = part;
                if (typeof value === "string") {
                    result.fields[key] = value;
                }
                else {
                    if (!result.files) {
                        result.files = [];
                    }
                    result.files.push(value);
                }
            }
        }
        catch (err) {
            if (err instanceof Deno.errors.PermissionDenied) {
                console.error(err.stack ? err.stack : `${err.name}: ${err.message}`);
            }
            else {
                throw err;
            }
        }
        return result;
    }
    async *stream(options = {}) {
        if (this.#reading) {
            throw new Error("Body is already being read.");
        }
        this.#reading = true;
        const { outPath, maxFileSize = DEFAULT_MAX_FILE_SIZE, maxSize = DEFAULT_MAX_SIZE, bufferSize = 32000, } = options;
        const body = new BufReader(this.#body, bufferSize);
        if (!(await readToStartOrEnd(body, this.#boundaryPart, this.#boundaryFinal))) {
            return;
        }
        try {
            for await (const part of parts({
                body,
                part: this.#boundaryPart,
                final: this.#boundaryFinal,
                maxFileSize,
                maxSize,
                outPath,
            })) {
                yield part;
            }
        }
        catch (err) {
            if (err instanceof Deno.errors.PermissionDenied) {
                console.error(err.stack ? err.stack : `${err.name}: ${err.message}`);
            }
            else {
                throw err;
            }
        }
    }
    [Symbol.for("Deno.customInspect")](inspect) {
        return `${this.constructor.name} ${inspect({})}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXVsdGlwYXJ0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibXVsdGlwYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sRUFBRSxTQUFTLEVBQWtCLE1BQU0saUJBQWlCLENBQUM7QUFDNUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUN4RCxPQUFPLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxPQUFPLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFDbkUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzVDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRXRFLE1BQU0sT0FBTyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFDbEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUVsQyxNQUFNLG9CQUFvQixHQUFHLGFBQWEsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUQsTUFBTSxtQkFBbUIsR0FBRyxTQUFTLENBQUM7QUFDdEMsTUFBTSxxQkFBcUIsR0FBRyxVQUFVLENBQUM7QUFDekMsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBNEVwRCxTQUFTLE1BQU0sQ0FBQyxDQUFhLEVBQUUsQ0FBYTtJQUMxQyxNQUFNLEVBQUUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMvQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNiLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwQixPQUFPLEVBQUUsQ0FBQztBQUNaLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxDQUFhLEVBQUUsQ0FBYTtJQUMzQyxPQUFPLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDcEMsQ0FBQztBQUVELEtBQUssVUFBVSxnQkFBZ0IsQ0FDN0IsSUFBZSxFQUNmLEtBQWlCLEVBQ2pCLEdBQWU7SUFFZixJQUFJLFVBQWlDLENBQUM7SUFDdEMsT0FBTyxDQUFDLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxFQUFFO1FBQzNDLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7WUFDcEMsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEVBQUU7WUFDbEMsT0FBTyxLQUFLLENBQUM7U0FDZDtLQUNGO0lBQ0QsTUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQzdCLHFDQUFxQyxDQUN0QyxDQUFDO0FBQ0osQ0FBQztBQUlELEtBQUssU0FBUyxDQUFDLENBQUMsS0FBSyxDQUNuQixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBZ0I7SUFFMUUsS0FBSyxVQUFVLE9BQU8sQ0FBQyxXQUFtQjtRQUN4QyxNQUFNLEdBQUcsR0FBRyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLEdBQUcsRUFBRTtZQUNSLE1BQU0sSUFBSSxVQUFVLENBQUMsVUFBVSxDQUFDLGdDQUFnQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQ3hFO1FBQ0QsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNaLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztTQUNwQztRQUNELE1BQU0sUUFBUSxHQUFHLEdBQUcsT0FBTyxJQUFJLE1BQU0saUJBQWlCLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDdEUsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDekUsT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsT0FBTyxJQUFJLEVBQUU7UUFDWCxNQUFNLE9BQU8sR0FBRyxNQUFNLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDNUMsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsa0JBQWtCLEVBQUU7WUFDdkIsTUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQzdCLG1EQUFtRCxDQUNwRCxDQUFDO1NBQ0g7UUFDRCxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxFQUFFO1lBQzdDLE1BQU0sSUFBSSxVQUFVLENBQUMsVUFBVSxDQUM3QiwyQ0FBMkMsa0JBQWtCLEdBQUcsQ0FDakUsQ0FBQztTQUNIO1FBQ0QsTUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNaLE1BQU0sSUFBSSxVQUFVLENBQUMsVUFBVSxDQUM3Qiw0Q0FBNEMsQ0FDN0MsQ0FBQztTQUNIO1FBQ0QsSUFBSSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsSUFBSSxXQUFXLEVBQUU7WUFDZixNQUFNLFlBQVksR0FBRyxXQUFXLENBQUMsa0JBQWtCLENBQUMsQ0FBQztZQUNyRCxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7WUFDbkIsSUFBSSxJQUEyQixDQUFDO1lBQ2hDLElBQUksUUFBNEIsQ0FBQztZQUNqQyxJQUFJLEdBQTJCLENBQUM7WUFDaEMsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsR0FBRyxHQUFHLElBQUksVUFBVSxFQUFFLENBQUM7YUFDeEI7aUJBQU07Z0JBQ0wsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzFDLFFBQVEsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEI7WUFDRCxPQUFPLElBQUksRUFBRTtnQkFDWCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlDLElBQUksQ0FBQyxVQUFVLEVBQUU7b0JBQ2YsTUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsQ0FBQztpQkFDM0Q7Z0JBQ0QsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLFVBQVUsQ0FBQztnQkFDN0IsTUFBTSxhQUFhLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUMsRUFBRTtvQkFDakUsSUFBSSxJQUFJLEVBQUU7d0JBRVIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDO3dCQUN0RCxJQUFJLFNBQVMsRUFBRTs0QkFDYixNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FDdkMsQ0FBQyxTQUFTLEVBQ1YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQ3RCLENBQUM7NEJBQ0YsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUM7eUJBQ3hDO3dCQUVELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztxQkFDZDtvQkFDRCxNQUFNO3dCQUNKLElBQUk7d0JBQ0o7NEJBQ0UsT0FBTyxFQUFFLEdBQUc7NEJBQ1osV0FBVzs0QkFDWCxJQUFJOzRCQUNKLFFBQVE7NEJBQ1IsWUFBWTt5QkFDRztxQkFDbEIsQ0FBQztvQkFDRixJQUFJLE9BQU8sQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLEVBQUU7d0JBQ2pDLE9BQU87cUJBQ1I7b0JBQ0QsTUFBTTtpQkFDUDtnQkFDRCxVQUFVLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQztnQkFDL0IsSUFBSSxVQUFVLEdBQUcsV0FBVyxFQUFFO29CQUM1QixJQUFJLElBQUksRUFBRTt3QkFDUixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7cUJBQ2Q7b0JBQ0QsTUFBTSxJQUFJLFVBQVUsQ0FBQyxxQkFBcUIsQ0FDeEMsOEJBQThCLFdBQVcsU0FBUyxDQUNuRCxDQUFDO2lCQUNIO2dCQUNELElBQUksR0FBRyxFQUFFO29CQUNQLElBQUksVUFBVSxHQUFHLE9BQU8sRUFBRTt3QkFDeEIsTUFBTSxNQUFNLEdBQUcsTUFBTSxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQzFDLFFBQVEsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ3JCLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQ2pCLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQzt3QkFDMUIsR0FBRyxHQUFHLFNBQVMsQ0FBQztxQkFDakI7eUJBQU07d0JBQ0wsR0FBRyxHQUFHLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7cUJBQzFCO2lCQUNGO2dCQUNELElBQUksSUFBSSxFQUFFO29CQUNSLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztpQkFDN0I7YUFDRjtTQUNGO2FBQU07WUFDTCxNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7WUFDM0IsT0FBTyxJQUFJLEVBQUU7Z0JBQ1gsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3pDLElBQUksQ0FBQyxVQUFVLEVBQUU7b0JBQ2YsTUFBTSxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsQ0FBQztpQkFDM0Q7Z0JBQ0QsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLFVBQVUsQ0FBQztnQkFDN0IsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7b0JBQ2pELE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUMvQixJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7d0JBQ3pCLE9BQU87cUJBQ1I7b0JBQ0QsTUFBTTtpQkFDUDtnQkFDRCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUNuQztTQUNGO0tBQ0Y7QUFDSCxDQUFDO0FBSUQsTUFBTSxPQUFPLGNBQWM7SUFDekIsS0FBSyxDQUFjO0lBQ25CLGNBQWMsQ0FBYTtJQUMzQixhQUFhLENBQWE7SUFDMUIsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUVqQixZQUFZLFdBQW1CLEVBQUUsSUFBaUI7UUFDaEQsTUFBTSxPQUFPLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDWixNQUFNLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FDN0IsaUJBQWlCLFdBQVcsc0NBQXNDLENBQ25FLENBQUM7U0FDSDtRQUNELElBQUksQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLE9BQU8sQ0FBQztRQUMzQixRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFDckQsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztJQUNwQixDQUFDO0lBVUQsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUErQixFQUFFO1FBQzFDLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7U0FDaEQ7UUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixNQUFNLEVBQ0osT0FBTyxFQUNQLFdBQVcsR0FBRyxxQkFBcUIsRUFDbkMsT0FBTyxHQUFHLGdCQUFnQixFQUMxQixVQUFVLEdBQUcsbUJBQW1CLEdBQ2pDLEdBQUcsT0FBTyxDQUFDO1FBQ1osTUFBTSxJQUFJLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRCxNQUFNLE1BQU0sR0FBaUIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDNUMsSUFDRSxDQUFDLENBQUMsTUFBTSxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsRUFDeEU7WUFDQSxPQUFPLE1BQU0sQ0FBQztTQUNmO1FBQ0QsSUFBSTtZQUNGLElBQUksS0FBSyxFQUNQLE1BQU0sSUFBSSxJQUFJLEtBQUssQ0FBQztnQkFDbEIsSUFBSTtnQkFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLGFBQWE7Z0JBQ3hCLEtBQUssRUFBRSxJQUFJLENBQUMsY0FBYztnQkFDMUIsV0FBVztnQkFDWCxPQUFPO2dCQUNQLE9BQU87YUFDUixDQUFDLEVBQ0Y7Z0JBQ0EsTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQzFCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFO29CQUM3QixNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQztpQkFDNUI7cUJBQU07b0JBQ0wsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUU7d0JBQ2pCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO3FCQUNuQjtvQkFDRCxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDMUI7YUFDRjtTQUNGO1FBQUMsT0FBTyxHQUFHLEVBQUU7WUFDWixJQUFJLEdBQUcsWUFBWSxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixFQUFFO2dCQUMvQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksS0FBSyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzthQUN0RTtpQkFBTTtnQkFDTCxNQUFNLEdBQUcsQ0FBQzthQUNYO1NBQ0Y7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0lBTUQsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUNYLFVBQStCLEVBQUU7UUFFakMsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztTQUNoRDtRQUNELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLE1BQU0sRUFDSixPQUFPLEVBQ1AsV0FBVyxHQUFHLHFCQUFxQixFQUNuQyxPQUFPLEdBQUcsZ0JBQWdCLEVBQzFCLFVBQVUsR0FBRyxLQUFLLEdBQ25CLEdBQUcsT0FBTyxDQUFDO1FBQ1osTUFBTSxJQUFJLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNuRCxJQUNFLENBQUMsQ0FBQyxNQUFNLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxFQUN4RTtZQUNBLE9BQU87U0FDUjtRQUNELElBQUk7WUFDRixJQUFJLEtBQUssRUFDUCxNQUFNLElBQUksSUFBSSxLQUFLLENBQUM7Z0JBQ2xCLElBQUk7Z0JBQ0osSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhO2dCQUN4QixLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWM7Z0JBQzFCLFdBQVc7Z0JBQ1gsT0FBTztnQkFDUCxPQUFPO2FBQ1IsQ0FBQyxFQUNGO2dCQUNBLE1BQU0sSUFBSSxDQUFDO2FBQ1o7U0FDRjtRQUFDLE9BQU8sR0FBRyxFQUFFO1lBQ1osSUFBSSxHQUFHLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDL0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLEtBQUssR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7YUFDdEU7aUJBQU07Z0JBQ0wsTUFBTSxHQUFHLENBQUM7YUFDWDtTQUNGO0lBQ0gsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsT0FBbUM7UUFDcEUsT0FBTyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ25ELENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIG9hayBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cblxuaW1wb3J0IHsgQnVmUmVhZGVyLCBSZWFkTGluZVJlc3VsdCB9IGZyb20gXCIuL2J1Zl9yZWFkZXIudHNcIjtcbmltcG9ydCB7IGdldEZpbGVuYW1lIH0gZnJvbSBcIi4vY29udGVudF9kaXNwb3NpdGlvbi50c1wiO1xuaW1wb3J0IHsgZXF1YWxzLCBleHRlbnNpb24sIHdyaXRlQWxsIH0gZnJvbSBcIi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgcmVhZEhlYWRlcnMsIHRvUGFyYW1SZWdFeHAsIHVucXVvdGUgfSBmcm9tIFwiLi9oZWFkZXJzLnRzXCI7XG5pbXBvcnQgeyBodHRwRXJyb3JzIH0gZnJvbSBcIi4vaHR0cEVycm9yLnRzXCI7XG5pbXBvcnQgeyBnZXRSYW5kb21GaWxlbmFtZSwgc2tpcExXU1BDaGFyLCBzdHJpcEVvbCB9IGZyb20gXCIuL3V0aWwudHNcIjtcblxuY29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xuY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuXG5jb25zdCBCT1VOREFSWV9QQVJBTV9SRUdFWCA9IHRvUGFyYW1SZWdFeHAoXCJib3VuZGFyeVwiLCBcImlcIik7XG5jb25zdCBERUZBVUxUX0JVRkZFUl9TSVpFID0gMV8wNDhfNTc2OyAvLyAxbWJcbmNvbnN0IERFRkFVTFRfTUFYX0ZJTEVfU0laRSA9IDEwXzQ4NV83NjA7IC8vIDEwbWJcbmNvbnN0IERFRkFVTFRfTUFYX1NJWkUgPSAwOyAvLyBhbGwgZmlsZXMgd3JpdHRlbiB0byBkaXNjXG5jb25zdCBOQU1FX1BBUkFNX1JFR0VYID0gdG9QYXJhbVJlZ0V4cChcIm5hbWVcIiwgXCJpXCIpO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZvcm1EYXRhQm9keSB7XG4gIC8qKiBBIHJlY29yZCBvZiBmb3JtIHBhcnRzIHdoZXJlIHRoZSBrZXkgd2FzIHRoZSBgbmFtZWAgb2YgdGhlIHBhcnQgYW5kIHRoZVxuICAgKiB2YWx1ZSB3YXMgdGhlIHZhbHVlIG9mIHRoZSBwYXJ0LiBUaGlzIHJlY29yZCBkb2VzIG5vdCBpbmNsdWRlIGFueSBmaWxlc1xuICAgKiB0aGF0IHdlcmUgcGFydCBvZiB0aGUgZm9ybSBkYXRhLlxuICAgKlxuICAgKiAqTm90ZSo6IER1cGxpY2F0ZSBuYW1lcyBhcmUgbm90IGluY2x1ZGVkIGluIHRoaXMgcmVjb3JkLCBpZiB0aGVyZSBhcmVcbiAgICogZHVwbGljYXRlcywgdGhlIGxhc3QgdmFsdWUgd2lsbCBiZSB0aGUgdmFsdWUgdGhhdCBpcyBzZXQgaGVyZS4gIElmIHRoZXJlXG4gICAqIGlzIGEgcG9zc2liaWxpdHkgb2YgZHVwbGljYXRlIHZhbHVlcywgdXNlIHRoZSBgLnN0cmVhbSgpYCBtZXRob2QgdG9cbiAgICogaXRlcmF0ZSBvdmVyIHRoZSB2YWx1ZXMuICovXG4gIGZpZWxkczogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcblxuICAvKiogQW4gYXJyYXkgb2YgYW55IGZpbGVzIHRoYXQgd2VyZSBwYXJ0IG9mIHRoZSBmb3JtIGRhdGEuICovXG4gIGZpbGVzPzogRm9ybURhdGFGaWxlW107XG59XG5cbi8qKiBBIHJlcHJlc2VudGF0aW9uIG9mIGEgZmlsZSB0aGF0IGhhcyBiZWVuIHJlYWQgZnJvbSBhIGZvcm0gZGF0YSBib2R5LiAqL1xuZXhwb3J0IHR5cGUgRm9ybURhdGFGaWxlID0ge1xuICAvKiogV2hlbiB0aGUgZmlsZSBoYXMgbm90IGJlZW4gd3JpdHRlbiBvdXQgdG8gZGlzYywgdGhlIGNvbnRlbnRzIG9mIHRoZSBmaWxlXG4gICAqIGFzIGEgYFVpbnQ4QXJyYXlgLiAqL1xuICBjb250ZW50PzogVWludDhBcnJheTtcblxuICAvKiogVGhlIGNvbnRlbnQgdHlwZSBvZyB0aGUgZm9ybSBkYXRhIGZpbGUuICovXG4gIGNvbnRlbnRUeXBlOiBzdHJpbmc7XG5cbiAgLyoqIFdoZW4gdGhlIGZpbGUgaGFzIGJlZW4gd3JpdHRlbiBvdXQgdG8gZGlzYywgdGhlIGZ1bGwgcGF0aCB0byB0aGUgZmlsZS4gKi9cbiAgZmlsZW5hbWU/OiBzdHJpbmc7XG5cbiAgLyoqIFRoZSBgbmFtZWAgdGhhdCB3YXMgYXNzaWduZWQgdG8gdGhlIGZvcm0gZGF0YSBmaWxlLiAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqIFRoZSBgZmlsZW5hbWVgIHRoYXQgd2FzIHByb3ZpZGVkIGluIHRoZSBmb3JtIGRhdGEgZmlsZS4gKi9cbiAgb3JpZ2luYWxOYW1lOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIEZvcm1EYXRhUmVhZE9wdGlvbnMge1xuICAvKiogVGhlIHNpemUgb2YgdGhlIGJ1ZmZlciB0byByZWFkIGZyb20gdGhlIHJlcXVlc3QgYm9keSBhdCBhIHNpbmdsZSB0aW1lLlxuICAgKiBUaGlzIGRlZmF1bHRzIHRvIDFtYi4gKi9cbiAgYnVmZmVyU2l6ZT86IG51bWJlcjtcblxuICAvKiogVGhlIG1heGltdW0gZmlsZSBzaXplIHRoYXQgY2FuIGJlIGhhbmRsZWQuICBUaGlzIGRlZmF1bHRzIHRvIDEwTUIgd2hlblxuICAgKiBub3Qgc3BlY2lmaWVkLiAgVGhpcyBpcyB0byB0cnkgdG8gYXZvaWQgRE9TIGF0dGFja3Mgd2hlcmUgc29tZW9uZSB3b3VsZFxuICAgKiBjb250aW51ZSB0byB0cnkgdG8gc2VuZCBhIFwiZmlsZVwiIGNvbnRpbnVvdXNseSB1bnRpbCBhIGhvc3QgbGltaXQgd2FzXG4gICAqIHJlYWNoZWQgY3Jhc2hpbmcgdGhlIHNlcnZlciBvciB0aGUgaG9zdC4gKi9cbiAgbWF4RmlsZVNpemU/OiBudW1iZXI7XG5cbiAgLyoqIFRoZSBtYXhpbXVtIHNpemUgb2YgYSBmaWxlIHRvIGhvbGQgaW4gbWVtb3J5LCBhbmQgbm90IHdyaXRlIHRvIGRpc2suIFRoaXNcbiAgICogZGVmYXVsdHMgdG8gYDBgLCBzbyB0aGF0IGFsbCBtdWx0aXBhcnQgZm9ybSBmaWxlcyBhcmUgd3JpdHRlbiB0byBkaXNrLlxuICAgKiBXaGVuIHNldCB0byBhIHBvc2l0aXZlIGludGVnZXIsIGlmIHRoZSBmb3JtIGRhdGEgZmlsZSBpcyBzbWFsbGVyLCBpdCB3aWxsXG4gICAqIGJlIHJldGFpbmVkIGluIG1lbW9yeSBhbmQgYXZhaWxhYmxlIGluIHRoZSBgLmNvbnRlbnRgIHByb3BlcnR5IG9mIHRoZVxuICAgKiBgRm9ybURhdGFGaWxlYCBvYmplY3QuICBJZiB0aGUgZmlsZSBleGNlZWRzIHRoZSBgbWF4U2l6ZWAgaXQgd2lsbCBiZVxuICAgKiB3cml0dGVuIHRvIGRpc2sgYW5kIHRoZSBgZmlsZW5hbWVgIGZpbGUgd2lsbCBjb250YWluIHRoZSBmdWxsIHBhdGggdG8gdGhlXG4gICAqIG91dHB1dCBmaWxlLiAqL1xuICBtYXhTaXplPzogbnVtYmVyO1xuXG4gIC8qKiBXaGVuIHdyaXRpbmcgZm9ybSBkYXRhIGZpbGVzIHRvIGRpc2ssIHRoZSBvdXRwdXQgcGF0aC4gIFRoaXMgd2lsbCBkZWZhdWx0XG4gICAqIHRvIGEgdGVtcG9yYXJ5IHBhdGggZ2VuZXJhdGVkIGJ5IGBEZW5vLm1ha2VUZW1wRGlyKClgLiAqL1xuICBvdXRQYXRoPzogc3RyaW5nO1xuXG4gIC8qKiBXaGVuIGEgZm9ybSBkYXRhIGZpbGUgaXMgd3JpdHRlbiB0byBkaXNrLCBpdCB3aWxsIGJlIGdlbmVyYXRlZCB3aXRoIGFcbiAgICogcmFuZG9tIGZpbGVuYW1lIGFuZCBoYXZlIGFuIGV4dGVuc2lvbiBiYXNlZCBvZmYgdGhlIGNvbnRlbnQgdHlwZSBmb3IgdGhlXG4gICAqIGZpbGUuICBgcHJlZml4YCBjYW4gYmUgc3BlY2lmaWVkIHRob3VnaCB0byBwcmVwZW5kIHRvIHRoZSBmaWxlIG5hbWUuICovXG4gIHByZWZpeD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFBhcnRzT3B0aW9ucyB7XG4gIGJvZHk6IEJ1ZlJlYWRlcjtcbiAgZmluYWw6IFVpbnQ4QXJyYXk7XG4gIG1heEZpbGVTaXplOiBudW1iZXI7XG4gIG1heFNpemU6IG51bWJlcjtcbiAgb3V0UGF0aD86IHN0cmluZztcbiAgcGFydDogVWludDhBcnJheTtcbiAgcHJlZml4Pzogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBhcHBlbmQoYTogVWludDhBcnJheSwgYjogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkge1xuICBjb25zdCBhYiA9IG5ldyBVaW50OEFycmF5KGEubGVuZ3RoICsgYi5sZW5ndGgpO1xuICBhYi5zZXQoYSwgMCk7XG4gIGFiLnNldChiLCBhLmxlbmd0aCk7XG4gIHJldHVybiBhYjtcbn1cblxuZnVuY3Rpb24gaXNFcXVhbChhOiBVaW50OEFycmF5LCBiOiBVaW50OEFycmF5KTogYm9vbGVhbiB7XG4gIHJldHVybiBlcXVhbHMoc2tpcExXU1BDaGFyKGEpLCBiKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZFRvU3RhcnRPckVuZChcbiAgYm9keTogQnVmUmVhZGVyLFxuICBzdGFydDogVWludDhBcnJheSxcbiAgZW5kOiBVaW50OEFycmF5LFxuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGxldCBsaW5lUmVzdWx0OiBSZWFkTGluZVJlc3VsdCB8IG51bGw7XG4gIHdoaWxlICgobGluZVJlc3VsdCA9IGF3YWl0IGJvZHkucmVhZExpbmUoKSkpIHtcbiAgICBpZiAoaXNFcXVhbChsaW5lUmVzdWx0LmJ5dGVzLCBzdGFydCkpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoaXNFcXVhbChsaW5lUmVzdWx0LmJ5dGVzLCBlbmQpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBodHRwRXJyb3JzLkJhZFJlcXVlc3QoXG4gICAgXCJVbmFibGUgdG8gZmluZCBtdWx0aS1wYXJ0IGJvdW5kYXJ5LlwiLFxuICApO1xufVxuXG4vKiogWWllbGQgdXAgaW5kaXZpZHVhbCBwYXJ0cyBieSByZWFkaW5nIHRoZSBib2R5IGFuZCBwYXJzaW5nIG91dCB0aGUgZm9yZFxuICogZGF0YSB2YWx1ZXMuICovXG5hc3luYyBmdW5jdGlvbiogcGFydHMoXG4gIHsgYm9keSwgZmluYWwsIHBhcnQsIG1heEZpbGVTaXplLCBtYXhTaXplLCBvdXRQYXRoLCBwcmVmaXggfTogUGFydHNPcHRpb25zLFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFtzdHJpbmcsIHN0cmluZyB8IEZvcm1EYXRhRmlsZV0+IHtcbiAgYXN5bmMgZnVuY3Rpb24gZ2V0RmlsZShjb250ZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxbc3RyaW5nLCBEZW5vLkZpbGVdPiB7XG4gICAgY29uc3QgZXh0ID0gZXh0ZW5zaW9uKGNvbnRlbnRUeXBlKTtcbiAgICBpZiAoIWV4dCkge1xuICAgICAgdGhyb3cgbmV3IGh0dHBFcnJvcnMuQmFkUmVxdWVzdChgSW52YWxpZCBtZWRpYSB0eXBlIGZvciBwYXJ0OiAke2V4dH1gKTtcbiAgICB9XG4gICAgaWYgKCFvdXRQYXRoKSB7XG4gICAgICBvdXRQYXRoID0gYXdhaXQgRGVuby5tYWtlVGVtcERpcigpO1xuICAgIH1cbiAgICBjb25zdCBmaWxlbmFtZSA9IGAke291dFBhdGh9LyR7YXdhaXQgZ2V0UmFuZG9tRmlsZW5hbWUocHJlZml4LCBleHQpfWA7XG4gICAgY29uc3QgZmlsZSA9IGF3YWl0IERlbm8ub3BlbihmaWxlbmFtZSwgeyB3cml0ZTogdHJ1ZSwgY3JlYXRlTmV3OiB0cnVlIH0pO1xuICAgIHJldHVybiBbZmlsZW5hbWUsIGZpbGVdO1xuICB9XG5cbiAgd2hpbGUgKHRydWUpIHtcbiAgICBjb25zdCBoZWFkZXJzID0gYXdhaXQgcmVhZEhlYWRlcnMoYm9keSk7XG4gICAgY29uc3QgY29udGVudFR5cGUgPSBoZWFkZXJzW1wiY29udGVudC10eXBlXCJdO1xuICAgIGNvbnN0IGNvbnRlbnREaXNwb3NpdGlvbiA9IGhlYWRlcnNbXCJjb250ZW50LWRpc3Bvc2l0aW9uXCJdO1xuICAgIGlmICghY29udGVudERpc3Bvc2l0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgaHR0cEVycm9ycy5CYWRSZXF1ZXN0KFxuICAgICAgICBcIkZvcm0gZGF0YSBwYXJ0IG1pc3NpbmcgY29udGVudC1kaXNwb3NpdGlvbiBoZWFkZXJcIixcbiAgICAgICk7XG4gICAgfVxuICAgIGlmICghY29udGVudERpc3Bvc2l0aW9uLm1hdGNoKC9eZm9ybS1kYXRhOy9pKSkge1xuICAgICAgdGhyb3cgbmV3IGh0dHBFcnJvcnMuQmFkUmVxdWVzdChcbiAgICAgICAgYFVuZXhwZWN0ZWQgY29udGVudC1kaXNwb3NpdGlvbiBoZWFkZXI6IFwiJHtjb250ZW50RGlzcG9zaXRpb259XCJgLFxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgbWF0Y2hlcyA9IE5BTUVfUEFSQU1fUkVHRVguZXhlYyhjb250ZW50RGlzcG9zaXRpb24pO1xuICAgIGlmICghbWF0Y2hlcykge1xuICAgICAgdGhyb3cgbmV3IGh0dHBFcnJvcnMuQmFkUmVxdWVzdChcbiAgICAgICAgYFVuYWJsZSB0byBkZXRlcm1pbmUgbmFtZSBvZiBmb3JtIGJvZHkgcGFydGAsXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgWywgbmFtZV0gPSBtYXRjaGVzO1xuICAgIG5hbWUgPSB1bnF1b3RlKG5hbWUpO1xuICAgIGlmIChjb250ZW50VHlwZSkge1xuICAgICAgY29uc3Qgb3JpZ2luYWxOYW1lID0gZ2V0RmlsZW5hbWUoY29udGVudERpc3Bvc2l0aW9uKTtcbiAgICAgIGxldCBieXRlTGVuZ3RoID0gMDtcbiAgICAgIGxldCBmaWxlOiBEZW5vLkZpbGUgfCB1bmRlZmluZWQ7XG4gICAgICBsZXQgZmlsZW5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBidWY6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAobWF4U2l6ZSkge1xuICAgICAgICBidWYgPSBuZXcgVWludDhBcnJheSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0RmlsZShjb250ZW50VHlwZSk7XG4gICAgICAgIGZpbGVuYW1lID0gcmVzdWx0WzBdO1xuICAgICAgICBmaWxlID0gcmVzdWx0WzFdO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgcmVhZFJlc3VsdCA9IGF3YWl0IGJvZHkucmVhZExpbmUoZmFsc2UpO1xuICAgICAgICBpZiAoIXJlYWRSZXN1bHQpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgaHR0cEVycm9ycy5CYWRSZXF1ZXN0KFwiVW5leHBlY3RlZCBFT0YgcmVhY2hlZFwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IGJ5dGVzIH0gPSByZWFkUmVzdWx0O1xuICAgICAgICBjb25zdCBzdHJpcHBlZEJ5dGVzID0gc3RyaXBFb2woYnl0ZXMpO1xuICAgICAgICBpZiAoaXNFcXVhbChzdHJpcHBlZEJ5dGVzLCBwYXJ0KSB8fCBpc0VxdWFsKHN0cmlwcGVkQnl0ZXMsIGZpbmFsKSkge1xuICAgICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgZXh0cmEgMiBieXRlcyAoW0NSLCBMRl0pIGZyb20gcmVzdWx0IGZpbGVcbiAgICAgICAgICAgIGNvbnN0IGJ5dGVzRGlmZiA9IGJ5dGVzLmxlbmd0aCAtIHN0cmlwcGVkQnl0ZXMubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGJ5dGVzRGlmZikge1xuICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbEJ5dGVzU2l6ZSA9IGF3YWl0IGZpbGUuc2VlayhcbiAgICAgICAgICAgICAgICAtYnl0ZXNEaWZmLFxuICAgICAgICAgICAgICAgIERlbm8uU2Vla01vZGUuQ3VycmVudCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgYXdhaXQgZmlsZS50cnVuY2F0ZShvcmlnaW5hbEJ5dGVzU2l6ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbGUuY2xvc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgeWllbGQgW1xuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY29udGVudDogYnVmLFxuICAgICAgICAgICAgICBjb250ZW50VHlwZSxcbiAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgZmlsZW5hbWUsXG4gICAgICAgICAgICAgIG9yaWdpbmFsTmFtZSxcbiAgICAgICAgICAgIH0gYXMgRm9ybURhdGFGaWxlLFxuICAgICAgICAgIF07XG4gICAgICAgICAgaWYgKGlzRXF1YWwoc3RyaXBwZWRCeXRlcywgZmluYWwpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJ5dGVMZW5ndGggKz0gYnl0ZXMuYnl0ZUxlbmd0aDtcbiAgICAgICAgaWYgKGJ5dGVMZW5ndGggPiBtYXhGaWxlU2l6ZSkge1xuICAgICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgICBmaWxlLmNsb3NlKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IG5ldyBodHRwRXJyb3JzLlJlcXVlc3RFbnRpdHlUb29MYXJnZShcbiAgICAgICAgICAgIGBGaWxlIHNpemUgZXhjZWVkcyBsaW1pdCBvZiAke21heEZpbGVTaXplfSBieXRlcy5gLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJ1Zikge1xuICAgICAgICAgIGlmIChieXRlTGVuZ3RoID4gbWF4U2l6ZSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0RmlsZShjb250ZW50VHlwZSk7XG4gICAgICAgICAgICBmaWxlbmFtZSA9IHJlc3VsdFswXTtcbiAgICAgICAgICAgIGZpbGUgPSByZXN1bHRbMV07XG4gICAgICAgICAgICBhd2FpdCB3cml0ZUFsbChmaWxlLCBidWYpO1xuICAgICAgICAgICAgYnVmID0gdW5kZWZpbmVkO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBidWYgPSBhcHBlbmQoYnVmLCBieXRlcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmaWxlKSB7XG4gICAgICAgICAgYXdhaXQgd3JpdGVBbGwoZmlsZSwgYnl0ZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgY29uc3QgcmVhZFJlc3VsdCA9IGF3YWl0IGJvZHkucmVhZExpbmUoKTtcbiAgICAgICAgaWYgKCFyZWFkUmVzdWx0KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IGh0dHBFcnJvcnMuQmFkUmVxdWVzdChcIlVuZXhwZWN0ZWQgRU9GIHJlYWNoZWRcIik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgeyBieXRlcyB9ID0gcmVhZFJlc3VsdDtcbiAgICAgICAgaWYgKGlzRXF1YWwoYnl0ZXMsIHBhcnQpIHx8IGlzRXF1YWwoYnl0ZXMsIGZpbmFsKSkge1xuICAgICAgICAgIHlpZWxkIFtuYW1lLCBsaW5lcy5qb2luKFwiXFxuXCIpXTtcbiAgICAgICAgICBpZiAoaXNFcXVhbChieXRlcywgZmluYWwpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGxpbmVzLnB1c2goZGVjb2Rlci5kZWNvZGUoYnl0ZXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqIEEgY2xhc3Mgd2hpY2ggcHJvdmlkZXMgYW4gaW50ZXJmYWNlIHRvIGFjY2VzcyB0aGUgZmllbGRzIG9mIGFcbiAqIGBtdWx0aXBhcnQvZm9ybS1kYXRhYCBib2R5LiAqL1xuZXhwb3J0IGNsYXNzIEZvcm1EYXRhUmVhZGVyIHtcbiAgI2JvZHk6IERlbm8uUmVhZGVyO1xuICAjYm91bmRhcnlGaW5hbDogVWludDhBcnJheTtcbiAgI2JvdW5kYXJ5UGFydDogVWludDhBcnJheTtcbiAgI3JlYWRpbmcgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3Rvcihjb250ZW50VHlwZTogc3RyaW5nLCBib2R5OiBEZW5vLlJlYWRlcikge1xuICAgIGNvbnN0IG1hdGNoZXMgPSBjb250ZW50VHlwZS5tYXRjaChCT1VOREFSWV9QQVJBTV9SRUdFWCk7XG4gICAgaWYgKCFtYXRjaGVzKSB7XG4gICAgICB0aHJvdyBuZXcgaHR0cEVycm9ycy5CYWRSZXF1ZXN0KFxuICAgICAgICBgQ29udGVudCB0eXBlIFwiJHtjb250ZW50VHlwZX1cIiBkb2VzIG5vdCBjb250YWluIGEgdmFsaWQgYm91bmRhcnkuYCxcbiAgICAgICk7XG4gICAgfVxuICAgIGxldCBbLCBib3VuZGFyeV0gPSBtYXRjaGVzO1xuICAgIGJvdW5kYXJ5ID0gdW5xdW90ZShib3VuZGFyeSk7XG4gICAgdGhpcy4jYm91bmRhcnlQYXJ0ID0gZW5jb2Rlci5lbmNvZGUoYC0tJHtib3VuZGFyeX1gKTtcbiAgICB0aGlzLiNib3VuZGFyeUZpbmFsID0gZW5jb2Rlci5lbmNvZGUoYC0tJHtib3VuZGFyeX0tLWApO1xuICAgIHRoaXMuI2JvZHkgPSBib2R5O1xuICB9XG5cbiAgLyoqIFJlYWRzIHRoZSBtdWx0aXBhcnQgYm9keSBvZiB0aGUgcmVzcG9uc2UgYW5kIHJlc29sdmVzIHdpdGggYW4gb2JqZWN0IHdoaWNoXG4gICAqIGNvbnRhaW5zIGZpZWxkcyBhbmQgZmlsZXMgdGhhdCB3ZXJlIHBhcnQgb2YgdGhlIHJlc3BvbnNlLlxuICAgKlxuICAgKiAqTm90ZSo6IHRoaXMgbWV0aG9kIGhhbmRsZXMgbXVsdGlwbGUgZmlsZXMgd2l0aCB0aGUgc2FtZSBgbmFtZWAgYXR0cmlidXRlXG4gICAqIGluIHRoZSByZXF1ZXN0LCBidXQgYnkgZGVzaWduIGl0IGRvZXMgbm90IGhhbmRsZSBtdWx0aXBsZSBmaWVsZHMgdGhhdCBzaGFyZVxuICAgKiB0aGUgc2FtZSBgbmFtZWAuICBJZiB5b3UgZXhwZWN0IHRoZSByZXF1ZXN0IGJvZHkgdG8gY29udGFpbiBtdWx0aXBsZSBmb3JtXG4gICAqIGRhdGEgZmllbGRzIHdpdGggdGhlIHNhbWUgbmFtZSwgaXQgaXMgYmV0dGVyIHRvIHVzZSB0aGUgYC5zdHJlYW0oKWAgbWV0aG9kXG4gICAqIHdoaWNoIHdpbGwgaXRlcmF0ZSBvdmVyIGVhY2ggZm9ybSBkYXRhIGZpZWxkIGluZGl2aWR1YWxseS4gKi9cbiAgYXN5bmMgcmVhZChvcHRpb25zOiBGb3JtRGF0YVJlYWRPcHRpb25zID0ge30pOiBQcm9taXNlPEZvcm1EYXRhQm9keT4ge1xuICAgIGlmICh0aGlzLiNyZWFkaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCb2R5IGlzIGFscmVhZHkgYmVpbmcgcmVhZC5cIik7XG4gICAgfVxuICAgIHRoaXMuI3JlYWRpbmcgPSB0cnVlO1xuICAgIGNvbnN0IHtcbiAgICAgIG91dFBhdGgsXG4gICAgICBtYXhGaWxlU2l6ZSA9IERFRkFVTFRfTUFYX0ZJTEVfU0laRSxcbiAgICAgIG1heFNpemUgPSBERUZBVUxUX01BWF9TSVpFLFxuICAgICAgYnVmZmVyU2l6ZSA9IERFRkFVTFRfQlVGRkVSX1NJWkUsXG4gICAgfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgYm9keSA9IG5ldyBCdWZSZWFkZXIodGhpcy4jYm9keSwgYnVmZmVyU2l6ZSk7XG4gICAgY29uc3QgcmVzdWx0OiBGb3JtRGF0YUJvZHkgPSB7IGZpZWxkczoge30gfTtcbiAgICBpZiAoXG4gICAgICAhKGF3YWl0IHJlYWRUb1N0YXJ0T3JFbmQoYm9keSwgdGhpcy4jYm91bmRhcnlQYXJ0LCB0aGlzLiNib3VuZGFyeUZpbmFsKSlcbiAgICApIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICBmb3IgYXdhaXQgKFxuICAgICAgICBjb25zdCBwYXJ0IG9mIHBhcnRzKHtcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIHBhcnQ6IHRoaXMuI2JvdW5kYXJ5UGFydCxcbiAgICAgICAgICBmaW5hbDogdGhpcy4jYm91bmRhcnlGaW5hbCxcbiAgICAgICAgICBtYXhGaWxlU2l6ZSxcbiAgICAgICAgICBtYXhTaXplLFxuICAgICAgICAgIG91dFBhdGgsXG4gICAgICAgIH0pXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgW2tleSwgdmFsdWVdID0gcGFydDtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIHJlc3VsdC5maWVsZHNba2V5XSA9IHZhbHVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICghcmVzdWx0LmZpbGVzKSB7XG4gICAgICAgICAgICByZXN1bHQuZmlsZXMgPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmVzdWx0LmZpbGVzLnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuUGVybWlzc2lvbkRlbmllZCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVyci5zdGFjayA/IGVyci5zdGFjayA6IGAke2Vyci5uYW1lfTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIGFuIGl0ZXJhdG9yIHdoaWNoIHdpbGwgYXN5bmNocm9ub3VzbHkgeWllbGQgZWFjaCBwYXJ0IG9mIHRoZSBmb3JtXG4gICAqIGRhdGEuICBUaGUgeWllbGRlZCB2YWx1ZSBpcyBhIHR1cGxlLCB3aGVyZSB0aGUgZmlyc3QgZWxlbWVudCBpcyB0aGUgbmFtZVxuICAgKiBvZiB0aGUgcGFydCBhbmQgdGhlIHNlY29uZCBlbGVtZW50IGlzIGEgYHN0cmluZ2Agb3IgYSBgRm9ybURhdGFGaWxlYFxuICAgKiBvYmplY3QuICovXG4gIGFzeW5jICpzdHJlYW0oXG4gICAgb3B0aW9uczogRm9ybURhdGFSZWFkT3B0aW9ucyA9IHt9LFxuICApOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8W3N0cmluZywgc3RyaW5nIHwgRm9ybURhdGFGaWxlXT4ge1xuICAgIGlmICh0aGlzLiNyZWFkaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCb2R5IGlzIGFscmVhZHkgYmVpbmcgcmVhZC5cIik7XG4gICAgfVxuICAgIHRoaXMuI3JlYWRpbmcgPSB0cnVlO1xuICAgIGNvbnN0IHtcbiAgICAgIG91dFBhdGgsXG4gICAgICBtYXhGaWxlU2l6ZSA9IERFRkFVTFRfTUFYX0ZJTEVfU0laRSxcbiAgICAgIG1heFNpemUgPSBERUZBVUxUX01BWF9TSVpFLFxuICAgICAgYnVmZmVyU2l6ZSA9IDMyMDAwLFxuICAgIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IGJvZHkgPSBuZXcgQnVmUmVhZGVyKHRoaXMuI2JvZHksIGJ1ZmZlclNpemUpO1xuICAgIGlmIChcbiAgICAgICEoYXdhaXQgcmVhZFRvU3RhcnRPckVuZChib2R5LCB0aGlzLiNib3VuZGFyeVBhcnQsIHRoaXMuI2JvdW5kYXJ5RmluYWwpKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgZm9yIGF3YWl0IChcbiAgICAgICAgY29uc3QgcGFydCBvZiBwYXJ0cyh7XG4gICAgICAgICAgYm9keSxcbiAgICAgICAgICBwYXJ0OiB0aGlzLiNib3VuZGFyeVBhcnQsXG4gICAgICAgICAgZmluYWw6IHRoaXMuI2JvdW5kYXJ5RmluYWwsXG4gICAgICAgICAgbWF4RmlsZVNpemUsXG4gICAgICAgICAgbWF4U2l6ZSxcbiAgICAgICAgICBvdXRQYXRoLFxuICAgICAgICB9KVxuICAgICAgKSB7XG4gICAgICAgIHlpZWxkIHBhcnQ7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuUGVybWlzc2lvbkRlbmllZCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVyci5zdGFjayA/IGVyci5zdGFjayA6IGAke2Vyci5uYW1lfTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBbU3ltYm9sLmZvcihcIkRlbm8uY3VzdG9tSW5zcGVjdFwiKV0oaW5zcGVjdDogKHZhbHVlOiB1bmtub3duKSA9PiBzdHJpbmcpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSAke2luc3BlY3Qoe30pfWA7XG4gIH1cbn1cbiJdfQ==