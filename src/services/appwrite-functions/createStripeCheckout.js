/**
 * Appwrite serverless function for creating a Stripe checkout session
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function(req, res) {
  // Parse request body
  const { amount, currency = 'usd', name, success_url, cancel_url } = req.body || {};
  
  if (!amount || !name || !success_url || !cancel_url) {
    return res.json({
      success: false,
      message: 'Missing required parameters',
    }, 400);
  }

  try {
    // Create a random product name from a list
    const productNames = [
      "Personal Development Ebook",
      "Financial Freedom Ebook",
      "Digital Marketing Guide",
      "Health & Wellness Ebook",
      "Productivity Masterclass",
      "Mindfulness & Meditation Guide",
      "Entrepreneurship Blueprint",
      "Wellness Program",
      "Success Coaching",
      "Executive Mentoring",
      "Learning Resources",
      "Online Course Access",
      "Premium Content Subscription",
      "Digital Asset Package"
    ];
    
    // Select a random product name
    const randomProductName = productNames[Math.floor(Math.random() * productNames.length)];
    
    // Create a Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: randomProductName,  // Use random name instead of actual video name
            },
            unit_amount: Math.round(amount),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
    });

    return res.json({
      success: true,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.json({
      success: false,
      message: error.message,
    }, 500);
  }
}; 