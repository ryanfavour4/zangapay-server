const { Client, Account, Users, ID, OAuthProvider } = require('node-appwrite');
const customError = require('../customError');

const client = new Client();


const googleProvider = OAuthProvider.Google;
const facebookProvider = OAuthProvider.Facebook;
const appleProvider = OAuthProvider.Apple;

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67428c4d001de6cbc895')
    .setKey('standard_0a04eceee73d5093306483a228176b9def48fc4c8cf1ee1e2b8af50a52fe02a188617ed2655802e2cd1c978f8b1cf393dd12920328e83db5abfe076dd68b8ccc6eaddff873cba7fd6f64b5ec97a56128198214d1d1a6ebe666bb09526b44b77d904797e43dcf1be362a5dc8491da3605c571ecba22d0bb675ccdf33c71600cb8');

const users = new Users(client);
const account = new Account(client);


const signInWithEmailAndPassword = async (email, password) => {
    try {
        if (!email || !password) return null;
        const session = await account.createEmailPasswordSession(email, password);

        return session;
    } catch (err) {
        console.log(err);
        throw err;
    }
};


const createUserWithEmailAndPassword = async (email, password, name) => {
    try {
        const randomID = ID.unique();

        if (!email || !password || !name) throw 'Email or password or name was not provided';
        const user = await account.create(randomID, email, password, name);

        
        return user;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const createAnnoymousSession = async () => {
    try {
        const randomID = ID.unique();

        const result = await users.create(
            randomID, // userId
        );

        return result;

    } catch (err) {
        console.log(err);
        throw err;
    }
};



const deleteUser = async (identityId, userId) => {
    try {
        if (!identityId || !userId) return null;
        await users.delete(userId);
        const result = await users.deleteIdentity(identityId);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const getUserInfo = async (userId) => {
    try {
        if (!userId) return null;
        const result = await users.get(userId);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const updateUserPassword = async (userId, password) => {
    try {
        console.log(userId, password)
        if (!userId || !password) return next(customError('dkjdj'));
        const result = await users.updatePassword(userId, password);

        console.log(result, 'result');
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const signInUserWithGoogleOauth = async () => {
    try {
        const result = await account.createOAuth2Token(
            googleProvider,
            // 'https://google.com',
            // 'https://google.com',
            []
        );
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const signInUserWithFacebookOauth = async () => {
    try {
        const result = await account.createOAuth2Token(
            facebookProvider,
            'exp://127.0.0.1:8081',
            'exp://127.0.0.1:8081',
            []
        );
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const signInUserWithAppleOauth = async () => {
    try {
        const result = await account.createOAuth2Token(
            appleProvider,
            'exp://127.0.0.1:8081',
            'exp://127.0.0.1:8081',
            []
        );
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const sendPhoneOneTimePassword = async (userId, phone) => {
    try {
        const randomID = ID.unique();

        console.log(randomID,'PHONE')
        const result = await account.createPhoneToken(randomID, phone);
        console.log(result);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const verifyUserOneTimePassword = async (userId, otp) => {
    try {
        
        const result = await account.createSession(userId, otp);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};
      
const createAdminAccount = async (email, password) => {
    try{
        
        console.log(email)
        const randomID = ID.unique()

        if(!email || !password) throw 'Email or password missing'

        const result = await account.create(
            randomID, // userId
            email, // email
            password, // password
            'BillPoint POS Admin' // name (optional)
        );
        
        return result
        
    }
    catch(err){
        console.log(err)
        throw err
    }
}

const sendEmailOneTimePassword = async (email) => {
    try {
        const randomID = ID.unique();
        const result = await account.createEmailToken(randomID, email, false);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const updateUserPhoneNumber = async (userId, phone) => {
    try {
        if (!userId || !phone) return null;
        const result = await users.updatePhone(userId, phone);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const logoutUser = async (userId) => {
    try {
        if (!userId) return null;
        const result = await users.deleteSessions(userId);
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const getUserCurrentSession = async () => {
    try {
     
        const result = await account.getSession('current');
        console.log('Session data:', result);
        
        return result;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

const createUserUsingEmailForOauth = async (email) => {
    try{
        const randomID = ID.unique();

        const result = await users.create(
            randomID, // userId
            email, // email (optional)
        );

        return result
    }
    catch(err){
        console.log(err)
    }
}


const signinAdminAccount = async (email, password) => {
    try{

        const result = await account.createEmailPasswordSession(
            email, // email
            password // password
        );
        
        
        console.log(result);
        return result
    }
    catch(err){
        console.log(err)
        throw err
    }
}

module.exports = {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    createAnnoymousSession,
    deleteUser,
    getUserInfo,
    updateUserPassword,
    signInUserWithGoogleOauth,
    signInUserWithFacebookOauth,
    signInUserWithAppleOauth,
    sendPhoneOneTimePassword,
    verifyUserOneTimePassword,
    sendEmailOneTimePassword,
    updateUserPhoneNumber,
    logoutUser,
    getUserCurrentSession,
    createUserUsingEmailForOauth,
    createAdminAccount,
    signinAdminAccount
};
