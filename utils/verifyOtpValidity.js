function hasOtpExpired(time) {
    // Ensure `time` is a Date object
    if (!(time instanceof Date)) {
        throw new Error("Invalid time provided. Expected a Date object.");
    }

    const now = Date.now();
    
    const otpTime = new Date(time)
    
    console.log(otpTime.getTime(), "otp time")
    
    console.log(now, "now time")
    const isExpired = now > otpTime.getTime() + 1000;

    return isExpired;
}

module.exports = hasOtpExpired