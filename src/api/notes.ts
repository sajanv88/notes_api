import { Router, helpers, log } from '../deps.ts';
import CreateNoteDto from '../types/createNote.dto.ts';
import UpdateNoteDto from '../types/updateNote.dto.ts';

import NoteService from '../service/noteService.ts';
import validatePayload from '../middleware/validatePayload.ts';
import validateAuthToken from '../middleware/validateAuthToken.ts';
import validateUserStatus from '../middleware/validateUserStatus.ts';


export default () => {
    const router = new Router();
    const noteService = NoteService.getInstance();
    router.use(validateAuthToken);

    router.get('/api/notes',
        async (ctx) => {
            log.info(`ctx state: `, ctx.state);
            const queryParams = helpers.getQuery(ctx, { mergeParams: true });

            ctx.response.body = await noteService.getNotes(ctx.state.user._id, queryParams);
            ctx.response.status = 200;
        })

    router.get('/api/notes/:note_id',
        async (ctx) => {
            ctx.response.body = await noteService.getNoteById(ctx.params.note_id, ctx.state.user._id);
            ctx.response.status = 200;
        })

    router.post('/api/notes',
        validatePayload<CreateNoteDto>([
            'description',
            'createdBy']),
        validateUserStatus,
        async (ctx) => {
            const body: CreateNoteDto = await ctx.request.body().value;
            await noteService.create(body);
            ctx.response.status = 201;
        })

    router.put('/api/notes/:note_id',
        validatePayload<UpdateNoteDto>(['description']),
        validateUserStatus,
        async (ctx) => {
            const body: UpdateNoteDto = await ctx.request.body().value;
            await noteService.update({ ...body, userId: ctx.state.user._id }, ctx.params.note_id);
            ctx.response.status = 204;
        })

    router.delete('/api/notes/:note_id', validateUserStatus, async (ctx) => {
        await noteService.delete(ctx.params.note_id, ctx.state.user._id);
        ctx.response.status = 202;
    })

    return router;
};