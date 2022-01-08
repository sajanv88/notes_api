type CreateNoteDto = {
    description: string;
    createdBy: {
        userId: string;
        fullName: string;
    },
}
export default CreateNoteDto;