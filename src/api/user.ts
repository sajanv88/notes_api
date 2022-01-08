import { Router } from '../deps.ts';
import validatePayload from '../middleware/validatePayload.ts';
import CreateUserDto from '../types/createUser.dto.ts';
import LoginUserDto from '../types/loginUser.dto.ts';
import UpdatePasswordDto from '../types/updatePassword.dto.ts';
import UserService from '../service/userService.ts';
import NoteService from '../service/noteService.ts';
import validateAuthToken from '../middleware/validateAuthToken.ts';



export default () => {
    const router = new Router();
    const userService = UserService.getInstance();

    router.post('/api/users/signup',
        validatePayload<CreateUserDto>([
            'firstName',
            'lastName',
            'emailAddress',
            'password'
        ]), async (ctx) => {
            const body: CreateUserDto = await ctx.request.body().value;
            await userService.signup(body);
            ctx.response.status = 201;
        });

    router.post('/api/users/signin',
        validatePayload<LoginUserDto>([
            'emailAddress',
            'password']),
        async (ctx) => {
            const body: LoginUserDto = await ctx.request.body().value;
            const token = await userService.signin(body);
            ctx.response.body = {
                token
            }
            ctx.response.status = 200;
        });

    router.put('/api/users/:user_id/update_password', validatePayload<UpdatePasswordDto>([
        'currentPassword',
        'newPassword']),
        validateAuthToken,
        async (ctx) => {
            const body: UpdatePasswordDto = await ctx.request.body().value;
            await userService.updatePassword(body, ctx.params.user_id);
            ctx.response.status = 204;

        });

    router.put('/api/users/:user_id/deactivate', validateAuthToken, async (ctx) => {
        await userService.activateOrDeactivate(ctx.params.user_id, false);
        ctx.response.status = 204;

    });

    router.put('/api/users/:user_id/activate', validateAuthToken, async (ctx) => {
        await userService.activateOrDeactivate(ctx.params.user_id, true);
        ctx.response.status = 204;
    });

    router.delete('/api/users/:user_id/delete', validateAuthToken, async (ctx) => {
        await userService.delete(ctx.params.user_id);
        await NoteService.getInstance().deleteNotesByUserId(ctx.state.user._id);
        ctx.response.status = 202;
    });

    router.get('/api/user/verify_auth', validateAuthToken, async (ctx) => {
        const user = await userService.getUserById(ctx.state.user._id);
        ctx.response.status = 200;
        ctx.response.body = { ...ctx.state.user, userStatus: user.active };
    });

    return router;
};