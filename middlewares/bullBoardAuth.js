/**
 * Authentication middleware for BullBoard dashboard
 * Provides basic HTTP authentication to protect the queue monitoring interface
 */

const bullBoardAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  
  if (!auth) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin Dashboard"');
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide valid credentials to access the queue dashboard'
    });
  }
  
  try {
    const credentials = Buffer.from(auth.split(' ')[1] || '', 'base64').toString();
    const [username, password] = credentials.split(':');
    
    // Get credentials from environment variables with fallback
    const validUsername = process.env.BULLBOARD_USERNAME;
    const validPassword = process.env.BULLBOARD_PASSWORD;
    
    if (username === validUsername && password === validPassword) {
      // Log access for security monitoring
      console.log(`BullBoard access granted to user: ${username} at ${new Date().toISOString()}`);
      next();
    } else {
      console.log(`BullBoard access denied for user: ${username} at ${new Date().toISOString()}`);
      res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin Dashboard"');
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'The provided username or password is incorrect'
      });
    }
  } catch (error) {
    console.error('BullBoard auth error:', error);
    res.setHeader('WWW-Authenticate', 'Basic realm="BullBoard Admin Dashboard"');
    return res.status(401).json({ 
      error: 'Authentication error',
      message: 'Invalid authentication format'
    });
  }
};

module.exports = {
  bullBoardAuth
};
