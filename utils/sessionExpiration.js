

function setSessionExpirationInMinutes(time){
  
  console.log(time,"minutes")
  
    const now = new Date()

    const session = new Date(now.getTime() + time * 60 * 1000)

    return session
}


function setSessionExpirationInHours(time){
    const now = new Date()

    const session = new Date(now.getTime() + 5 * 60 * 60 * 1000)

    return session
}

function hasSessionExpired(time){
    const now = Date.now()

    const session = new Date(time)

    return now > session.getTime()
}

module.exports = {
    setSessionExpirationInMinutes,
    setSessionExpirationInHours,
    hasSessionExpired,
}