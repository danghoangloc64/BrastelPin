/**
 * Process Queue Manager - Quản lý hàng đợi tiến trình cho multi-server across different VPS
 */

const fs = require('fs');
const axios = require('axios');

/**
 * Cấu trúc tiến trình:
 * {
 *   id: string,
 *   name: string,
 *   accessCode: string,
 *   pinRange: { start: number, end: number },
 *   status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled',
 *   serverId: number,
 *   totalServers: number,
 *   originalRange: { start: number, end: number }, // Range gốc trước khi chia
 *   createdAt: string,
 *   startedAt: string,
 *   completedAt: string,
 *   foundPin: string | null,
 *   error: string | null,
 *   settings: object
 * }
 */

class ProcessQueueManager {
  constructor() {
    this.queueFile = 'process_queue.json';
    this.currentServerId = parseInt(process.env.SERVER_ID) || 1;
    this.totalServers = parseInt(process.env.TOTAL_SERVERS) || 5;

    // Cấu hình servers - có thể override bằng environment variables
    this.serverAddresses = this.getServerAddresses();

    this.processQueue = [];
    this.currentProcess = null;
    this.isProcessing = false;

    this.loadQueue();
    console.log(`🏭 Server ${this.currentServerId}/${this.totalServers} initialized`);
    console.log(`🌐 Server addresses:`, this.serverAddresses);
  }

  /**
   * Lấy địa chỉ của các servers từ environment variables hoặc default
   */
  getServerAddresses() {
    const addresses = [];

    // Thử đọc từ environment variables trước
    for (let i = 1; i <= this.totalServers; i++) {
      const serverAddr = process.env[`SERVER_${i}_ADDRESS`];
      if (serverAddr) {
        addresses.push(serverAddr);
      } else {
        // Default: localhost với các port khác nhau (cho testing)
        addresses.push(`http://localhost:${2999 + i}`);
      }
    }

    return addresses;
  }

