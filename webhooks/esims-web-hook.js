const customError = require("../customError");


async function vtpassWebhookEvent(req, res, next) {
  try{
   
    const event = req.body

    console.log(eventb)

    // Perform specific actions based on the event type
    switch (event) {
      case 'payment.success':
        // Handle payment success
        console.log('Payment was successful:', data);
        break;

      case 'payment.failed':
        // Handle payment failure
        console.log('Payment failed:', data);
        break;

      default:
        console.log('Unhandled event type:', event);
    }

    res.status(200).json({ response: "success"});
    // Respond to the service
  }
  catch(err){
    console.log(err);
    next(customError(err))
  }
}

module.exports = vtpassWebhookEvent;