import { Bson } from '../deps.ts';
import CreateNote from '../types/createNote.dto.ts';
import { mongoClient } from '../utils/mongo.ts'
export interface NoteSchema extends CreateNote {
    _id: Bson.ObjectId
    createdAt: string;
    updatedAt?: string;
}

export default () => {
    const db = mongoClient.database('notes');
    const userNotes = db.collection<NoteSchema>("user_notes");
    userNotes.createIndexes({
        indexes: [{
            name: 'description',
            key: { 'description': -1 },
        }, {
            name: 'createdBy.userId',
            key: { 'createdBy.userId': 1 }
        }]
    });
    return userNotes;
}
