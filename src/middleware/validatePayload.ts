import { Context } from '../deps.ts'
import RequestPayloadException from '../errors/requestPayload.ts'

export default <T extends Record<string, any>>(requiredParameters: string[]) => {
    return async (ctx: Context, next: () => Promise<unknown>) => {
        const body: T = await ctx.request.body().value;
        const valid = requiredParameters.every(key => body[key]);
        if (!valid) throw new RequestPayloadException(`Required payloads are ${requiredParameters}`);

        await next();
    }

}