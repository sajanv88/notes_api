import { Bson } from '../deps.ts';
import CreateUser from '../types/createUser.dto.ts';
import { mongoClient } from '../utils/mongo.ts';

export interface UserSchema extends CreateUser {
    _id: Bson.ObjectId
    createdAt: string;
    updatedAt?: string;
    active: boolean;
}

export default () => {
    const db = mongoClient.database('notes');
    const users = db.collection<UserSchema>("users");
    users.createIndexes({
        indexes: [{
            name: 'emailAddress',
            unique: true,
            key: { 'emailAddress': 1 },
        }]
    })

    return users;
}