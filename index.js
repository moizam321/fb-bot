const express = require('express');
const axios = require('axios');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'simple-secret', resave: false, saveUninitialized: true }));

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = `${process.env.APP_BASE_URL}/auth/facebook/callback`;

app.get('/', (req, res) => {
  res.send(`
    <div style="text-align:center;margin-top:100px;font-family:sans-serif;">
      <h1>Facebook Page Bot</h1>
      <p>Bot is Live and Ready!</p>
      <a href="/auth/facebook" style="background:#1877f2;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:18px;">Login with Facebook</a>
    </div>
  `);
});

app.get('/auth/facebook', (req, res) => {
  const url = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging&response_type=code`;
  res.redirect(url);
});

app.get('/auth/facebook/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const tRes = await axios.get(`https://graph.facebook.com/v25.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&client_secret=${APP_SECRET}&code=${code}`);
    const uToken = tRes.data.access_token;
    const pRes = await axios.get(`https://graph.facebook.com/v25.0/me/accounts?access_token=${uToken}`);
    
    let html = '<h2>Select your Page:</h2>';
    pRes.data.data.forEach(page => {
      html += `<p><b>${page.name}</b> - Token: <code style="background:#eee;">${page.access_token}</code></p>`;
    });
    res.send(html + '<br><p>Copy the token for your Page and add it to Render Environment Variables as FACEBOOK_PAGE_ACCESS_TOKEN</p>');
  } catch (e) { res.send("Login Error: " + e.message); }
});

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else { res.sendStatus(403); }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      const pageId = entry.id;
      for (const change of entry.changes) {
        if (change.value.item === 'comment' && change.value.verb === 'add') {
          const commentId = change.value.comment_id;
          const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
          try {
            await axios.post(`https://graph.facebook.com/v25.0/${commentId}/comments`, { message: 'Auto Reply: Thanks!' }, { params: { access_token: token } });
            await axios.post(`https://graph.facebook.com/v25.0/${pageId}/messages`, { recipient: { comment_id: commentId }, message: { text: 'Hi! We received your comment.' } }, { params: { access_token: token } });
          } catch (err) { console.error('Error in reply'); }
        }
      }
    }
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 10000, () => console.log('Live!'));
