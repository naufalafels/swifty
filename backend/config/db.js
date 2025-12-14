import mongoose from "mongoose";

export const connectDB = async () => {
    await mongoose.connect('mongodb+srv://zamrinaufalcode_db_user:Yk0JGScQhtVgdLSd@cluster0.2wxtpyq.mongodb.net/iman')
        .then(() => console.log('DB Connected'))
}