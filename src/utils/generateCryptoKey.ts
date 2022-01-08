export default async () =>
    await crypto.subtle.generateKey({
        name: "HMAC",
        hash: "SHA-512"
    },
        true,
        ["sign", "verify"],
    );
