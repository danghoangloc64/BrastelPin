const express = require('express');
const path = require('path');
const fs = require('fs');
const { BrastelPinChecker, CONFIG } = require('./brastel-pin-checker');

const app = express();
const PORT = 3000;

// File to persist job states
const JOBS_STATE_FILE = 'running_jobs_state.json';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Store running jobs
const runningJobs = new Map();

// Persistence functions
function saveJobsState() {
  try {
    const jobsArray = Array.from(runningJobs.entries()).map(([jobId, job]) => ({
      jobId,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      error: job.error,
      config: job.config,
      currentProgress: job.currentProgress || {}
    }));

    fs.writeFileSync(JOBS_STATE_FILE, JSON.stringify(jobsArray, null, 2));
  } catch (error) {
    console.error('❌ Failed to save jobs state:', error.message);
  }
}

function loadJobsState() {
  try {
    if (fs.existsSync(JOBS_STATE_FILE)) {
      const jobsArray = JSON.parse(fs.readFileSync(JOBS_STATE_FILE, 'utf8'));
      let restoredCount = 0;
      let runningCount = 0;

      for (const jobData of jobsArray) {
        const wasRunning = jobData.status === 'running';

        runningJobs.set(jobData.jobId, {
          checker: null, // Will be recreated if needed
          status: wasRunning ? 'interrupted' : jobData.status,
          startTime: new Date(jobData.startTime),
          endTime: jobData.endTime ? new Date(jobData.endTime) : null,
          error: jobData.error,
          config: jobData.config,
          currentProgress: jobData.currentProgress || {},
          wasRestored: true,
          wasRunning
        });

        restoredCount++;
        if (wasRunning) runningCount++;
      }

      if (restoredCount > 0) {
        console.log(`📋 Restored ${restoredCount} job(s) from previous session`);
        if (runningCount > 0) {
          console.log(`⚠️  ${runningCount} job(s) were running when application stopped - marked as 'interrupted'`);
          console.log('💡 Use the web interface to resume interrupted jobs');
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to load jobs state:', error.message);
  }
}

// Removed unused function - progress tracking can be added later if needed

// Load jobs state on startup
loadJobsState();

// Save jobs state periodically
setInterval(saveJobsState, 30000); // Save every 30 seconds

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

    // Store job configuration for persistence
    const jobConfig = {
      accessCodes: CONFIG.accessCodes,
      concurrentWorkers: CONFIG.concurrentWorkers,
      maxUndefinedResults: CONFIG.maxUndefinedResults,
      randomProcessing: CONFIG.randomProcessing,
      proxies: CONFIG.proxies,
      cookies: CONFIG.cookies,
      maxRetries: CONFIG.maxRetries,
      retryDelay: CONFIG.retryDelay
    };

    // Start the checker
    const checker = new BrastelPinChecker();

    const jobInfo = {
      checker,
      status: 'running',
      startTime: new Date(),
      config: jobConfig,
      currentProgress: {}
    };

    runningJobs.set(jobId, jobInfo);
    saveJobsState(); // Save immediately when new job starts

    // Run in background
    checker.start()
      .then(() => {
        const job = runningJobs.get(jobId);
        if (job) {
          job.status = 'completed';
          job.endTime = new Date();
          saveJobsState();
        }
      })
      .catch((error) => {
        const job = runningJobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = error.message;
          job.endTime = new Date();
          saveJobsState();
        }
      });

    res.json({
      success: true,
      jobId,
      message: 'PIN checker started successfully',
      config: jobConfig
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/resume-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = runningJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'interrupted') {
      return res.status(400).json({ error: 'Job is not in interrupted state' });
    }

    // Restore CONFIG from saved job config
    Object.assign(CONFIG, job.config);

    // Create new checker instance
    const checker = new BrastelPinChecker();
    job.checker = checker;
    job.status = 'running';
    job.resumedAt = new Date();

    saveJobsState();

    // Run in background
    checker.start()
      .then(() => {
        const jobInfo = runningJobs.get(jobId);
        if (jobInfo) {
          jobInfo.status = 'completed';
          jobInfo.endTime = new Date();
          saveJobsState();
        }
      })
      .catch((error) => {
        const jobInfo = runningJobs.get(jobId);
        if (jobInfo) {
          jobInfo.status = 'error';
          jobInfo.error = error.message;
          jobInfo.endTime = new Date();
          saveJobsState();
        }
      });

    res.json({
      success: true,
      message: 'Job resumed successfully',
      jobId,
      status: 'running'
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
    resumedAt: job.resumedAt,
    error: job.error,
    wasRestored: job.wasRestored,
    currentProgress: job.currentProgress
  });
});

app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(runningJobs.entries()).map(([jobId, job]) => ({
    jobId,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    resumedAt: job.resumedAt,
    error: job.error,
    wasRestored: job.wasRestored,
    currentProgress: job.currentProgress,
    canResume: job.status === 'interrupted'
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
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

app.listen(PORT, () => {
  console.log('🌐 Brastel PIN Checker Web GUI is running at http://localhost:3000');
  console.log('📱 Open your browser and navigate to the URL above');
  console.log('🚀 You can now configure and run PIN checking through the web interface');
});

module.exports = app;
