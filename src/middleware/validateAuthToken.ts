import { Context, log } from '../deps.ts'
import AuthenticationFailed from '../errors/authenticationFailed.ts'
import UserService from '../service/userService.ts';
import Token from '../utils/token.ts'

export default async (ctx: Context, next: () => Promise<unknown>) => {
    const token = ctx.request.headers.get('Authorization');
    log.info(`validateAuthToken: ${token}`)
    if (!token) throw new AuthenticationFailed('Authorization token not found. Please attached authorization token in the request headers');
    const payload = await new Token().verify(token);
    ctx.state.user = payload;
    await UserService.getInstance().getUserById(ctx.state.user._id)
    log.info(`validateAuthToken => ctx.state: ${ctx.state.user._id}`,);

    await next();
}