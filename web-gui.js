require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { BrastelPinChecker, CONFIG } = require('./brastel-pin-checker');
const ProcessQueueManager = require('./process-queue-manager');

const app = express();
const HOST = '0.0.0.0';
const PORT = parseInt(process.env.PORT) || 3000;

// Initialize Process Queue Manager
const processQueue = new ProcessQueueManager();

// File to persist job states
const JOBS_STATE_FILE = 'running_jobs_state.json';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Store running jobs
const runningJobs = new Map();

// Auto-start process queue processing
setTimeout(() => {
  processQueue.startNextProcess();
}, 2000);

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

// API to get running_jobs_state.json content
app.get('/api/jobs-state-file', (req, res) => {
  try {
    if (fs.existsSync(JOBS_STATE_FILE)) {
      const content = fs.readFileSync(JOBS_STATE_FILE, 'utf8');
      res.json({
        success: true,
        content,
        filename: JOBS_STATE_FILE
      });
    } else {
      res.json({
        success: true,
        content: '[]',
        filename: JOBS_STATE_FILE,
        message: 'File does not exist, showing empty array'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API to update running_jobs_state.json content
app.post('/api/jobs-state-file', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Validate JSON format
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: `Invalid JSON format: ${parseError.message}`
      });
    }

    // Validate structure (should be an array)
    if (!Array.isArray(parsedContent)) {
      return res.status(400).json({
        success: false,
        error: 'JSON content must be an array'
      });
    }

    // Validate each job object structure
    for (let i = 0; i < parsedContent.length; i++) {
      const job = parsedContent[i];
      if (!job.jobId || !job.status || !job.startTime || !job.config) {
        return res.status(400).json({
          success: false,
          error: `Invalid job structure at index ${i}. Required fields: jobId, status, startTime, config`
        });
      }
    }

    // Create backup of current file
    const backupFile = `${JOBS_STATE_FILE}.backup.${Date.now()}`;
    if (fs.existsSync(JOBS_STATE_FILE)) {
      fs.copyFileSync(JOBS_STATE_FILE, backupFile);
    }

    // Write new content
    fs.writeFileSync(JOBS_STATE_FILE, JSON.stringify(parsedContent, null, 2));

    // Reload the jobs state in memory
    runningJobs.clear();
    loadJobsState();

    res.json({
      success: true,
      message: 'File updated successfully',
      backupFile
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// =================== PROCESS QUEUE API ENDPOINTS ===================

// API để tạo tiến trình mới cho tất cả servers
app.post('/api/create-process', async (req, res) => {
  try {
    const { name, accessCode, pinRange, settings } = req.body;

    if (!name || !accessCode || !pinRange) {
      return res.status(400).json({
        success: false,
        error: 'Name, accessCode, and pinRange are required'
      });
    }

    if (
      pinRange.start == null || pinRange.end == null ||
      isNaN(pinRange.start) || isNaN(pinRange.end) ||
      pinRange.start >= pinRange.end ||
      pinRange.start < 0 || pinRange.end > 9999
    ) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pin range. Start must be >= 0, end must be <= 9999, and start < end'
      });
    }

    const processIds = await processQueue.createProcessForAllServers({
      name,
      accessCode,
      pinRange: {
        start: parseInt(pinRange.start),
        end: parseInt(pinRange.end)
      },
      settings: settings || {}
    });

    res.json({
      success: true,
      message: `Created ${processIds.length} processes across ${processQueue.totalServers} servers`,
      processIds,
      distribution: processQueue.distributeRangeAcrossServers(
        parseInt(pinRange.start),
        parseInt(pinRange.end),
        processQueue.totalServers
      )
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để thêm tiến trình từ server khác
app.post('/api/add-process', (req, res) => {
  try {
    const { process } = req.body;

    if (!process) {
      return res.status(400).json({ success: false, error: 'Process data required' });
    }

    processQueue.addProcess(process);

    res.json({ success: true, message: 'Process added to queue' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để dừng tiến trình khi server khác tìm được PIN
app.post('/api/stop-process', (req, res) => {
  try {
    const { accessCode, foundPin } = req.body;

    if (!accessCode || !foundPin) {
      return res.status(400).json({ success: false, error: 'AccessCode and foundPin required' });
    }

    const stopped = processQueue.stopCurrentProcess(accessCode, foundPin);

    res.json({
      success: true,
      stopped,
      message: stopped ? 'Process stopped' : 'No matching running process'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để lấy trạng thái queue
app.get('/api/queue-status', (req, res) => {
  try {
    const status = processQueue.getQueueStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để xóa tiến trình
app.delete('/api/process/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const deleted = processQueue.deleteProcess(processId);

    if (deleted) {
      res.json({ success: true, message: 'Process deleted' });
    } else {
      res.status(404).json({ success: false, error: 'Process not found or cannot be deleted' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để cập nhật tiến trình
app.put('/api/process/:processId', (req, res) => {
  try {
    const { processId } = req.params;
    const updates = req.body;

    const updated = processQueue.updateProcess(processId, updates);

    if (updated) {
      res.json({ success: true, message: 'Process updated' });
    } else {
      res.status(404).json({ success: false, error: 'Process not found or cannot be updated' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API để bắt đầu tiến trình tiếp theo manually
app.post('/api/start-next-process', async (req, res) => {
  try {
    const process = await processQueue.startNextProcess();

    if (process) {
      // Bắt đầu chạy PIN checker với process này
      startProcessChecker(process);
      res.json({ success: true, message: 'Started next process', process });
    } else {
      res.json({ success: true, message: 'No pending processes to start' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================== HELPER FUNCTIONS ===================

/**
 * Bắt đầu chạy PIN checker cho một process
 * @param {Object} process - Process object
 */
async function startProcessChecker(process) {
  try {
    // Cập nhật CONFIG với thông tin từ process
    CONFIG.accessCodes = [{
      accessCode: process.accessCode,
      pinRange: process.pinRange
    }];

    // Áp dụng settings từ process
    if (process.settings) {
      Object.assign(CONFIG, process.settings);
    }

    console.log(`🚀 Starting PIN checker for process: ${process.name}`);
    console.log(`📊 Access Code: ${process.accessCode}, Range: ${process.pinRange.start}-${process.pinRange.end}`);

    // Tạo và chạy checker
    const checker = new BrastelPinChecker();

    await checker.start();

    // Kiểm tra xem có tìm được PIN không
    const foundPin = await checkForFoundPin(process.accessCode);

    // Hoàn thành process
    await processQueue.completeProcess(process.id, foundPin);

    console.log(`✅ Completed process: ${process.name}${foundPin ? ` - Found PIN: ${foundPin}` : ''}`);

  } catch (error) {
    console.error(`❌ Error running process ${process.id}:`, error.message);
    await processQueue.completeProcess(process.id, null, error.message);
  }
}

/**
 * Kiểm tra xem có tìm được PIN nào không
 * @param {string} accessCode - Access code
 * @returns {string|null} PIN tìm được hoặc null
 */
async function checkForFoundPin(accessCode) {
  try {
    const validPinsFile = path.join('Data', accessCode, 'valid_pins_found.json');
    if (fs.existsSync(validPinsFile)) {
      const validPins = JSON.parse(fs.readFileSync(validPinsFile, 'utf8'));
      if (validPins.length > 0) {
        return validPins[validPins.length - 1].pin; // Lấy PIN cuối cùng tìm được
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking for found PIN:', error.message);
    return null;
  }
}

app.listen(PORT, HOST, () => {
  console.log(`🌐 Server is running on http://${HOST}:${PORT}`);
  console.log(`🏭 Server ID: ${processQueue.currentServerId}/${processQueue.totalServers}`);
  console.log(`📋 Process Queue loaded with ${processQueue.processQueue.length} processes`);
});

module.exports = app;