  /**
   * Load hàng đợi từ file
   */
  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = fs.readFileSync(this.queueFile, 'utf8');
        this.processQueue = JSON.parse(data);
        console.log(`📋 Loaded ${this.processQueue.length} processes from queue`);
      }
    } catch (error) {
      console.error('❌ Error loading process queue:', error.message);
      this.processQueue = [];
    }
  }

  /**
   * Save hàng đợi ra file
   */
  saveQueue() {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify(this.processQueue, null, 2));
    } catch (error) {
      console.error('❌ Error saving process queue:', error.message);
    }
  }

  /**
   * Chia range PIN cho multiple servers
   * @param {number} start - PIN bắt đầu
   * @param {number} end - PIN kết thúc
   * @param {number} totalServers - Tổng số server
   * @returns {Array} Array của ranges cho từng server
   */
  distributeRangeAcrossServers(start, end, totalServers) {
    const totalPins = end - start + 1;
    const pinsPerServer = Math.ceil(totalPins / totalServers);
    const ranges = [];

    for (let i = 0; i < totalServers; i++) {
      const rangeStart = start + (i * pinsPerServer);
      const rangeEnd = Math.min(rangeStart + pinsPerServer - 1, end);

      if (rangeStart <= end) {
        ranges.push({
          serverId: i + 1,
          serverAddress: this.serverAddresses[i],
          start: rangeStart,
          end: rangeEnd
        });
      }
    }

    return ranges;
  }

  /**
   * Tạo tiến trình mới cho multiple servers
   * @param {Object} processConfig - Cấu hình tiến trình
   * @returns {Array} Array của process IDs đã tạo
   */
  async createProcessForAllServers(processConfig) {
    const { name, accessCode, pinRange, settings } = processConfig;
    const processId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Chia range cho các server
    const serverRanges = this.distributeRangeAcrossServers(
      pinRange.start,
      pinRange.end,
      this.totalServers
    );

    const createdProcesses = [];

    for (const range of serverRanges) {
      const process = {
        id: `${processId}_server${range.serverId}`,
        name: `${name} (Server ${range.serverId})`,
        accessCode,
        pinRange: { start: range.start, end: range.end },
        originalRange: pinRange,
        status: 'pending',
        serverId: range.serverId,
        serverAddress: range.serverAddress,
        totalServers: this.totalServers,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        foundPin: null,
        error: null,
        settings: settings || {}
      };

      // Thêm vào queue của server tương ứng
      if (range.serverId === this.currentServerId) {
        // Server hiện tại
        this.processQueue.push(process);
        console.log(`📥 Added process to local queue: ${process.id}`);
      } else {
        // Gửi đến server khác
        await this.sendProcessToServer(process, range.serverAddress);
      }

      createdProcesses.push(process);
    }

    this.saveQueue();
    console.log(`✅ Created ${createdProcesses.length} processes across ${this.totalServers} servers`);

    return createdProcesses;
  }

  /**
   * Gửi tiến trình đến server khác
   * @param {Object} process - Tiến trình
   * @param {string} serverAddress - Địa chỉ server đích
   */
  async sendProcessToServer(process, serverAddress) {
    try {
      const url = `${serverAddress}/api/add-process`;
      const timeout = 10000; // 10 seconds timeout

      await axios.post(url, { process }, {
        timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📤 Sent process ${process.id} to ${serverAddress}`);
    } catch (error) {
      console.error(`❌ Failed to send process to ${serverAddress}:`, error.message);

      // Nếu không gửi được, có thể lưu vào retry queue
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        console.log(`⚠️  Server ${serverAddress} not reachable. Process will be marked as failed.`);
      }
    }
  }

  /**
   * Thêm tiến trình vào queue (từ server khác gửi đến)
   * @param {Object} process - Tiến trình
   */
  addProcess(process) {
    this.processQueue.push(process);
    this.saveQueue();
    console.log(`📥 Added process ${process.id} to queue from external server`);
  }

  /**
   * Lấy tiến trình tiếp theo trong queue
   * @returns {Object|null} Tiến trình tiếp theo hoặc null
   */
  getNextProcess() {
    const pendingProcesses = this.processQueue.filter(p => p.status === 'pending');
    return pendingProcesses.length > 0 ? pendingProcesses[0] : null;
  }

  /**
   * Bắt đầu xử lý tiến trình tiếp theo
   */
  async startNextProcess() {
    if (this.isProcessing) {
      console.log('⏳ Already processing a task');
      return null;
    }

    const nextProcess = this.getNextProcess();
    if (!nextProcess) {
      console.log('📭 No pending processes in queue');
      return null;
    }

    this.isProcessing = true;
    this.currentProcess = nextProcess;
    nextProcess.status = 'running';
    nextProcess.startedAt = new Date().toISOString();
    this.saveQueue();

    console.log(`🚀 Starting process: ${nextProcess.name} (${nextProcess.id})`);
    console.log(`📊 PIN Range: ${nextProcess.pinRange.start} - ${nextProcess.pinRange.end}`);

    return nextProcess;
  }

  /**
   * Đánh dấu tiến trình hoàn thành
   * @param {string} processId - ID tiến trình
   * @param {string} foundPin - PIN tìm được (nếu có)
   * @param {string} error - Lỗi (nếu có)
   */
  async completeProcess(processId, foundPin = null, error = null) {
    const process = this.processQueue.find(p => p.id === processId);
    if (!process) return;

    process.status = foundPin ? 'completed' : (error ? 'error' : 'completed');
    process.completedAt = new Date().toISOString();
    process.foundPin = foundPin;
    process.error = error;

    if (foundPin) {
      console.log(`🎯 Process ${processId} found PIN: ${foundPin}`);
      // Thông báo cho các server khác dừng lại
      await this.notifyServersToStop(process.accessCode, foundPin);
    }

    this.isProcessing = false;
    this.currentProcess = null;
    this.saveQueue();

    // Bắt đầu tiến trình tiếp theo
    setTimeout(() => this.startNextProcess(), 1000);
  }

  /**
   * Thông báo cho các server khác dừng lại khi tìm được PIN
   * @param {string} accessCode - Access code
   * @param {string} foundPin - PIN tìm được
   */
  async notifyServersToStop(accessCode, foundPin) {
    const notifications = [];

    for (let i = 0; i < this.serverAddresses.length; i++) {
      const serverId = i + 1;

      if (serverId !== this.currentServerId) {
        const serverAddress = this.serverAddresses[i];
        const url = `${serverAddress}/api/stop-process`;

        notifications.push(
          axios.post(url, { accessCode, foundPin }, {
            timeout: 5000,
            headers: {
              'Content-Type': 'application/json'
            }
          })
            .then(() => console.log(`📢 Notified server ${serverId} (${serverAddress}) to stop`))
            .catch(err => console.error(`❌ Failed to notify server ${serverId} (${serverAddress}):`, err.message))
        );
      }
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Dừng tiến trình hiện tại (khi nhận thông báo từ server khác)
   * @param {string} accessCode - Access code
   * @param {string} foundPin - PIN đã tìm được
   */
  stopCurrentProcess(accessCode, foundPin) {
    if (this.currentProcess && this.currentProcess.accessCode === accessCode) {
      console.log(`🛑 Stopping current process due to PIN found by another server: ${foundPin}`);
      this.currentProcess.status = 'cancelled';
      this.currentProcess.completedAt = new Date().toISOString();
      this.currentProcess.error = `Cancelled - PIN ${foundPin} found by another server`;

      this.isProcessing = false;
      this.currentProcess = null;
      this.saveQueue();

      // Bắt đầu tiến trình tiếp theo
      setTimeout(() => this.startNextProcess(), 1000);
      return true;
    }
    return false;
  }

  /**
   * Lấy trạng thái queue
   */
  getQueueStatus() {
    return {
      serverId: this.currentServerId,
      totalServers: this.totalServers,
      serverAddresses: this.serverAddresses,
      currentServerAddress: this.serverAddresses[this.currentServerId - 1],
      totalProcesses: this.processQueue.length,
      pendingProcesses: this.processQueue.filter(p => p.status === 'pending').length,
      runningProcesses: this.processQueue.filter(p => p.status === 'running').length,
      completedProcesses: this.processQueue.filter(p => p.status === 'completed').length,
      currentProcess: this.currentProcess,
      isProcessing: this.isProcessing,
      processes: this.processQueue
    };
  }

  /**
   * Xóa tiến trình
   * @param {string} processId - ID tiến trình
   */
  deleteProcess(processId) {
    const index = this.processQueue.findIndex(p => p.id === processId);
    if (index !== -1) {
      const process = this.processQueue[index];
      if (process.status === 'running') {
        throw new Error('Cannot delete running process');
      }
      this.processQueue.splice(index, 1);
      this.saveQueue();
      return true;
    }
    return false;
  }

  /**
   * Cập nhật tiến trình
   * @param {string} processId - ID tiến trình
   * @param {Object} updates - Cập nhật
   */
  updateProcess(processId, updates) {
    const process = this.processQueue.find(p => p.id === processId);
    if (process && process.status === 'pending') {
      Object.assign(process, updates);
      this.saveQueue();
      return true;
    }
    return false;
  }
}

module.exports = ProcessQueueManager;