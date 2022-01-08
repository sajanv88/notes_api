function isHashedKeyAlgorithm(algorithm) {
    return typeof algorithm.hash?.name === "string";
}
function isEcKeyAlgorithm(algorithm) {
    return typeof algorithm.namedCurve === "string";
}
export function verify(alg, key) {
    if (alg === "none") {
        if (key !== null)
            throw new Error(`The alg '${alg}' does not allow a key.`);
        else
            return true;
    }
    else {
        if (!key)
            throw new Error(`The alg '${alg}' demands a key.`);
        const keyAlgorithm = key.algorithm;
        const algAlgorithm = getAlgorithm(alg);
        if (keyAlgorithm.name === algAlgorithm.name) {
            if (isHashedKeyAlgorithm(keyAlgorithm)) {
                return keyAlgorithm.hash.name === algAlgorithm.hash.name;
            }
            else if (isEcKeyAlgorithm(keyAlgorithm)) {
                return keyAlgorithm.namedCurve === algAlgorithm.namedCurve;
            }
        }
        return false;
    }
}
export function getAlgorithm(alg) {
    switch (alg) {
        case "HS256":
            return { hash: { name: "SHA-256" }, name: "HMAC" };
        case "HS384":
            return { hash: { name: "SHA-384" }, name: "HMAC" };
        case "HS512":
            return { hash: { name: "SHA-512" }, name: "HMAC" };
        case "PS256":
            return {
                hash: { name: "SHA-256" },
                name: "RSA-PSS",
                saltLength: 256 >> 3,
            };
        case "PS384":
            return {
                hash: { name: "SHA-384" },
                name: "RSA-PSS",
                saltLength: 384 >> 3,
            };
        case "PS512":
            return {
                hash: { name: "SHA-512" },
                name: "RSA-PSS",
                saltLength: 512 >> 3,
            };
        case "RS256":
            return { hash: { name: "SHA-256" }, name: "RSASSA-PKCS1-v1_5" };
        case "RS384":
            return { hash: { name: "SHA-384" }, name: "RSASSA-PKCS1-v1_5" };
        case "RS512":
            return { hash: { name: "SHA-512" }, name: "RSASSA-PKCS1-v1_5" };
        case "ES256":
            return { hash: { name: "SHA-256" }, name: "ECDSA", namedCurve: "P-256" };
        case "ES384":
            return { hash: { name: "SHA-384" }, name: "ECDSA", namedCurve: "P-384" };
        default:
            throw new Error(`The jwt's alg '${alg}' is not supported.`);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxnb3JpdGhtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYWxnb3JpdGhtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQXFCQSxTQUFTLG9CQUFvQixDQUMzQixTQUFjO0lBRWQsT0FBTyxPQUFPLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLFFBQVEsQ0FBQztBQUNsRCxDQUFDO0FBRUQsU0FBUyxnQkFBZ0IsQ0FDdkIsU0FBYztJQUVkLE9BQU8sT0FBTyxTQUFTLENBQUMsVUFBVSxLQUFLLFFBQVEsQ0FBQztBQUNsRCxDQUFDO0FBRUQsTUFBTSxVQUFVLE1BQU0sQ0FDcEIsR0FBYyxFQUNkLEdBQXFCO0lBRXJCLElBQUksR0FBRyxLQUFLLE1BQU0sRUFBRTtRQUNsQixJQUFJLEdBQUcsS0FBSyxJQUFJO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLEdBQUcseUJBQXlCLENBQUMsQ0FBQzs7WUFDdkUsT0FBTyxJQUFJLENBQUM7S0FDbEI7U0FBTTtRQUNMLElBQUksQ0FBQyxHQUFHO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxZQUFZLEdBQUcsa0JBQWtCLENBQUMsQ0FBQztRQUM3RCxNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO1FBQ25DLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QyxJQUFJLFlBQVksQ0FBQyxJQUFJLEtBQUssWUFBWSxDQUFDLElBQUksRUFBRTtZQUMzQyxJQUFJLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxFQUFFO2dCQUN0QyxPQUFPLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2FBQzFEO2lCQUFNLElBQUksZ0JBQWdCLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQ3pDLE9BQU8sWUFBWSxDQUFDLFVBQVUsS0FBSyxZQUFZLENBQUMsVUFBVSxDQUFDO2FBQzVEO1NBQ0Y7UUFDRCxPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQUVELE1BQU0sVUFBVSxZQUFZLENBQzFCLEdBQWM7SUFFZCxRQUFRLEdBQUcsRUFBRTtRQUNYLEtBQUssT0FBTztZQUNWLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ3JELEtBQUssT0FBTztZQUNWLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ3JELEtBQUssT0FBTztZQUNWLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQ3JELEtBQUssT0FBTztZQUNWLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtnQkFDekIsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDO2FBQ3JCLENBQUM7UUFDSixLQUFLLE9BQU87WUFDVixPQUFPO2dCQUNMLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7Z0JBQ3pCLElBQUksRUFBRSxTQUFTO2dCQUNmLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQzthQUNyQixDQUFDO1FBQ0osS0FBSyxPQUFPO1lBQ1YsT0FBTztnQkFDTCxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO2dCQUN6QixJQUFJLEVBQUUsU0FBUztnQkFDZixVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUM7YUFDckIsQ0FBQztRQUNKLEtBQUssT0FBTztZQUNWLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFFLENBQUM7UUFDbEUsS0FBSyxPQUFPO1lBQ1YsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQztRQUNsRSxLQUFLLE9BQU87WUFDVixPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxtQkFBbUIsRUFBRSxDQUFDO1FBQ2xFLEtBQUssT0FBTztZQUNWLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLENBQUM7UUFDM0UsS0FBSyxPQUFPO1lBQ1YsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUczRTtZQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLEdBQUcscUJBQXFCLENBQUMsQ0FBQztLQUMvRDtBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogSlNXIMKnMTogQ3J5cHRvZ3JhcGhpYyBhbGdvcml0aG1zIGFuZCBpZGVudGlmaWVycyBmb3IgdXNlIHdpdGggdGhpcyBzcGVjaWZpY2F0aW9uXG4gKiBhcmUgZGVzY3JpYmVkIGluIHRoZSBzZXBhcmF0ZSBKU09OIFdlYiBBbGdvcml0aG1zIChKV0EpIHNwZWNpZmljYXRpb246XG4gKiBodHRwczovL3d3dy5yZmMtZWRpdG9yLm9yZy9yZmMvcmZjNzUxOFxuICovXG5leHBvcnQgdHlwZSBBbGdvcml0aG0gPVxuICB8IFwiSFMyNTZcIlxuICB8IFwiSFMzODRcIlxuICB8IFwiSFM1MTJcIlxuICB8IFwiUFMyNTZcIlxuICB8IFwiUFMzODRcIlxuICB8IFwiUFM1MTJcIlxuICB8IFwiUlMyNTZcIlxuICB8IFwiUlMzODRcIlxuICB8IFwiUlM1MTJcIlxuICB8IFwiRVMyNTZcIlxuICB8IFwiRVMzODRcIlxuICAvLyBOb3Qgc3VwcG9ydGVkIHlldDpcbiAgLy8gfCBcIkVTNTEyXCJcbiAgfCBcIm5vbmVcIjtcblxuZnVuY3Rpb24gaXNIYXNoZWRLZXlBbGdvcml0aG0oXG4gIGFsZ29yaXRobTogYW55LFxuKTogYWxnb3JpdGhtIGlzIEhtYWNLZXlBbGdvcml0aG0gfCBSc2FIYXNoZWRLZXlBbGdvcml0aG0ge1xuICByZXR1cm4gdHlwZW9mIGFsZ29yaXRobS5oYXNoPy5uYW1lID09PSBcInN0cmluZ1wiO1xufVxuXG5mdW5jdGlvbiBpc0VjS2V5QWxnb3JpdGhtKFxuICBhbGdvcml0aG06IGFueSxcbik6IGFsZ29yaXRobSBpcyBFY0tleUFsZ29yaXRobSB7XG4gIHJldHVybiB0eXBlb2YgYWxnb3JpdGhtLm5hbWVkQ3VydmUgPT09IFwic3RyaW5nXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2ZXJpZnkoXG4gIGFsZzogQWxnb3JpdGhtLFxuICBrZXk6IENyeXB0b0tleSB8IG51bGwsXG4pOiBib29sZWFuIHtcbiAgaWYgKGFsZyA9PT0gXCJub25lXCIpIHtcbiAgICBpZiAoa2V5ICE9PSBudWxsKSB0aHJvdyBuZXcgRXJyb3IoYFRoZSBhbGcgJyR7YWxnfScgZG9lcyBub3QgYWxsb3cgYSBrZXkuYCk7XG4gICAgZWxzZSByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWtleSkgdGhyb3cgbmV3IEVycm9yKGBUaGUgYWxnICcke2FsZ30nIGRlbWFuZHMgYSBrZXkuYCk7XG4gICAgY29uc3Qga2V5QWxnb3JpdGhtID0ga2V5LmFsZ29yaXRobTtcbiAgICBjb25zdCBhbGdBbGdvcml0aG0gPSBnZXRBbGdvcml0aG0oYWxnKTtcbiAgICBpZiAoa2V5QWxnb3JpdGhtLm5hbWUgPT09IGFsZ0FsZ29yaXRobS5uYW1lKSB7XG4gICAgICBpZiAoaXNIYXNoZWRLZXlBbGdvcml0aG0oa2V5QWxnb3JpdGhtKSkge1xuICAgICAgICByZXR1cm4ga2V5QWxnb3JpdGhtLmhhc2gubmFtZSA9PT0gYWxnQWxnb3JpdGhtLmhhc2gubmFtZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFY0tleUFsZ29yaXRobShrZXlBbGdvcml0aG0pKSB7XG4gICAgICAgIHJldHVybiBrZXlBbGdvcml0aG0ubmFtZWRDdXJ2ZSA9PT0gYWxnQWxnb3JpdGhtLm5hbWVkQ3VydmU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWxnb3JpdGhtKFxuICBhbGc6IEFsZ29yaXRobSxcbikge1xuICBzd2l0Y2ggKGFsZykge1xuICAgIGNhc2UgXCJIUzI1NlwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS0yNTZcIiB9LCBuYW1lOiBcIkhNQUNcIiB9O1xuICAgIGNhc2UgXCJIUzM4NFwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS0zODRcIiB9LCBuYW1lOiBcIkhNQUNcIiB9O1xuICAgIGNhc2UgXCJIUzUxMlwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS01MTJcIiB9LCBuYW1lOiBcIkhNQUNcIiB9O1xuICAgIGNhc2UgXCJQUzI1NlwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaGFzaDogeyBuYW1lOiBcIlNIQS0yNTZcIiB9LFxuICAgICAgICBuYW1lOiBcIlJTQS1QU1NcIixcbiAgICAgICAgc2FsdExlbmd0aDogMjU2ID4+IDMsXG4gICAgICB9O1xuICAgIGNhc2UgXCJQUzM4NFwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaGFzaDogeyBuYW1lOiBcIlNIQS0zODRcIiB9LFxuICAgICAgICBuYW1lOiBcIlJTQS1QU1NcIixcbiAgICAgICAgc2FsdExlbmd0aDogMzg0ID4+IDMsXG4gICAgICB9O1xuICAgIGNhc2UgXCJQUzUxMlwiOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaGFzaDogeyBuYW1lOiBcIlNIQS01MTJcIiB9LFxuICAgICAgICBuYW1lOiBcIlJTQS1QU1NcIixcbiAgICAgICAgc2FsdExlbmd0aDogNTEyID4+IDMsXG4gICAgICB9O1xuICAgIGNhc2UgXCJSUzI1NlwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS0yNTZcIiB9LCBuYW1lOiBcIlJTQVNTQS1QS0NTMS12MV81XCIgfTtcbiAgICBjYXNlIFwiUlMzODRcIjpcbiAgICAgIHJldHVybiB7IGhhc2g6IHsgbmFtZTogXCJTSEEtMzg0XCIgfSwgbmFtZTogXCJSU0FTU0EtUEtDUzEtdjFfNVwiIH07XG4gICAgY2FzZSBcIlJTNTEyXCI6XG4gICAgICByZXR1cm4geyBoYXNoOiB7IG5hbWU6IFwiU0hBLTUxMlwiIH0sIG5hbWU6IFwiUlNBU1NBLVBLQ1MxLXYxXzVcIiB9O1xuICAgIGNhc2UgXCJFUzI1NlwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS0yNTZcIiB9LCBuYW1lOiBcIkVDRFNBXCIsIG5hbWVkQ3VydmU6IFwiUC0yNTZcIiB9O1xuICAgIGNhc2UgXCJFUzM4NFwiOlxuICAgICAgcmV0dXJuIHsgaGFzaDogeyBuYW1lOiBcIlNIQS0zODRcIiB9LCBuYW1lOiBcIkVDRFNBXCIsIG5hbWVkQ3VydmU6IFwiUC0zODRcIiB9O1xuICAgIC8vIGNhc2UgXCJFUzUxMlwiOlxuICAgIC8vIHJldHVybiB7IGhhc2g6IHsgbmFtZTogXCJTSEEtNTEyXCIgfSwgbmFtZTogXCJFQ0RTQVwiLCBuYW1lZEN1cnZlOiBcIlAtNTIxXCIgfTtcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGUgand0J3MgYWxnICcke2FsZ30nIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gIH1cbn1cbiJdfQ==