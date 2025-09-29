function generateRandomNumbers() {
    const rand = Math.floor(Math.random() * 6) + 1;

    return rand;
}

function generateOneTimePasswords() {
    const passwordLength = 6;

    let otp = "";

    for (let i = 0; i < 6; i++) {
        const rand = generateRandomNumbers();

        otp += rand;
    }

    console.log("====== OTP", otp);

    return otp;
}

module.exports = generateOneTimePasswords;
