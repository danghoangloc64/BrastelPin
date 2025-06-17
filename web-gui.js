const express = require('express');
const path = require('path');
const { BrastelPinChecker, CONFIG } = require('./brastel-pin-checker');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store running jobs
const runningJobs = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/start-checker', async (req, res) => {
  try {
    const { accessCodes, settings, proxies, cookies } = req.body;

    // Validate input
    if (!accessCodes || !Array.isArray(accessCodes) || accessCodes.length === 0) {
      return res.status(400).json({ error: 'Access codes are required' });
    }

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return res.status(400).json({ error: 'At least one cookie is required' });
    }

    // Update CONFIG with user input
    CONFIG.accessCodes = accessCodes.map(ac => ({
      accessCode: ac.accessCode,
      pinRange: {
        start: parseInt(ac.pinRange.start),
        end: parseInt(ac.pinRange.end)
      }
    }));

    // Update proxies and cookies from user input
    CONFIG.proxies = Array.isArray(proxies) && proxies.length > 0 ? proxies : [''];
    CONFIG.cookies = cookies;

    if (settings) {
      CONFIG.concurrentWorkers = parseInt(settings.concurrentWorkers) || 1;
      CONFIG.maxUndefinedResults = parseInt(settings.maxUndefinedResults) || 25;
      CONFIG.randomProcessing.enabled = settings.randomProcessing || false;
      CONFIG.randomProcessing.delayBetweenPins = parseInt(settings.delayBetweenPins) || 100;
      CONFIG.maxRetries = parseInt(settings.maxRetries) || 10;
      CONFIG.retryDelay = parseInt(settings.retryDelay) || 3000;
    }

    // Create job ID
    const jobId = Date.now().toString();

    // Start the checker
    const checker = new BrastelPinChecker();
    runningJobs.set(jobId, { checker, status: 'running', startTime: new Date() });

    // Run in background
    checker.start()
      .then(() => {
        const job = runningJobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.endTime = new Date();
        }
      })
      .catch((error) => {
        const job = runningJobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = error.message;
          job.endTime = new Date();
        }
      });

    res.json({
      success: true,
      jobId,
      message: 'PIN checker started successfully',
              config: {
          accessCodes: CONFIG.accessCodes,
          concurrentWorkers: CONFIG.concurrentWorkers,
          maxUndefinedResults: CONFIG.maxUndefinedResults,
          randomProcessing: CONFIG.randomProcessing,
          proxiesCount: CONFIG.proxies.length,
          cookiesCount: CONFIG.cookies.length
        }
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

app.get('/api/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = runningJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    error: job.error
  });
});

app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(runningJobs.entries()).map(([jobId, job]) => ({
    jobId,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    error: job.error
  }));

  res.json(jobs);
});

app.get('/api/logs', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const logsDir = 'Log';

    let allLogs = [];

    if (fs.existsSync(logsDir)) {
      const logFiles = fs.readdirSync(logsDir)
        .filter(file => file.endsWith('.txt'))
        .map(file => ({
          file,
          path: path.join(logsDir, file),
          mtime: fs.statSync(path.join(logsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime); // Sort by most recent first

      // Read from the most recent log file
      if (logFiles.length > 0) {
        const logContent = fs.readFileSync(logFiles[0].path, 'utf8');
        const lines = logContent.trim().split('\n').filter(line => line.trim());
        allLogs = lines.slice(-10); // Get last 10 lines
      }
    }

    res.json({
      success: true,
      logs: allLogs
    });

  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      logs: []
    });
  }
});

// Create public directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

app.listen(PORT, () => {
  console.log('🌐 Brastel PIN Checker Web GUI is running at http://localhost:3000');
  console.log('📱 Open your browser and navigate to the URL above');
  console.log('🚀 You can now configure and run PIN checking through the web interface');
});

module.exports = app;