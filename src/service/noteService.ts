import { Bson } from '../deps.ts';
import NotFoundException from '../errors/notfound.ts';
import ConflictException from '../errors/conflict.ts';
import CreateNoteDto from '../types/createNote.dto.ts';
import UpdateNoteDto from '../types/updateNote.dto.ts';
import notesModel from '../model/noteModel.ts';

class NoteService {
    static #ns: NoteService;

    static getInstance = () => {
        if (this.#ns) return this.#ns;
        this.#ns = new NoteService();
        return this.#ns;
    }


    create = async (dto: CreateNoteDto) => {
        const notes = notesModel();
        try {
            await notes.insertOne({ ...dto, createdAt: new Date().toISOString() })
        } catch (e) {
            throw new ConflictException(e.message);
        }

    }

    update = async (dto: UpdateNoteDto, noteId: string) => {
        const notes = notesModel();
        try {
            await this.getNoteById(noteId, dto.userId);
            const id = { _id: new Bson.ObjectId(noteId) }
            await notes.updateOne(id, {
                $set: {
                    description: dto.description,
                    updatedAt: new Date().toISOString()
                }
            })
        } catch (e) {
            throw e;
        }

    }

    delete = async (noteId: string, userId: string) => {
        const notes = notesModel();
        try {
            await this.getNoteById(noteId, userId);
            const id = { _id: new Bson.ObjectId(noteId) }
            await notes.deleteOne(id);
        } catch (e) {
            throw e;
        }

    }

    getNotes = async (userId: string, params?: Record<string, any>) => {
        const notes = notesModel();
        try {
            const totalNotes = await notes.countDocuments({ 'createdBy.userId': userId });

            const filters = {
                ...(params?.search && { 'description': new RegExp(params.search, 'i') }),
                'createdBy.userId': userId

            };

            const list = await notes.find(filters)
                .skip(parseInt(params?.page) || 0)
                .limit(parseInt(params?.limit) || 10)
                .sort({ createdAt: params?.sort === 'newest' ? -1 : 1 })
                .toArray();
            return {
                totalNotes,
                list,
                ...(params?.search && { searchQuery: params.search, matchedRecordsCount: list.length })
            }

        } catch (e) {
            throw e;
        }
    }

    getNoteById = async (noteId: string, userId: string) => {
        const notes = notesModel();
        try {
            const filters = {
                _id: new Bson.ObjectId(noteId),
                'createdBy.userId': userId
            };
            const note = await notes.findOne(filters);
            if (!note) throw new NotFoundException('The note id record does not exist');
            return note;
        } catch (e) {
            throw e;
        }

    }

    deleteNotesByUserId = async (userId: string) => {
        const notes = notesModel();
        try {
            const totalNotes = await notes.countDocuments({ 'createdBy.userId': userId });
            if (totalNotes > 0) {
                await notes.deleteMany({ 'createdBy.userId': userId });
                return true;
            }
            return false;
        } catch (e) {
            throw e;
        }
    }

}

export default NoteService;