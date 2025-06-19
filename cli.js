#!/usr/bin/env node

/**
 * Brastel PIN Checker - CLI Interface
 * Command-line interface for running PIN checker via SSH
 */

const { BrastelPinChecker, CONFIG } = require('./brastel-pin-checker');
const fs = require('fs');
const path = require('path');

// CLI configuration
const CLI_CONFIG = {
  commands: ['start', 'status', 'stats', 'config', 'help', 'stop', 'resume'],
  configFile: 'cli-config.json'
};

/**
 * CLI class for handling command-line operations
 */
class BrastelCLI {
  constructor() {
    this.configFile = CLI_CONFIG.configFile;
    this.runningJobs = new Map();
    this.loadConfig();
  }

  /**
   * Load CLI configuration from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        Object.assign(CONFIG, config);
        console.log(`✅ Configuration loaded from ${this.configFile}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not load config: ${error.message}`);
    }
  }

  /**
   * Save current configuration to file
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(CONFIG, null, 2));
      console.log(`✅ Configuration saved to ${this.configFile}`);
    } catch (error) {
      console.error(`❌ Failed to save config: ${error.message}`);
    }
  }

  /**
   * Display help information
   */
  displayHelp() {
    console.log(`
🚀 Brastel PIN Checker CLI

USAGE:
  node cli.js <command> [options]

COMMANDS:
  start                     Start PIN checking process
  status                    Show current status and running jobs
  stats [accessCode]        Show statistics for specific or all access codes
  config                    Show current configuration
  config set <key> <value>  Set configuration value
  help                      Show this help message
  stop                      Stop all running processes
  resume <jobId>            Resume a stopped job

OPTIONS for 'start':
  --workers <num>           Number of concurrent workers (default: 1)
  --random                  Enable random PIN processing
  --max-undefined <num>     Max undefined results before stopping (default: 25)
  --delay <ms>              Delay between PIN processing in ms (default: 100)

EXAMPLES:
node cli.js start                             # Start with default settings
  node cli.js start --workers 3               # Start with 3 workers
  node cli.js start --random                  # Start with random processing
  node cli.js stats 74974423                  # Show stats for specific access code
  node cli.js config set concurrentWorkers 5  # Set worker count

CONFIGURATION:
  Configuration is stored in ${this.configFile}
  You can edit this file directly or use 'config set' command.
`);
  }

  /**
   * Display current configuration
   */
  displayConfig() {
    console.log('\n📋 Current Configuration:');
    console.log('='.repeat(40));

    console.log('\n🎯 Access Codes:');
    CONFIG.accessCodes.forEach((ac, index) => {
      console.log(`  ${index + 1}. ${ac.accessCode} (PIN: ${ac.pinRange.start}-${ac.pinRange.end})`);
    });

    console.log('\n⚙️  Worker Settings:');
    console.log(`  - Concurrent Workers: ${CONFIG.concurrentWorkers}`);
    console.log(`  - Max Undefined Results: ${CONFIG.maxUndefinedResults}`);
    console.log(`  - Random Processing: ${CONFIG.randomProcessing.enabled}`);
    console.log(`  - Delay Between PINs: ${CONFIG.randomProcessing.delayBetweenPins}ms`);

    console.log('\n🛡️  Proxy Settings:');
    console.log(`  - Total Proxies: ${CONFIG.proxies.length}`);
    CONFIG.proxies.forEach((proxy, index) => {
      const display = proxy || '(no proxy)';
      console.log(`    ${index + 1}. ${display}`);
    });

    console.log('\n🍪 Cookie Settings:');
    console.log(`  - Total Cookies: ${CONFIG.cookies.length}`);

    console.log('\n📱 Notification Settings:');
    console.log(`  - Ntfy Enabled: ${CONFIG.ntfy.enabled}`);
    console.log(`  - Topic: ${CONFIG.ntfy.topic}`);
    console.log(`  - Server: ${CONFIG.ntfy.server}`);
  }

  /**
   * Set configuration value
   */
  setConfig(key, value) {
    try {
      // Handle nested keys like randomProcessing.enabled
      const keys = key.split('.');
      let target = CONFIG;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) {
          target[keys[i]] = {};
        }
        target = target[keys[i]];
      }

      // Convert value to appropriate type
      let convertedValue = value;
      if (value === 'true') convertedValue = true;
      else if (value === 'false') convertedValue = false;
      else if (!isNaN(value)) convertedValue = Number(value);

      target[keys[keys.length - 1]] = convertedValue;

