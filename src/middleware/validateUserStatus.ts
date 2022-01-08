import { Context, log } from '../deps.ts'
import UserService from '../service/userService.ts';
import AccountStatus from '../errors/accountStatus.ts';

export default async (ctx: Context, next: () => Promise<unknown>) => {
    const user = await UserService.getInstance().getUserById(ctx.state.user._id)
    if (!user.active) throw new AccountStatus('Action failed. Please activate your account')
    log.info(`validateUserStatus: ${ctx.state.user._id}`,);
    await next();
}