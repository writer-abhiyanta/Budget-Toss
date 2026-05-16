import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email alerting API
  app.post('/api/send-alert', async (req, res) => {
    try {
      const { to, subject, message } = req.body;
      
      const smtpEmail = process.env.SMTP_EMAIL;
      const smtpPass = process.env.SMTP_PASSWORD;

      if (!smtpEmail || !smtpPass) {
        return res.status(500).json({ error: 'SMTP credentials not configured on the server.' });
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpEmail,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: smtpEmail,
        to: to || smtpEmail, // Default to sending to self if not specified
        subject: subject,
        text: message,
        html: `<div style="font-family: sans-serif; color: #065f46; background: #ecfdf5; padding: 20px; border-radius: 8px;">
          <h2 style="margin-top: 0; color: #064e3b; border-bottom: 2px solid #34d399; padding-bottom: 8px;">FinTech Anime Planner</h2>
          <div style="font-size: 16px; line-height: 1.5; color: #064e3b;">${message}</div>
        </div>`
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Alert sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send alert email' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