      console.log(`✅ Set ${key} = ${convertedValue}`);
      this.saveConfig();
    } catch (error) {
      console.error(`❌ Failed to set config: ${error.message}`);
    }
  }

  /**
   * Display statistics for access codes
   */
  displayStats(accessCode = null) {
    console.log('\n📊 Statistics:');
    console.log('='.repeat(40));

    const accessCodesToCheck = accessCode ?
      CONFIG.accessCodes.filter(ac => ac.accessCode === accessCode) :
      CONFIG.accessCodes;

    if (accessCodesToCheck.length === 0) {
      console.log(`❌ Access code ${accessCode} not found in configuration`);
      return;
    }

    accessCodesToCheck.forEach(ac => {
      const filePaths = CONFIG.getFilePaths(ac.accessCode);

      console.log(`\n🎯 Access Code: ${ac.accessCode}`);
      console.log(`   PIN Range: ${ac.pinRange.start} - ${ac.pinRange.end}`);

      try {
        // Read statistics from files
        let sentPins = 0, blacklistPins = 0, validPins = 0;

        if (fs.existsSync(filePaths.sentPins)) {
          const data = JSON.parse(fs.readFileSync(filePaths.sentPins, 'utf8'));
          sentPins = Array.isArray(data) ? data.length : Object.keys(data).length;
        }

        if (fs.existsSync(filePaths.blacklistPins)) {
          const data = JSON.parse(fs.readFileSync(filePaths.blacklistPins, 'utf8'));
          blacklistPins = Array.isArray(data) ? data.length : Object.keys(data).length;
        }

        if (fs.existsSync(filePaths.validPins)) {
          const data = JSON.parse(fs.readFileSync(filePaths.validPins, 'utf8'));
          validPins = Array.isArray(data) ? data.length : Object.keys(data).length;
        }

        const totalRange = ac.pinRange.end - ac.pinRange.start + 1;
        const progress = sentPins > 0 ? ((sentPins / totalRange) * 100).toFixed(2) : '0.00';

        console.log(`   Progress: ${progress}% (${sentPins}/${totalRange})`);
        console.log(`   Valid PINs: ${validPins}`);
        console.log(`   Blacklisted: ${blacklistPins}`);

      } catch (error) {
        console.log(`   ❌ Error reading stats: ${error.message}`);
      }
    });
  }

  /**
   * Start PIN checking process
   */
  async startChecker(options = {}) {
    try {
      // Apply command line options
      if (options.workers) {
        CONFIG.concurrentWorkers = parseInt(options.workers);
      }
      if (options.random) {
        CONFIG.randomProcessing.enabled = true;
      }
      if (options.maxUndefined) {
        CONFIG.maxUndefinedResults = parseInt(options.maxUndefined);
      }
      if (options.delay) {
        CONFIG.randomProcessing.delayBetweenPins = parseInt(options.delay);
      }

      console.log('🚀 Starting Brastel PIN Checker...');
      console.log(`⚙️  Workers: ${CONFIG.concurrentWorkers}`);
      console.log(`🎲 Random Processing: ${CONFIG.randomProcessing.enabled}`);
      console.log(`⏱️  Delay: ${CONFIG.randomProcessing.delayBetweenPins}ms`);
      console.log('='.repeat(50));

      const checker = new BrastelPinChecker();
      await checker.start();

      console.log('\n🎉 PIN checking completed successfully!');
    } catch (error) {
      console.error(`❌ Error starting checker: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show status of running processes
   */
  showStatus() {
    console.log('\n📋 Process Status:');
    console.log('='.repeat(40));

    if (this.runningJobs.size === 0) {
      console.log('No running jobs found.');
    } else {
      this.runningJobs.forEach((job, jobId) => {
        console.log(`Job ${jobId}: ${job.status} (started: ${job.startTime})`);
      });
    }
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args) {
    const options = {};
    const commands = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const value = args[i + 1];

        if (value && !value.startsWith('--')) {
          options[key] = value;
          i++; // Skip next argument as it's the value
        } else {
          options[key] = true;
        }
      } else {
        commands.push(arg);
      }
    }

    return { commands, options };
  }

  /**
   * Main CLI handler
   */
  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      this.displayHelp();
      return;
    }

    const { commands, options } = this.parseArgs(args);
    const command = commands[0];

    switch (command) {
    case 'start':
      await this.startChecker(options);
      break;

    case 'status':
      this.showStatus();
      break;

    case 'stats':
      this.displayStats(commands[1]);
      break;

    case 'config':
      if (commands[1] === 'set' && commands[2] && commands[3]) {
        this.setConfig(commands[2], commands[3]);
      } else {
        this.displayConfig();
      }
      break;

    case 'help':
      this.displayHelp();
      break;

    case 'stop':
      console.log('🛑 Stop functionality will be implemented in future version');
      break;

    case 'resume':
      console.log('🔄 Resume functionality will be implemented in future version');
      break;

    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use "node cli.js help" to see available commands.');
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new BrastelCLI();
  cli.run().catch(error => {
    console.error('CLI Error:', error);
    process.exit(1);
  });
}

module.exports = BrastelCLI;
