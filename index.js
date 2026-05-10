const express = require('express');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'fb-bot-secret', resave: false, saveUninitialized: true }));

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = `${process.env.APP_BASE_URL}/auth/facebook/callback`;

// 1. Landing Page (Login Button)
app.get('/', (req, res) => {
  res.send(`
    <div style="text-align:center; margin-top:100px; font-family:sans-serif;">
      <h1>Facebook Page Bot</h1>
      <p>Click below to connect your Page automatically</p>
      <a href="/auth/facebook" style="background:#1877f2; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">Login with Facebook</a>
    </div>
  `);
});

// 2. Start OAuth
app.get('/auth/facebook', (req, res) => {
  const url = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging&response_type=code`;
  res.redirect(url);
});

// 3. Callback (Automated Token Generation)
app.get('/auth/facebook/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tokenRes = await axios.get(`https://graph.facebook.com/v25.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`);
    const userToken = tokenRes.data.access_token;
    
    // Get Pages and their tokens
    const pagesRes = await axios.get(`https://graph.facebook.com/v25.0/me/accounts?access_token=${userToken}`);
    const pages = pagesRes.data.data;
    
    let html = '<h2>Select a Page to Activate Bot:</h2>';
    pages.forEach(page => {
      html += `<p>${page.name} <a href="/activate?id=${page.id}&token=${page.access_token}">[Activate Bot]</a></p>`;
    });
    res.send(html);
  } catch (e) { res.send("Error: " + e.message); }
});

// 4. Activate Page
app.get('/activate', async (req, res) => {
  const { id, token } = req.query;
  // In a real app, you'd save this to a database. For now, we'll just log it.
  console.log(`ACTIVATED: Page ${id} with Token ${token}`);
  res.send(`<h1>Success!</h1><p>Bot is now active for Page ID: ${id}. Keep this tab open or save the token.</p>`);
});

// 5. Webhook Verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Live on ${PORT}`));
