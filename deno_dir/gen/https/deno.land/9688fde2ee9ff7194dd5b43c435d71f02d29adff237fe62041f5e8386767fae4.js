import * as bcrypt from "./bcrypt/bcrypt.ts";
export async function hash(plaintext, salt = undefined) {
    let worker = new Worker(new URL("worker.ts", import.meta.url).toString(), { type: "module", deno: true });
    worker.postMessage({
        action: "hash",
        payload: {
            plaintext,
            salt,
        },
    });
    return new Promise((resolve) => {
        worker.onmessage = (event) => {
            resolve(event.data);
            worker.terminate();
        };
    });
}
export async function genSalt(log_rounds = undefined) {
    let worker = new Worker(new URL("worker.ts", import.meta.url).toString(), { type: "module", deno: true });
    worker.postMessage({
        action: "genSalt",
        payload: {
            log_rounds,
        },
    });
    return new Promise((resolve) => {
        worker.onmessage = (event) => {
            resolve(event.data);
            worker.terminate();
        };
    });
}
export async function compare(plaintext, hash) {
    let worker = new Worker(new URL("worker.ts", import.meta.url).toString(), { type: "module", deno: true });
    worker.postMessage({
        action: "compare",
        payload: {
            plaintext,
            hash,
        },
    });
    return new Promise((resolve) => {
        worker.onmessage = (event) => {
            resolve(event.data);
            worker.terminate();
        };
    });
}
export function compareSync(plaintext, hash) {
    try {
        return bcrypt.checkpw(plaintext, hash);
    }
    catch {
        return false;
    }
}
export function genSaltSync(log_rounds = undefined) {
    return bcrypt.gensalt(log_rounds);
}
export function hashSync(plaintext, salt = undefined) {
    return bcrypt.hashpw(plaintext, salt);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLLE1BQU0sTUFBTSxvQkFBb0IsQ0FBQztBQVc3QyxNQUFNLENBQUMsS0FBSyxVQUFVLElBQUksQ0FDeEIsU0FBaUIsRUFDakIsT0FBMkIsU0FBUztJQUVwQyxJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FDckIsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLEVBQ2hELEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQy9CLENBQUM7SUFFRixNQUFNLENBQUMsV0FBVyxDQUFDO1FBQ2pCLE1BQU0sRUFBRSxNQUFNO1FBQ2QsT0FBTyxFQUFFO1lBQ1AsU0FBUztZQUNULElBQUk7U0FDTDtLQUNGLENBQUMsQ0FBQztJQUVILE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtRQUM3QixNQUFNLENBQUMsU0FBUyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDM0IsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQixNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDckIsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBVUQsTUFBTSxDQUFDLEtBQUssVUFBVSxPQUFPLENBQzNCLGFBQWlDLFNBQVM7SUFFMUMsSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQ3JCLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUNoRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUMvQixDQUFDO0lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUNqQixNQUFNLEVBQUUsU0FBUztRQUNqQixPQUFPLEVBQUU7WUFDUCxVQUFVO1NBQ1g7S0FDRixDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7UUFDN0IsTUFBTSxDQUFDLFNBQVMsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEIsTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ3JCLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQVdELE1BQU0sQ0FBQyxLQUFLLFVBQVUsT0FBTyxDQUMzQixTQUFpQixFQUNqQixJQUFZO0lBRVosSUFBSSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQ3JCLElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUNoRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxDQUMvQixDQUFDO0lBRUYsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUNqQixNQUFNLEVBQUUsU0FBUztRQUNqQixPQUFPLEVBQUU7WUFDUCxTQUFTO1lBQ1QsSUFBSTtTQUNMO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQzdCLE1BQU0sQ0FBQyxTQUFTLEdBQUcsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BCLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNyQixDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFZRCxNQUFNLFVBQVUsV0FBVyxDQUFDLFNBQWlCLEVBQUUsSUFBWTtJQUN6RCxJQUFJO1FBQ0YsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN4QztJQUFDLE1BQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQVdELE1BQU0sVUFBVSxXQUFXLENBQ3pCLGFBQWlDLFNBQVM7SUFFMUMsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3BDLENBQUM7QUFZRCxNQUFNLFVBQVUsUUFBUSxDQUN0QixTQUFpQixFQUNqQixPQUEyQixTQUFTO0lBRXBDLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDeEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGJjcnlwdCBmcm9tIFwiLi9iY3J5cHQvYmNyeXB0LnRzXCI7XG5cbi8qKlxuICogR2VuZXJhdGUgYSBoYXNoIGZvciB0aGUgcGxhaW50ZXh0IHBhc3N3b3JkXG4gKiBSZXF1aXJlcyAtLWFsbG93LW5ldCBhbmQgLS11bnN0YWJsZSBmbGFnc1xuICpcbiAqIEBleHBvcnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBwbGFpbnRleHQgVGhlIHBhc3N3b3JkIHRvIGhhc2hcbiAqIEBwYXJhbSB7KHN0cmluZyB8IHVuZGVmaW5lZCl9IFtzYWx0PXVuZGVmaW5lZF0gVGhlIHNhbHQgdG8gdXNlIHdoZW4gaGFzaGluZy4gUmVjb21tZW5kZWQgdG8gbGVhdmUgdGhpcyB1bmRlZmluZWQuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxzdHJpbmc+fSBUaGUgaGFzaGVkIHBhc3N3b3JkXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYXNoKFxuICBwbGFpbnRleHQ6IHN0cmluZyxcbiAgc2FsdDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgbGV0IHdvcmtlciA9IG5ldyBXb3JrZXIoXG4gICAgbmV3IFVSTChcIndvcmtlci50c1wiLCBpbXBvcnQubWV0YS51cmwpLnRvU3RyaW5nKCksXG4gICAgeyB0eXBlOiBcIm1vZHVsZVwiLCBkZW5vOiB0cnVlIH0sXG4gICk7XG5cbiAgd29ya2VyLnBvc3RNZXNzYWdlKHtcbiAgICBhY3Rpb246IFwiaGFzaFwiLFxuICAgIHBheWxvYWQ6IHtcbiAgICAgIHBsYWludGV4dCxcbiAgICAgIHNhbHQsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgd29ya2VyLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgcmVzb2x2ZShldmVudC5kYXRhKTtcbiAgICAgIHdvcmtlci50ZXJtaW5hdGUoKTtcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZXMgYSBzYWx0IHVzaW5nIGEgbnVtYmVyIG9mIGxvZyByb3VuZHNcbiAqIFJlcXVpcmVzIC0tYWxsb3ctbmV0IGFuZCAtLXVuc3RhYmxlIGZsYWdzXG4gKlxuICogQGV4cG9ydFxuICogQHBhcmFtIHsobnVtYmVyIHwgdW5kZWZpbmVkKX0gW2xvZ19yb3VuZHM9dW5kZWZpbmVkXSBOdW1iZXIgb2YgbG9nIHJvdW5kcyB0byB1c2UuIFJlY29tbWVuZGVkIHRvIGxlYXZlIHRoaXMgdW5kZWZpbmVkLlxuICogQHJldHVybnMge1Byb21pc2U8c3RyaW5nPn0gVGhlIGdlbmVyYXRlZCBzYWx0XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5TYWx0KFxuICBsb2dfcm91bmRzOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICBsZXQgd29ya2VyID0gbmV3IFdvcmtlcihcbiAgICBuZXcgVVJMKFwid29ya2VyLnRzXCIsIGltcG9ydC5tZXRhLnVybCkudG9TdHJpbmcoKSxcbiAgICB7IHR5cGU6IFwibW9kdWxlXCIsIGRlbm86IHRydWUgfSxcbiAgKTtcblxuICB3b3JrZXIucG9zdE1lc3NhZ2Uoe1xuICAgIGFjdGlvbjogXCJnZW5TYWx0XCIsXG4gICAgcGF5bG9hZDoge1xuICAgICAgbG9nX3JvdW5kcyxcbiAgICB9LFxuICB9KTtcblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICB3b3JrZXIub25tZXNzYWdlID0gKGV2ZW50KSA9PiB7XG4gICAgICByZXNvbHZlKGV2ZW50LmRhdGEpO1xuICAgICAgd29ya2VyLnRlcm1pbmF0ZSgpO1xuICAgIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGEgcGxhaW50ZXh0IHBhc3N3b3JkIG1hdGNoZXMgYSBoYXNoXG4gKiBSZXF1aXJlcyAtLWFsbG93LW5ldCBhbmQgLS11bnN0YWJsZSBmbGFnc1xuICpcbiAqIEBleHBvcnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBwbGFpbnRleHQgVGhlIHBsYWludGV4dCBwYXNzd29yZCB0byBjaGVja1xuICogQHBhcmFtIHtzdHJpbmd9IGhhc2ggVGhlIGhhc2ggdG8gY29tcGFyZSB0b1xuICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbj59IFdoZXRoZXIgdGhlIHBhc3N3b3JkIG1hdGNoZXMgdGhlIGhhc2hcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbXBhcmUoXG4gIHBsYWludGV4dDogc3RyaW5nLFxuICBoYXNoOiBzdHJpbmcsXG4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgbGV0IHdvcmtlciA9IG5ldyBXb3JrZXIoXG4gICAgbmV3IFVSTChcIndvcmtlci50c1wiLCBpbXBvcnQubWV0YS51cmwpLnRvU3RyaW5nKCksXG4gICAgeyB0eXBlOiBcIm1vZHVsZVwiLCBkZW5vOiB0cnVlIH0sXG4gICk7XG5cbiAgd29ya2VyLnBvc3RNZXNzYWdlKHtcbiAgICBhY3Rpb246IFwiY29tcGFyZVwiLFxuICAgIHBheWxvYWQ6IHtcbiAgICAgIHBsYWludGV4dCxcbiAgICAgIGhhc2gsXG4gICAgfSxcbiAgfSk7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgd29ya2VyLm9ubWVzc2FnZSA9IChldmVudCkgPT4ge1xuICAgICAgcmVzb2x2ZShldmVudC5kYXRhKTtcbiAgICAgIHdvcmtlci50ZXJtaW5hdGUoKTtcbiAgICB9O1xuICB9KTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIHBsYWludGV4dCBwYXNzd29yZCBtYXRjaGVzIGEgaGFzaFxuICogVGhpcyBmdW5jdGlvbiBpcyBibG9ja2luZyBhbmQgY29tcHV0YXRpb25hbGx5IGV4cGVuc2l2ZSBidXQgcmVxdWlyZXMgbm8gYWRkaXRvbmFsIGZsYWdzLlxuICogVXNpbmcgdGhlIGFzeW5jIHZhcmlhbnQgaXMgaGlnaGx5IHJlY29tbWVuZGVkLlxuICpcbiAqIEBleHBvcnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBwbGFpbnRleHQgVGhlIHBsYWludGV4dCBwYXNzd29yZCB0byBjaGVja1xuICogQHBhcmFtIHtzdHJpbmd9IGhhc2ggVGhlIGhhc2ggdG8gY29tcGFyZSB0b1xuICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgdGhlIHBhc3N3b3JkIG1hdGNoZXMgdGhlIGhhc2hcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVTeW5jKHBsYWludGV4dDogc3RyaW5nLCBoYXNoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYmNyeXB0LmNoZWNrcHcocGxhaW50ZXh0LCBoYXNoKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgc2FsdCB1c2luZyBhIG51bWJlciBvZiBsb2cgcm91bmRzXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIGJsb2NraW5nIGFuZCBjb21wdXRhdGlvbmFsbHkgZXhwZW5zaXZlIGJ1dCByZXF1aXJlcyBubyBhZGRpdG9uYWwgZmxhZ3MuXG4gKiBVc2luZyB0aGUgYXN5bmMgdmFyaWFudCBpcyBoaWdobHkgcmVjb21tZW5kZWQuXG4gKlxuICogQGV4cG9ydFxuICogQHBhcmFtIHsobnVtYmVyIHwgdW5kZWZpbmVkKX0gW2xvZ19yb3VuZHM9dW5kZWZpbmVkXSBOdW1iZXIgb2YgbG9nIHJvdW5kcyB0byB1c2UuIFJlY29tbWVuZGVkIHRvIGxlYXZlIHRoaXMgdW5kZWZpbmVkLlxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGdlbmVyYXRlZCBzYWx0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5TYWx0U3luYyhcbiAgbG9nX3JvdW5kczogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkLFxuKTogc3RyaW5nIHtcbiAgcmV0dXJuIGJjcnlwdC5nZW5zYWx0KGxvZ19yb3VuZHMpO1xufVxuXG4vKipcbiAqIEdlbmVyYXRlIGEgaGFzaCBmb3IgdGhlIHBsYWludGV4dCBwYXNzd29yZFxuICogVGhpcyBmdW5jdGlvbiBpcyBibG9ja2luZyBhbmQgY29tcHV0YXRpb25hbGx5IGV4cGVuc2l2ZSBidXQgcmVxdWlyZXMgbm8gYWRkaXRvbmFsIGZsYWdzLlxuICogVXNpbmcgdGhlIGFzeW5jIHZhcmlhbnQgaXMgaGlnaGx5IHJlY29tbWVuZGVkLlxuICpcbiAqIEBleHBvcnRcbiAqIEBwYXJhbSB7c3RyaW5nfSBwbGFpbnRleHQgVGhlIHBhc3N3b3JkIHRvIGhhc2hcbiAqIEBwYXJhbSB7KHN0cmluZyB8IHVuZGVmaW5lZCl9IFtzYWx0PXVuZGVmaW5lZF0gVGhlIHNhbHQgdG8gdXNlIHdoZW4gaGFzaGluZy4gUmVjb21tZW5kZWQgdG8gbGVhdmUgdGhpcyB1bmRlZmluZWQuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgaGFzaGVkIHBhc3N3b3JkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNoU3luYyhcbiAgcGxhaW50ZXh0OiBzdHJpbmcsXG4gIHNhbHQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCxcbik6IHN0cmluZyB7XG4gIHJldHVybiBiY3J5cHQuaGFzaHB3KHBsYWludGV4dCwgc2FsdCk7XG59XG4iXX0=