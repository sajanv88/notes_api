import { Bson } from "../../deps.ts";
export function createUploadStream({ chunkSizeBytes, chunksCollection, filesCollection }, filename, id, options) {
    const chunkSizeBytesCombined = options?.chunkSizeBytes ?? chunkSizeBytes;
    const uploadBuffer = new Uint8Array(new ArrayBuffer(chunkSizeBytesCombined));
    let bufferPosition = 0;
    let chunksInserted = 0;
    let fileSizeBytes = 0;
    return new WritableStream({
        write: async (chunk) => {
            let remaining = chunk;
            while (remaining.byteLength) {
                const availableBuffer = chunkSizeBytesCombined - bufferPosition;
                if (remaining.byteLength < availableBuffer) {
                    uploadBuffer.set(remaining, bufferPosition);
                    bufferPosition += remaining.byteLength;
                    fileSizeBytes += remaining.byteLength;
                    break;
                }
                const sliced = remaining.slice(0, availableBuffer);
                remaining = remaining.slice(availableBuffer);
                uploadBuffer.set(sliced, bufferPosition);
                await chunksCollection.insertOne({
                    files_id: id,
                    n: chunksInserted,
                    data: new Bson.Binary(uploadBuffer),
                });
                bufferPosition = 0;
                fileSizeBytes += sliced.byteLength;
                ++chunksInserted;
            }
        },
        close: async () => {
            if (bufferPosition) {
                await chunksCollection.insertOne({
                    files_id: id,
                    n: chunksInserted,
                    data: new Bson.Binary(uploadBuffer.slice(0, bufferPosition)),
                });
            }
            await filesCollection.insertOne({
                _id: id,
                length: fileSizeBytes,
                chunkSize: chunkSizeBytesCombined,
                uploadDate: new Date(),
                filename: filename,
                metadata: options?.metadata,
            });
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBsb2FkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidXBsb2FkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFVckMsTUFBTSxVQUFVLGtCQUFrQixDQUNoQyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlLEVBQWMsRUFDakUsUUFBZ0IsRUFDaEIsRUFBaUIsRUFDakIsT0FBNkI7SUFFN0IsTUFBTSxzQkFBc0IsR0FBRyxPQUFPLEVBQUUsY0FBYyxJQUFJLGNBQWMsQ0FBQztJQUN6RSxNQUFNLFlBQVksR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7SUFDN0UsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLElBQUksY0FBYyxHQUFHLENBQUMsQ0FBQztJQUN2QixJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUM7SUFDdEIsT0FBTyxJQUFJLGNBQWMsQ0FBYTtRQUNwQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQWlCLEVBQUUsRUFBRTtZQUNqQyxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDdEIsT0FBTyxTQUFTLENBQUMsVUFBVSxFQUFFO2dCQUMzQixNQUFNLGVBQWUsR0FBRyxzQkFBc0IsR0FBRyxjQUFjLENBQUM7Z0JBQ2hFLElBQUksU0FBUyxDQUFDLFVBQVUsR0FBRyxlQUFlLEVBQUU7b0JBQzFDLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO29CQUM1QyxjQUFjLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQztvQkFDdkMsYUFBYSxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUM7b0JBQ3RDLE1BQU07aUJBQ1A7Z0JBQ0QsTUFBTSxNQUFNLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBQ25ELFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM3QyxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztnQkFFekMsTUFBTSxnQkFBZ0IsQ0FBQyxTQUFTLENBQUM7b0JBQy9CLFFBQVEsRUFBRSxFQUFFO29CQUNaLENBQUMsRUFBRSxjQUFjO29CQUNqQixJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQztpQkFDcEMsQ0FBQyxDQUFDO2dCQUVILGNBQWMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLGFBQWEsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDO2dCQUNuQyxFQUFFLGNBQWMsQ0FBQzthQUNsQjtRQUNILENBQUM7UUFDRCxLQUFLLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFFaEIsSUFBSSxjQUFjLEVBQUU7Z0JBQ2xCLE1BQU0sZ0JBQWdCLENBQUMsU0FBUyxDQUFDO29CQUMvQixRQUFRLEVBQUUsRUFBRTtvQkFDWixDQUFDLEVBQUUsY0FBYztvQkFDakIsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQztpQkFDN0QsQ0FBQyxDQUFDO2FBQ0o7WUFFRCxNQUFNLGVBQWUsQ0FBQyxTQUFTLENBQUM7Z0JBQzlCLEdBQUcsRUFBRSxFQUFFO2dCQUNQLE1BQU0sRUFBRSxhQUFhO2dCQUNyQixTQUFTLEVBQUUsc0JBQXNCO2dCQUNqQyxVQUFVLEVBQUUsSUFBSSxJQUFJLEVBQUU7Z0JBQ3RCLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVE7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCc29uIH0gZnJvbSBcIi4uLy4uL2RlcHMudHNcIjtcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tIFwiLi4vLi4vbW9kLnRzXCI7XG5pbXBvcnQgeyBDaHVuaywgRmlsZSwgR3JpZEZTVXBsb2FkT3B0aW9ucyB9IGZyb20gXCIuLi90eXBlcy9ncmlkZnMudHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBCdWNrZXRJbmZvIHtcbiAgZmlsZXNDb2xsZWN0aW9uOiBDb2xsZWN0aW9uPEZpbGU+O1xuICBjaHVua3NDb2xsZWN0aW9uOiBDb2xsZWN0aW9uPENodW5rPjtcbiAgY2h1bmtTaXplQnl0ZXM6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVVwbG9hZFN0cmVhbShcbiAgeyBjaHVua1NpemVCeXRlcywgY2h1bmtzQ29sbGVjdGlvbiwgZmlsZXNDb2xsZWN0aW9uIH06IEJ1Y2tldEluZm8sXG4gIGZpbGVuYW1lOiBzdHJpbmcsXG4gIGlkOiBCc29uLk9iamVjdElkLFxuICBvcHRpb25zPzogR3JpZEZTVXBsb2FkT3B0aW9ucyxcbikge1xuICBjb25zdCBjaHVua1NpemVCeXRlc0NvbWJpbmVkID0gb3B0aW9ucz8uY2h1bmtTaXplQnl0ZXMgPz8gY2h1bmtTaXplQnl0ZXM7XG4gIGNvbnN0IHVwbG9hZEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG5ldyBBcnJheUJ1ZmZlcihjaHVua1NpemVCeXRlc0NvbWJpbmVkKSk7XG4gIGxldCBidWZmZXJQb3NpdGlvbiA9IDA7XG4gIGxldCBjaHVua3NJbnNlcnRlZCA9IDA7XG4gIGxldCBmaWxlU2l6ZUJ5dGVzID0gMDtcbiAgcmV0dXJuIG5ldyBXcml0YWJsZVN0cmVhbTxVaW50OEFycmF5Pih7XG4gICAgd3JpdGU6IGFzeW5jIChjaHVuazogVWludDhBcnJheSkgPT4ge1xuICAgICAgbGV0IHJlbWFpbmluZyA9IGNodW5rO1xuICAgICAgd2hpbGUgKHJlbWFpbmluZy5ieXRlTGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGF2YWlsYWJsZUJ1ZmZlciA9IGNodW5rU2l6ZUJ5dGVzQ29tYmluZWQgLSBidWZmZXJQb3NpdGlvbjtcbiAgICAgICAgaWYgKHJlbWFpbmluZy5ieXRlTGVuZ3RoIDwgYXZhaWxhYmxlQnVmZmVyKSB7XG4gICAgICAgICAgdXBsb2FkQnVmZmVyLnNldChyZW1haW5pbmcsIGJ1ZmZlclBvc2l0aW9uKTtcbiAgICAgICAgICBidWZmZXJQb3NpdGlvbiArPSByZW1haW5pbmcuYnl0ZUxlbmd0aDtcbiAgICAgICAgICBmaWxlU2l6ZUJ5dGVzICs9IHJlbWFpbmluZy5ieXRlTGVuZ3RoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNsaWNlZCA9IHJlbWFpbmluZy5zbGljZSgwLCBhdmFpbGFibGVCdWZmZXIpO1xuICAgICAgICByZW1haW5pbmcgPSByZW1haW5pbmcuc2xpY2UoYXZhaWxhYmxlQnVmZmVyKTtcbiAgICAgICAgdXBsb2FkQnVmZmVyLnNldChzbGljZWQsIGJ1ZmZlclBvc2l0aW9uKTtcblxuICAgICAgICBhd2FpdCBjaHVua3NDb2xsZWN0aW9uLmluc2VydE9uZSh7XG4gICAgICAgICAgZmlsZXNfaWQ6IGlkLFxuICAgICAgICAgIG46IGNodW5rc0luc2VydGVkLFxuICAgICAgICAgIGRhdGE6IG5ldyBCc29uLkJpbmFyeSh1cGxvYWRCdWZmZXIpLFxuICAgICAgICB9KTtcblxuICAgICAgICBidWZmZXJQb3NpdGlvbiA9IDA7XG4gICAgICAgIGZpbGVTaXplQnl0ZXMgKz0gc2xpY2VkLmJ5dGVMZW5ndGg7XG4gICAgICAgICsrY2h1bmtzSW5zZXJ0ZWQ7XG4gICAgICB9XG4gICAgfSxcbiAgICBjbG9zZTogYXN5bmMgKCkgPT4ge1xuICAgICAgLy8gV3JpdGUgdGhlIGxhc3QgYnl0ZXMgdGhhdCBhcmUgbGVmdCBpbiB0aGUgYnVmZmVyXG4gICAgICBpZiAoYnVmZmVyUG9zaXRpb24pIHtcbiAgICAgICAgYXdhaXQgY2h1bmtzQ29sbGVjdGlvbi5pbnNlcnRPbmUoe1xuICAgICAgICAgIGZpbGVzX2lkOiBpZCxcbiAgICAgICAgICBuOiBjaHVua3NJbnNlcnRlZCxcbiAgICAgICAgICBkYXRhOiBuZXcgQnNvbi5CaW5hcnkodXBsb2FkQnVmZmVyLnNsaWNlKDAsIGJ1ZmZlclBvc2l0aW9uKSksXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBmaWxlc0NvbGxlY3Rpb24uaW5zZXJ0T25lKHtcbiAgICAgICAgX2lkOiBpZCxcbiAgICAgICAgbGVuZ3RoOiBmaWxlU2l6ZUJ5dGVzLFxuICAgICAgICBjaHVua1NpemU6IGNodW5rU2l6ZUJ5dGVzQ29tYmluZWQsXG4gICAgICAgIHVwbG9hZERhdGU6IG5ldyBEYXRlKCksXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZSxcbiAgICAgICAgbWV0YWRhdGE6IG9wdGlvbnM/Lm1ldGFkYXRhLFxuICAgICAgfSk7XG4gICAgfSxcbiAgfSk7XG59XG4iXX0=