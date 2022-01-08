import { MongoClient, Bson } from '../deps.ts';
import CreateUserDto from '../types/createUser.dto.ts';
import LoginUserDto from '../types/loginUser.dto.ts';
import UpdatePasswordDto from '../types/updatePassword.dto.ts';
import userModel from '../model/userModel.ts';
import ConflictException from '../errors/conflict.ts';
import AuthenticationFailed from '../errors/authenticationFailed.ts';
import NotFoundException from '../errors/notfound.ts';
import Hash from '../utils/hash.ts';
import Token from '../utils/token.ts';



class UserService {
    static #us: UserService;

    static getInstance = () => {
        if (this.#us) return this.#us;
        this.#us = new UserService();
        return this.#us;
    }



    signup = async (dto: CreateUserDto) => {
        const user = userModel();
        try {

            await user.insertOne({
                ...dto,
                password: await new Hash().text(dto.password),
                createdAt: new Date().toISOString(),
                active: true
            })
        } catch (e) {
            throw new ConflictException(JSON.stringify(e.message));
        }

    }

    signin = async (dto: LoginUserDto) => {
        const user = userModel();
        try {
            const hasUser = await user.findOne({ emailAddress: dto.emailAddress })
            if (!hasUser) throw new AuthenticationFailed('Your credential details are invalid');
            const hasValidPassword = await new Hash().verify(dto.password, hasUser.password);
            if (!hasValidPassword) throw new AuthenticationFailed('Your credential details are invalid');
            const { emailAddress, _id, firstName, lastName } = hasUser;
            return await new Token().create({ emailAddress, _id, firstName, lastName });

        } catch (e) {
            throw e;
        }
    }

    updatePassword = async (dto: UpdatePasswordDto, userId: string) => {
        const user = userModel();

        try {

            const hasUser = await this.getUserById(userId);
            const hasValidPassword = await new Hash().verify(dto.currentPassword, hasUser.password);
            if (!hasValidPassword) throw new AuthenticationFailed(`The user id ${userId}'s current password doesn't seems right. Please check again`);
            const id = { _id: new Bson.ObjectId(userId) };
            await user.updateOne(id, {
                $set: {
                    password: await new Hash().text(dto.newPassword),
                    updatedAt: new Date().toISOString()
                }
            });

        } catch (e) {
            throw e;
        }
    }

    activateOrDeactivate = async (userId: string, status: boolean) => {
        const user = userModel();

        try {
            await this.getUserById(userId);
            const id = { _id: new Bson.ObjectId(userId) };
            await user.updateOne(id, {
                $set: {
                    updatedAt: new Date().toISOString(),
                    active: status
                }
            });
        } catch (e) {
            throw e;
        }
    }



    delete = async (userId: string) => {
        const user = userModel();

        try {

            await this.getUserById(userId)
            const id = { _id: new Bson.ObjectId(userId) };
            await user.deleteOne(id);

        } catch (e) {
            throw e;
        }
    }

    getUserById = async (userId: string) => {
        const user = userModel();

        try {
            const id = { _id: new Bson.ObjectId(userId) };
            const hasUser = await user.findOne(id)
            if (!hasUser) throw new NotFoundException(`The user id "${userId}" doesn't seems right.`);
            return hasUser;
        } catch (e) {
            throw e;
        }
    }
}

export default UserService;